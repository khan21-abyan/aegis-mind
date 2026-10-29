import { Event } from "./types.js";

export interface HealResult {
  type: "retry" | "failover" | "interrupt" | "halt" | "resume";
  waitMs: number;
  failover?: boolean;
  model?: string;
}

export const MAX_FAILOVERS = 5;

export class Heal {
  constructor(private o: { failovers: string[] }) {
    if (o.failovers.length > MAX_FAILOVERS) {
      throw new RangeError(`aegis-mind: at most ${MAX_FAILOVERS} failover models are supported (got ${o.failovers.length})`);
    }
  }
  get failoverCount(): number { return this.o.failovers.length; }
  decide(ev: Event, attempt: number): HealResult {
    // Clamp: attempt 0 behaves like attempt 1 (first attempt is never a duplicate retry).
    const n = Math.max(1, attempt);
    switch (ev.type) {
      case "rate_limited": {
        if (n === 1) return { type: "retry", waitMs: 2_000 };
        const model = this.o.failovers[n - 2];
        return model !== undefined ? { type: "failover", waitMs: 0, failover: true, model } : { type: "halt", waitMs: 0 };
      }
      case "model_error": {
        if (n === 1) return { type: "retry", waitMs: 1000 };
        const failoverIndex = n - 2;
        const model = this.o.failovers[failoverIndex];
        return model !== undefined ? { type: "failover", waitMs: 0, failover: true, model } : { type: "halt", waitMs: 0 };
      }
      case "loop_detected": return { type: "interrupt", waitMs: 0 };
      case "budget_exhausted": return { type: "halt", waitMs: 0 };
      case "tool_failure": return n <= 3 ? { type: "retry", waitMs: 500 } : { type: "halt", waitMs: 0 };
      default: return { type: "resume", waitMs: 0 };
    }
  }
}
