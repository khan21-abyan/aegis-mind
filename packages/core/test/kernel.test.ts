import { describe, it, expect } from "vitest";
import { Kernel } from "../src/kernel.js";

describe("Kernel governance", () => {
  it("blocks calls once budget is exhausted", () => {
    const k = new Kernel({ budgetCap: 1.0 });
    const ctx = { run: "r1", agent: "a", turn: 5, spent: 1.2, actions: [], lastHashes: [] };
    expect(k.admit(ctx, 0)).toEqual({ allow: false, action: "halt", reason: "budget_exhausted" });
  });
  it("blocks repeated identical turns (loop)", () => {
    const k = new Kernel({ budgetCap: 100, loopWindow: 4 });
    const mk = (n: number) => ({ run: "r", agent: "a", turn: n, spent: 0, actions: ["x"], lastHashes: [] });
    for (let i = 0; i < 4; i++) k.observe({ type: "call_fwd", ts: 0, run: "r", agent: "a", detail: { hash: "same" } });
    expect(k.admit(mk(5), 0).allow).toBe(false);
  });
});
