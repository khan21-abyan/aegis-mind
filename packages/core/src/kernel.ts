import { Event, TurnContext, PolicyDecision } from "./types.js";

export interface KernelOptions { budgetCap: number; loopWindow?: number; maxTurns?: number; }
export class Kernel {
  private hashes: string[] = [];
  private stopped = false;
  constructor(private o: KernelOptions) {}
  observe(ev: Event) { if (ev.type === "call_fwd") this.push(String(ev.detail.hash ?? "")); if (ev.type === "budget_exhausted") this.stopped = true; }
  private push(h: string) { this.hashes.push(h); if (this.hashes.length > 512) this.hashes.shift(); }
  reserve(ctx: TurnContext, cost: number): boolean {
    if (this.stopped || !Number.isFinite(cost) || cost < 0 || ctx.spent + cost > this.o.budgetCap) return false;
    ctx.spent += cost;
    return true;
  }
  admit(ctx: TurnContext, _carried: number): PolicyDecision {
    if (this.stopped || ctx.spent >= this.o.budgetCap) return { allow: false, action: "halt", reason: "budget_exhausted" };
    if (this.o.maxTurns && ctx.turn > this.o.maxTurns) return { allow: false, action: "halt", reason: "run_started_max_turns" };
    if (this.o.loopWindow && this.hashes.length >= this.o.loopWindow) {
      const w = this.hashes.slice(-this.o.loopWindow);
      if (w.every(x => x === w[0] && x !== "")) return { allow: false, action: "block", reason: "loop_detected" };
    }
    return { allow: true, action: "pass", reason: "ok" };
  }
}
