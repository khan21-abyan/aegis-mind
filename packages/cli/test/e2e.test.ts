import { describe, it, expect, afterEach } from "vitest";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { CheckpointLog, createDashboard, createProxy, Heal, Kernel } from "../../core/src/index.js";
import type { Event, HealResult } from "../../core/src/index.js";

// The "sold-in-60-seconds" demo: upstream dies twice, the kernel keeps
// admitting traffic, the heal policy keeps the client retrying, the run
// recovers to a 200, the whole story is visible in the event stream, and a
// snapshot survives the restore roundtrip — end to end.

const FAILURES_BEFORE_UP = 2;
const OK_BODY = JSON.stringify({ ok: true, usage: { total_tokens: 3 } });
const RETRY_WAIT_BUDGET_MS = 25; // policy waitMs honored up to a small test budget

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

describe("e2e: upstream dies, kernel-heal policy + client loop recover, dashboard sees it, checkpoint restores", () => {
  let stub: http.Server | undefined;
  let proxy: http.Server | undefined;
  let dash: http.Server | undefined;

  afterEach(async () => {
    for (const server of [dash, proxy, stub].filter((s): s is http.Server => s !== undefined)) {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
    dash = proxy = stub = undefined;
  });

  it("fails the upstream twice, recovers on attempt 3, and shows it all", async () => {
    // Stub upstream: destroys nothing, just answers 502 twice, then 200.
    let upstreamCalls = 0;
    stub = http.createServer((_req, res) => {
      upstreamCalls += 1;
      if (upstreamCalls <= FAILURES_BEFORE_UP) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end('{"error":{"code":"upstream_broken","message":"stub outage"}}');
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(OK_BODY);
    });
    stub.listen(0);
    await once(stub, "listening");
    const stubPort = (stub.address() as AddressInfo).port;

    const root = mkdtempSync(join(tmpdir(), "aegis-e2e-"));
    try {
      const log = CheckpointLog.open(root);
      const kernel = new Kernel({ budgetCap: 100 });
      const heal = new Heal({ failovers: [] });

      // Deterministic collector wired straight to log.em — no SSE here.
      const collected: Event[] = [];
      log.em.on("event", (ev: Event) => collected.push(ev));

      proxy = createProxy({
        upstream: `http://127.0.0.1:${stubPort}`,
        kernel,
        heal,
        log,
        beacon: [],
      });
      proxy.listen(0);
      await once(proxy, "listening");
      const proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}/v1/chat/completions`;

      dash = createDashboard({ log, port: 0 });
      await once(dash, "listening");

      // Client-side heal semantics the CLI/doc promise: on upstream failure the
      // client consults heal.decide and retries per policy. The helper mirrors
      // that by appending the model_error it reasoned about and, once a retried
      // attempt succeeds, the recovered marker.
      const sendWithHeal = async (run: string): Promise<Response> => {
        const decisions: HealResult[] = [];
        for (let attempt = 1; attempt <= FAILURES_BEFORE_UP + 1; attempt++) {
          const res = await fetch(proxyUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
          });
          if (res.ok) {
            if (attempt > 1) {
              log.append({ type: "recovered", ts: Date.now(), run, detail: { attempt, retry: true } });
            }
            return res;
          }
          const ev: Event = { type: "model_error", ts: Date.now(), run, detail: { upstreamStatus: res.status } };
          const decision = heal.decide(ev, attempt);
          decisions.push(decision);
          log.append(ev);
          await sleep(Math.min(decision.waitMs, RETRY_WAIT_BUDGET_MS));
        }
        throw new Error(`not healed after ${FAILURES_BEFORE_UP + 1} attempts: ${JSON.stringify(decisions)}`);
      };

      const run = "e2e-demo";
      const res = await sendWithHeal(run);

      expect(upstreamCalls).toBe(FAILURES_BEFORE_UP + 1);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(OK_BODY);

      // Full event story, in order: forward → returned(502) → heal →
      // forward → returned(502) → heal → forward → returned(200) → recovered.
      expect(collected.map((e) => e.type)).toEqual([
        "call_fwd",
        "call_returned",
        "model_error",
        "call_fwd",
        "call_returned",
        "model_error",
        "call_fwd",
        "call_returned",
        "recovered",
      ]);
      const returned = collected.filter((e) => e.type === "call_returned");
      expect(
        returned.map((e) => (e.detail as { status?: number }).status),
      ).toEqual([502, 502, 200]);

      // Dashboard visibility (and only here): SSE first-chunk read over the
      // replayed history must surface the recovery story.
      const dashPort = (dash.address() as AddressInfo).port;
      const sse = await fetch(`http://127.0.0.1:${dashPort}/events`);
      expect(sse.headers.get("content-type")).toContain("text/event-stream");
      const reader = sse.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";
      const deadline = Date.now() + 2000;
      while (!acc.includes("recovered")) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        const tick = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), remaining));
        const chunk = await Promise.race([reader.read(), tick]);
        if (chunk === "timeout" || chunk.done) break;
        acc += dec.decode(chunk.value, { stream: true });
      }
      expect(acc).toContain("recovered");
      expect(acc).toContain("call_fwd");
      expect(acc).toContain("call_returned");

      // Checkpoint: journal exists after the run; snapshot survives restore.
      expect(existsSync(join(root, ".aegis", "events.jsonl"))).toBe(true);
      const n = log.snapshot({ turns: 3, spent: 0.003 });
      log.append({ type: "checkpoint", ts: Date.now(), run, detail: { snap: n } });
      expect(existsSync(log.snapFile(n))).toBe(true);
      expect(log.list()).toContain(n);
      expect(log.restore(n)).toEqual({ turns: 3, spent: 0.003 });

      log.em.removeAllListeners("event");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
