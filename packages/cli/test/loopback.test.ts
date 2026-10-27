import { describe, it, expect, afterEach } from "vitest";
import { once } from "node:events";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { CheckpointLog, createDashboard, createProxy, Heal, Kernel } from "../../core/src/index.js";

// Security regression guard: the production proxy (pkg/cli/src/index.ts) and
// dashboard (pkg/core/src/dashboard.ts) must stay bound to loopback only.
// The dashboard is asserted behaviorally — createDashboard does its own
// listen; the proxy's listen lives in the CLI, so its call is pinned in
// source and its address() is checked under the same loopback listen().

const srcPath = (...segments: string[]): string =>
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ...segments);

describe("loopback-only binds", () => {
  let dash: http.Server | undefined;
  let proxy: http.Server | undefined;

  afterEach(async () => {
    for (const server of [dash, proxy].filter((s): s is http.Server => s !== undefined)) {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
    dash = proxy = undefined;
  });

  it("proxy and dashboard listen on 127.0.0.1, never a wildcard interface", async () => {
    const root = mkdtempSync(join(tmpdir(), "aegis-loopback-"));
    try {
      // Production dashboard: createDashboard listens internally.
      const log = CheckpointLog.open(root);
      dash = createDashboard({ log, port: 0 });
      await once(dash, "listening");
      expect((dash.address() as AddressInfo).address).toBe("127.0.0.1");

      // Production proxy: resolve-and-listen exactly as the CLI does now,
      // then confirm Node reports the loopback address (not 0.0.0.0).
      proxy = createProxy({
        upstream: "http://127.0.0.1:9",
        kernel: new Kernel({ budgetCap: 1 }),
        heal: new Heal({ failovers: [] }),
        log,
        beacon: [],
      });
      proxy.listen(0, "127.0.0.1");
      await once(proxy, "listening");
      expect((proxy.address() as AddressInfo).address).toBe("127.0.0.1");

      // Source pins keep the production call sites hardened.
      expect(readFileSync(srcPath("packages", "cli", "src", "index.ts"), "utf8")).toContain(
        'proxy.listen(args.port, "127.0.0.1")',
      );
      expect(readFileSync(srcPath("packages", "core", "src", "dashboard.ts"), "utf8")).toContain(
        'server.listen(port, "127.0.0.1")',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
