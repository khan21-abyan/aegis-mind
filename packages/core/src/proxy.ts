import http from "node:http";
import { createHash } from "node:crypto";
import { Kernel } from "./kernel.js";
import { Heal } from "./healing.js";
import { CheckpointLog } from "./checkpoint.js";
import type { Event, EventType, TurnContext } from "./types.js";

export interface ProxyOpts {
  upstream: string;
  kernel: Kernel;
  heal: Heal;
  log: CheckpointLog;
  beacon: string[];
}

const HOP_HEADERS = new Set(["host", "connection"]);
const TURN_COST = 0.001;

const stripHop = (h: http.IncomingHttpHeaders): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(h)) {
    if (HOP_HEADERS.has(key.toLowerCase())) continue;
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(", ");
  }
  return out;
};

const tryParse = (b: Buffer): unknown => {
  try {
    return JSON.parse(b.toString("utf8"));
  } catch {
    return undefined;
  }
};

const turnHash = (b: Buffer): string =>
  createHash("sha1").update(b.subarray(0, 2048)).digest("hex").slice(0, 12);

const blockEventFor = (action: string, reason: string): EventType =>
  action === "halt" ? "budget_exhausted" : (reason as EventType);

export function createProxy(o: ProxyOpts): http.Server {
  const upstream = new URL(o.upstream);
  const ctx: TurnContext = { run: "default", agent: "client", turn: 0, spent: 0, actions: [], lastHashes: [] };

  return http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      tryParse(body);
      ctx.turn += 1;
      const hash = turnHash(body);

      const decision = o.kernel.admit(ctx, 0);
      if (!decision.allow) {
        o.log.append({
          type: blockEventFor(decision.action, decision.reason),
          ts: Date.now(),
          run: ctx.run,
          agent: ctx.agent,
          detail: { turn: ctx.turn, hash, reason: decision.reason },
        });
        res.writeHead(decision.action === "halt" ? 429 : 409, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: decision.reason, message: `aegis-mind: ${decision.reason}` } }));
        return;
      }

      o.log.append({
        type: "call_fwd",
        ts: Date.now(),
        run: ctx.run,
        agent: ctx.agent,
        detail: { hash, turn: ctx.turn },
      });

      const fwd = http.request(
        {
          protocol: upstream.protocol,
          hostname: upstream.hostname,
          port: upstream.port,
          path: req.url,
          method: req.method,
          headers: { ...stripHop(req.headers), host: upstream.host },
        },
        (up) => {
          ctx.spent += TURN_COST;
          o.log.append({
            type: "call_returned",
            ts: Date.now(),
            run: ctx.run,
            agent: ctx.agent,
            detail: { status: up.statusCode, cost: TURN_COST },
          });
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        }
      );

      fwd.on("error", (err) => {
        const ev: Event = {
          type: "model_error",
          ts: Date.now(),
          run: ctx.run,
          agent: ctx.agent,
          detail: { turn: ctx.turn, hash, message: err.message },
        };
        o.log.append(ev);
        const healDecision = o.heal.decide(ev, 1);
        if (!res.headersSent) {
          res.writeHead(502, { "content-type": "application/json" });
        }
        res.end(JSON.stringify({ error: { code: "model_error", message: `aegis-mind: upstream failed (${healDecision.type})` } }));
      });

      fwd.end(body);
    });
  });
}
