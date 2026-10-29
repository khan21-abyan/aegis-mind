import http from "node:http";
import https from "node:https";
import { createHash } from "node:crypto";
import { Kernel } from "./kernel.js";
import { Heal } from "./healing.js";
import { CheckpointLog } from "./checkpoint.js";
import type { Event, EventType, TurnContext } from "./types.js";
import type { HealResult } from "./healing.js";

export interface ProxyOpts {
  upstream: string;
  kernel: Kernel;
  heal: Heal;
  log: CheckpointLog;
  beacon: string[];
  /** Maximum buffered request body size. Requests above this are rejected with 413. */
  maxRequestBytes?: number;
}

const HOP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
]);
const TURN_COST = 0.001;
const UPSTREAM_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REQUEST_BYTES = 64 * 1024 * 1024;
const MAX_RETRY_AFTER_MS = 30_000;
const sleep = (ms: number): Promise<void> => ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

const parseRetryAfter = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Date.parse(value) - Date.now();
  if (!Number.isFinite(delay)) return undefined;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, delay));
};

const stripHop = (h: http.IncomingHttpHeaders): Record<string, string> => {
  const out: Record<string, string> = {};
  const connectionTokens = (typeof h.connection === "string" ? h.connection : "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  for (const [key, value] of Object.entries(h)) {
    if (HOP_HEADERS.has(key.toLowerCase())) continue;
    if (connectionTokens.includes(key.toLowerCase())) continue;
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(", ");
  }
  return out;
};

const stripHopResponse = (h: http.IncomingHttpHeaders): Record<string, string | string[]> => {
  const out: Record<string, string | string[]> = {};
  const connectionTokens = (typeof h.connection === "string" ? h.connection : "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  for (const [key, value] of Object.entries(h)) {
    if (HOP_HEADERS.has(key.toLowerCase())) continue;
    if (connectionTokens.includes(key.toLowerCase())) continue;
    if (typeof value === "string" || Array.isArray(value)) out[key] = value;
  }
  return out;
};

const turnHash = (b: Buffer): string => createHash("sha256").update(b).digest("hex").slice(0, 24);

const readModel = (body: Buffer): string | undefined => {
  try {
    const value = JSON.parse(body.toString("utf8")) as { model?: unknown };
    return typeof value.model === "string" && value.model.length > 0 ? value.model : undefined;
  } catch {
    return undefined;
  }
};

const replaceModel = (body: Buffer, model: string): Buffer<ArrayBufferLike> | undefined => {
  try {
    const value = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
    if (typeof value.model !== "string") return undefined;
    value.model = model;
    return Buffer.from(JSON.stringify(value), "utf8");
  } catch {
    return undefined;
  }
};

const writeJsonError = (res: http.ServerResponse, status: number, code: string, message: string): void => {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: { code, message } }));
};

const blockEventFor = (reason: string): EventType => {
  if (reason === "budget_exhausted" || reason === "loop_detected") return reason;
  return "halted";
};

export function createProxy(o: ProxyOpts): http.Server {
  const upstream = new URL(o.upstream);
  const maxRequestBytes = o.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
  const ctx: TurnContext = { run: "default", agent: "client", turn: 0, spent: 0, actions: [], lastHashes: [] };

  return http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    let bodyBytes = 0;
    let rejected = false;
    req.on("data", (c: Buffer) => {
      if (rejected) return;
      bodyBytes += c.length;
      if (bodyBytes > maxRequestBytes) {
        rejected = true;
        chunks.length = 0;
        res.writeHead(413, { "content-type": "application/json", connection: "close" });
        res.end(JSON.stringify({ error: { code: "request_too_large", message: "aegis-mind: request body exceeds configured limit" } }));
        return;
      }
      chunks.push(c);
    });
    req.on("aborted", () => {
      chunks.length = 0;
      if (!res.destroyed) res.destroy();
    });
    req.on("error", () => {
      chunks.length = 0;
      if (!res.destroyed && !res.headersSent) {
        res.writeHead(400, { "content-type": "application/json", connection: "close" });
        res.end(JSON.stringify({ error: { code: "invalid_request", message: "aegis-mind: request body was interrupted" } }));
      } else if (!res.destroyed) {
        res.destroy();
      }
    });
    req.on("end", () => {
      if (rejected) return;
      const body = Buffer.concat(chunks);
      ctx.turn += 1;
      const hash = turnHash(body);

      const decision = o.kernel.admit(ctx, 0);
      if (!decision.allow) {
        const ev: Event = {
          type: blockEventFor(decision.reason),
          ts: Date.now(),
          run: ctx.run,
          agent: ctx.agent,
          detail: { turn: ctx.turn, hash, reason: decision.reason },
        };
        o.log.append(ev);
        o.kernel.observe(ev);
        res.writeHead(decision.action === "halt" ? 429 : 409, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: ev.type, message: `aegis-mind: ${decision.reason}` } }));
        return;
      }

      const baseHeaders = { ...stripHop(req.headers), host: upstream.host };
      const originalModel = readModel(body);
      const maxAttempts = 2 + o.heal.failoverCount;
      const runAttempts = async (): Promise<void> => {
        let requestBody: Buffer<ArrayBufferLike> = body;
        let attempt = 1;
        let currentModel = originalModel;
        let currentRequest: http.ClientRequest | undefined;
        res.once("close", () => currentRequest?.destroy());

        const logForward = (): void => {
          const ev: Event = {
            type: "call_fwd",
            ts: Date.now(),
            run: ctx.run,
            agent: ctx.agent,
            detail: { hash, turn: ctx.turn, attempt, model: currentModel },
          };
          o.log.append(ev);
          // Internal retries are not new client turns and must not inflate
          // loop detection's window.
          if (attempt === 1) o.kernel.observe(ev);
        };

        const stopForBudget = (): void => {
          const ev: Event = {
            type: "budget_exhausted",
            ts: Date.now(),
            run: ctx.run,
            agent: ctx.agent,
            detail: { turn: ctx.turn, hash, reason: "budget_exhausted_during_recovery", attempt },
          };
          o.log.append(ev);
          o.kernel.observe(ev);
          writeJsonError(res, 429, "budget_exhausted", "aegis-mind: budget exhausted before recovery attempt");
        };

        const writePassthrough = (up: http.IncomingMessage): void => {
          const status = up.statusCode ?? 502;
          res.writeHead(status, stripHopResponse(up.headers));
          up.pipe(res);
          up.on("error", (err) => res.destroy(err));
        };

        const attemptRequest = (): void => {
          if (res.destroyed || res.writableEnded) return;
          if (!o.kernel.reserve(ctx, TURN_COST)) {
            stopForBudget();
            return;
          }
          logForward();
          const transport = upstream.protocol === "https:" ? https : http;
          const headers: Record<string, string> = { ...baseHeaders };
          headers["content-length"] = String(requestBody.length);
          const fwd = transport.request(
            {
              protocol: upstream.protocol,
              hostname: upstream.hostname,
              port: upstream.port,
              path: req.url,
              method: req.method,
              headers,
            },
            (up) => {
              const status = up.statusCode ?? 502;
              const failureType: EventType | undefined = status === 429 ? "rate_limited" : status >= 500 ? "model_error" : undefined;
              const returned: Event = {
                type: "call_returned",
                ts: Date.now(),
                run: ctx.run,
                agent: ctx.agent,
                detail: { status, cost: TURN_COST, attempt, model: currentModel },
              };
              o.log.append(returned);

              if (failureType) {
                const failure: Event = {
                  type: failureType,
                  ts: Date.now(),
                  run: ctx.run,
                  agent: ctx.agent,
                  detail: { turn: ctx.turn, hash, status, attempt, model: currentModel },
                };
                o.log.append(failure);
                const policy = o.heal.decide(failure, attempt);
                if ((policy.type === "retry" || policy.type === "failover") && attempt < maxAttempts) {
                  const waitMs = failureType === "rate_limited"
                    ? parseRetryAfter(up.headers["retry-after"]) ?? policy.waitMs
                    : policy.waitMs;
                  let nextBody: Buffer<ArrayBufferLike> = requestBody;
                  if (policy.type === "failover") {
                    if (policy.model === undefined || currentModel === undefined) {
                      writePassthrough(up);
                      return;
                    }
                    const changed = replaceModel(requestBody, policy.model);
                    if (changed === undefined) {
                      writePassthrough(up);
                      return;
                    }
                    nextBody = changed;
                  }
                  up.resume();
                  up.once("end", () => {
                    void sleep(waitMs).then(() => {
                      if (res.destroyed || res.writableEnded) return;
                      if (policy.type === "failover") {
                        requestBody = nextBody;
                        currentModel = policy.model;
                      }
                      attempt += 1;
                      attemptRequest();
                    });
                  });
                  up.once("error", (err) => {
                    if (!res.destroyed) res.destroy(err);
                  });
                  return;
                }
              }

              if (failureType) {
                o.log.append({
                  type: failureType,
                  ts: Date.now(),
                  run: ctx.run,
                  agent: ctx.agent,
                  detail: { turn: ctx.turn, hash, status, attempt, model: currentModel, exhausted: true },
                });
              }
              if (attempt > 1 && status >= 200 && status < 300) {
                o.log.append({
                  type: "recovered",
                  ts: Date.now(),
                  run: ctx.run,
                  agent: ctx.agent,
                  detail: { turn: ctx.turn, attempt, model: currentModel },
                });
              }
              writePassthrough(up);
            }
          );
          currentRequest = fwd;
          fwd.setTimeout(UPSTREAM_TIMEOUT_MS, () => fwd.destroy(new Error("upstream timeout")));
          fwd.once("error", (err) => {
            if (res.destroyed || res.writableEnded) return;
            const failure: Event = {
              type: "model_error",
              ts: Date.now(),
              run: ctx.run,
              agent: ctx.agent,
              detail: { turn: ctx.turn, hash, message: err.message, attempt, model: currentModel },
            };
            o.log.append(failure);
            const policy: HealResult = o.heal.decide(failure, attempt);
            if ((policy.type === "retry" || policy.type === "failover") && attempt < maxAttempts) {
              void sleep(policy.waitMs).then(() => {
                if (res.destroyed || res.writableEnded) return;
                if (policy.type === "failover") {
                  if (policy.model === undefined || currentModel === undefined) {
                    writeJsonError(res, 502, "model_error", "aegis-mind: failover requires a JSON model field");
                    return;
                  }
                  const changed = replaceModel(requestBody, policy.model);
                  if (!changed) {
                    writeJsonError(res, 502, "model_error", "aegis-mind: failover requires a JSON model field");
                    return;
                  }
                  requestBody = changed;
                  currentModel = policy.model;
                }
                attempt += 1;
                attemptRequest();
              });
              return;
            }
            writeJsonError(res, 502, "model_error", `aegis-mind: upstream failed (${policy.type})`);
          });
          fwd.end(requestBody);
        };

        attemptRequest();
      };

      void runAttempts().catch((err: unknown) => {
        if (!res.destroyed && !res.writableEnded) {
          writeJsonError(res, 502, "model_error", `aegis-mind: proxy recovery failed (${err instanceof Error ? err.message : String(err)})`);
        }
      });
    });
  });
}
