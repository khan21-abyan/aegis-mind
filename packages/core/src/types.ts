export type EventType =
  | "run_started" | "turn_started" | "call_fwd" | "call_returned"
  | "budget_exhausted" | "rate_limited" | "model_error" | "loop_detected"
  | "tool_failure" | "recovered" | "halted" | "checkpoint";

export interface Event { type: EventType; ts: number; run: string; agent?: string; detail: Record<string, unknown>; }
export interface TurnContext { run: string; agent: string; turn: number; spent: number; actions: string[]; lastHashes: string[]; }
export interface PolicyDecision { allow: boolean; action: "pass" | "block" | "transform" | "halt"; reason: string; }
export const isBudgetEvent = (e: Event) => e.type === "budget_exhausted";
