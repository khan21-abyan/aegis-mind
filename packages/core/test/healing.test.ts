import { describe, it, expect } from "vitest";
import { Heal } from "../src/healing.js";
import { Event, EventType } from "../src/types.js";
const E = (type: EventType, detail: Record<string, unknown> = {}): Event =>
  ({ type, ts: Date.now(), run: "r", detail });

describe("Heal", () => {
  it("backs off exponentially on rate limits", () => {
    const h = new Heal({ failovers: ["gpt-4o"] });
    expect(h.decide(E("rate_limited"), 1).waitMs).toBe(2000);
    const failover = h.decide(E("rate_limited"), 2);
    expect(failover.type).toBe("failover");
    expect(failover.model).toBe("gpt-4o");
  });
  it("fails over to next model after 2 model errors", () => {
    const h = new Heal({ failovers: ["m2"] });
    expect(h.decide(E("model_error"), 1).type).toBe("retry");
    const d = h.decide(E("model_error"), 2);
    expect(d.type).toBe("failover"); expect(d.failover).toBe(true);
    expect(d.model).toBe("m2");
    expect(h.decide(E("model_error"), 3).type).toBe("halt");
  });
  it("halts after the bounded rate-limit retry budget", () => {
    const h = new Heal({ failovers: ["backup"] });
    expect(h.decide(E("rate_limited"), 1).type).toBe("retry");
    expect(h.decide(E("rate_limited"), 2).type).toBe("failover");
    expect(h.decide(E("rate_limited"), 3).type).toBe("halt");
  });
  it("halts on budget events", () => {
    expect(new Heal({ failovers: [] }).decide(E("budget_exhausted"), 1).type).toBe("halt");
  });
  it("rejects failover chains longer than the supported maximum", () => {
    expect(() => new Heal({ failovers: ["m1", "m2", "m3", "m4", "m5", "m6"] })).toThrow(RangeError);
    expect(() => new Heal({ failovers: ["m1", "m2", "m3", "m4", "m5"] })).not.toThrow();
  });
});
