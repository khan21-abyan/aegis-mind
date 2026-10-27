import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CheckpointLog } from "../src/checkpoint.js";

describe("CheckpointLog", () => {
  it("appends, snapshots, restores, replays", () => {
    const dir = mkdtempSync(join(tmpdir(), "aegis-cp-"));
    try {
      const log = CheckpointLog.open(dir);
      log.append({ type: "turn_started", ts: 1, run: "r1", detail: {} });
      const n = log.snapshot({ turn: 3, state: "half" });
      log.append({ type: "checkpoint", ts: 2, run: "r1", detail: { snap: n } });
      expect(log.list()).toContain(n);
      expect(log.restore(n)).toEqual({ turn: 3, state: "half" });
      expect(log.replay(n).length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
