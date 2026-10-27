import { describe, it, expect, afterAll } from "vitest";
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
  it("halts blocked turns with 429 budget_exhausted error shape", async () => {
    const p = createProxy({
      upstream: `http://127.0.0.1:${stubPort}`,
      kernel: new Kernel({ budgetCap: 0 }),
      heal: new Heal({ failovers: [] }),
      log,
      beacon: [],
    });
    p.listen(0);
    const out = await fetch(`http://127.0.0.1:${(p.address() as import("node:net").AddressInfo).port}/v1/chat/completions`, {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    expect(out.status).toBe(429);
    const body = (await out.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({
      error: { code: "budget_exhausted", message: expect.any(String) },
    });
    p.close();
  });

  it("passes allowed traffic through to the upstream verbatim", async () => {
    const p = createProxy({
      upstream: `http://127.0.0.1:${stubPort}`,
      kernel: new Kernel({ budgetCap: 100 }),
      heal: new Heal({ failovers: [] }),
      log,
      beacon: [],
    });
    p.listen(0);
    const out = await fetch(`http://127.0.0.1:${(p.address() as import("node:net").AddressInfo).port}/v1/chat/completions`, {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    expect(out.status).toBe(200);
    expect(await out.text()).toBe('{"ok":true}');
    const lines = readFileSync(join(dir, ".aegis", "events.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string });
    expect(lines.some((e) => e.type === "call_fwd")).toBe(true);
    expect(lines.some((e) => e.type === "call_returned")).toBe(true);
    p.close();
  });
});
