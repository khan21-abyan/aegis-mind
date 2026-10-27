import { describe, it, expect, afterAll, afterEach } from "vitest";
import { createProxy } from "../src/proxy.js";
import { Kernel } from "../src/kernel.js";
import { Heal } from "../src/healing.js";
import { CheckpointLog } from "../src/checkpoint.js";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";

const stub = http
  .createServer((_, res) => {
    res.setHeader("content-type", "application/json");
    res.end('{"ok":true}');
  })
  .listen(0);
const stubPort = (stub.address() as import("node:net").AddressInfo).port;

const dir = mkdtempSync(join(tmpdir(), "aegis-proxy-"));
const log = CheckpointLog.open(dir);

afterAll(() => {
  stub.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("proxy", () => {
  const proxies: http.Server[] = [];
  const launchProxy = (kernel: Kernel): string => {
    const p = createProxy({
      upstream: `http://127.0.0.1:${stubPort}`,
      kernel,
      heal: new Heal({ failovers: [] }),
      log,
      beacon: [],
    });
    p.listen(0);
    proxies.push(p);
    return `http://127.0.0.1:${(p.address() as import("node:net").AddressInfo).port}/v1/chat/completions`;
  };

  afterEach(async () => {
    for (const p of proxies.splice(0)) await new Promise<void>((r) => p.close(() => r()));
  });

  const post = (url: string, body: Record<string, unknown>) =>
    fetch(url, { method: "POST", body: JSON.stringify(body) });

  it("halts blocked turns with 429 budget_exhausted error shape", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 0 }));
    const out = await post(url, { messages: [{ role: "user", content: "hi" }] });
    expect(out.status).toBe(429);
    const body = (await out.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({
      error: { code: "budget_exhausted", message: expect.any(String) },
    });
  });

  it("passes allowed traffic through to the upstream verbatim", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 100 }));
    const out = await post(url, { messages: [{ role: "user", content: "hi" }] });
    expect(out.status).toBe(200);
    expect(await out.text()).toBe('{"ok":true}');
    const lines = readFileSync(join(dir, ".aegis", "events.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string });
    expect(lines.some((e) => e.type === "call_fwd")).toBe(true);
    expect(lines.some((e) => e.type === "call_returned")).toBe(true);
  });

  it("halts a non-budget shutdown with 429 + code halted", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 100, maxTurns: 1 }));
    await post(url, { messages: [{ role: "user", content: "hi" }] });
    const out = await post(url, { messages: [{ role: "user", content: "again" }] });
    expect(out.status).toBe(429);
    const body = (await out.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({
      error: { code: "halted", message: expect.any(String) },
    });
  });

  it("blocks an identical-payload loop after loopWindow turns with 409 loop_detected", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 100, loopWindow: 3 }));
    const body = { messages: [{ role: "user", content: "same" }] };
    for (let i = 0; i < 3; i++) {
      const ok = await post(url, body);
      expect(ok.status).toBe(200);
    }
    const out = await post(url, body);
    expect(out.status).toBe(409);
    const res = (await out.json()) as { error: { code: string; message: string } };
    expect(res).toEqual({
      error: { code: "loop_detected", message: expect.any(String) },
    });
  });
});
