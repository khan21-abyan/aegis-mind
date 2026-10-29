import { describe, it, expect, afterEach } from "vitest";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createDashboard } from "../src/dashboard.js";
import { CheckpointLog } from "../src/checkpoint.js";

describe("dashboard", () => {
  let server: ReturnType<typeof createDashboard> | undefined;
  let dir: string | undefined;

  afterEach(async () => {
    if (server) {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
      server = undefined;
    }
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it("serves html and streams events via SSE", async () => {
    dir = mkdtempSync(join(tmpdir(), "aegis-dash-"));
    const log = CheckpointLog.open(dir);
    server = createDashboard({ log, port: 0 });
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}`;

    const html = await (await fetch(url)).text();
    expect(html).toContain("AEGIS MIND");
    expect(html).toContain("supervisor telemetry");
    expect(html).toContain('new EventSource("/events")');

    // Append matching event FIRST (ruling), then connect SSE, then read chunks.
    log.append({ type: "turn_started", ts: 3, run: "r9", detail: {} });

    const res = await fetch(`${url}/events`);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let acc = "";
    const deadline = Date.now() + 2000;
    while (!acc.includes("turn_started")) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const tick = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), remaining));
      const chunk = await Promise.race([reader.read(), tick]);
      if (chunk === "timeout" || chunk.done) break;
      acc += dec.decode(chunk.value, { stream: true });
    }
    expect(acc).toContain("turn_started");
  });

  it("continues streaming events appended after the SSE connection is open", async () => {
    dir = mkdtempSync(join(tmpdir(), "aegis-dash-live-"));
    const log = CheckpointLog.open(dir);
    server = createDashboard({ log, port: 0 });
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/events`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    const initial = await reader.read();
    acc += decoder.decode(initial.value, { stream: true });
    log.append({ type: "model_error", ts: Date.now(), run: "live-run", detail: {} });
    const deadline = Date.now() + 1500;
    while (!acc.includes("live-run")) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const result = await Promise.race([
        reader.read(),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), remaining)),
      ]);
      if (result === "timeout" || result.done) break;
      acc += decoder.decode(result.value, { stream: true });
    }
    expect(acc).toContain("live-run");
    await reader.cancel();
  });

  it("does not accumulate log.em listeners across create/close cycles", async () => {
    dir = mkdtempSync(join(tmpdir(), "aegis-dash-"));
    const log = CheckpointLog.open(dir);
    const before = log.em.listenerCount("event");

    const s1 = createDashboard({ log, port: 0 });
    await once(s1, "listening");
    expect(log.em.listenerCount("event")).toBe(before + 1);
    s1.closeAllConnections();
    s1.close();
    await once(s1, "close");
    expect(log.em.listenerCount("event")).toBe(before);

    const s2 = createDashboard({ log, port: 0 });
    await once(s2, "listening");
    expect(log.em.listenerCount("event")).toBe(before + 1);
    server = s2; // afterEach closes and re-asserts teardown through the helper path
  });
});
