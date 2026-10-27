import { Event } from "./types.js";

export interface HealResult {
  type: "retry" | "failover" | "interrupt" | "halt" | "resume";
  waitMs: number;
  failover?: boolean;
}

export class Heal {
  constructor(private o: { failovers: string[] }) {}
  decide(ev: Event, attempt: number): HealResult {
    // Clamp: attempt 0 behaves like attempt 1 (first attempt is never a duplicate retry).
    const n = Math.max(1, attempt);
    switch (ev.type) {
      case "rate_limited": return { type: "retry", waitMs: Math.min(30_000, 2 ** n * 1000) };
      case "model_error": return ((n >= 2) && (this.o.failovers.length > 0)) ? { type: "failover", waitMs: 0, failover: true } : { type: "retry", waitMs: 1000 };
      case "loop_detected": return { type: "interrupt", waitMs: 0 };
      case "budget_exhausted": return { type: "halt", waitMs: 0 };
      case "tool_failure": return n <= 3 ? { type: "retry", waitMs: 500 } : { type: "halt", waitMs: 0 };
      default: return { type: "resume", waitMs: 0 };
    }
  }
}
