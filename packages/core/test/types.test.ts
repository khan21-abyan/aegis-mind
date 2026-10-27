import { describe, it, expect } from "vitest";
import { Event, isBudgetEvent } from "../src/index.js";

describe("Event model", () => {
  it("discriminates budget events", () => {
    const e: Event = { type: "budget_exhausted", ts: Date.now(), run: "r1", detail: { spent: 1.5, cap: 1.0 } };
    expect(isBudgetEvent(e)).toBe(true);
    expect(isBudgetEvent({ type: "tool_failure", ts: 0, run: "r1", detail: {} } as Event)).toBe(false);
  });
});
