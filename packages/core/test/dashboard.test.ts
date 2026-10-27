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
});
