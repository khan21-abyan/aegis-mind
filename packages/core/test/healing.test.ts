import { describe, it, expect } from "vitest";
import { Heal } from "../src/healing.js";
import { Event, EventType } from "../src/types.js";
const E = (type: EventType, detail: Record<string, unknown> = {}): Event =>
  ({ type, ts: Date.now(), run: "r", detail });

describe("Heal", () => {
  it("backs off exponentially on rate limits", () => {
    const h = new Heal({ failovers: ["gpt-4o"] });
    expect(h.decide(E("rate_limited"), 1).waitMs).toBe(2000);
    expect(h.decide(E("rate_limited"), 2).waitMs).toBe(4000);
  });
  it("fails over to next model after 2 model errors", () => {
    const h = new Heal({ failovers: ["m2"] });
    expect(h.decide(E("model_error"), 1).type).toBe("retry");
    const d = h.decide(E("model_error"), 2);
    expect(d.type).toBe("failover"); expect(d.failover).toBe(true);
  });
  it("halts on budget events", () => {
    expect(new Heal({ failovers: [] }).decide(E("budget_exhausted"), 1).type).toBe("halt");
  });
});
