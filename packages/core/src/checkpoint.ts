import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import type { Event } from "./types.js";

export class CheckpointLog {
  private root: string;

  constructor(rootDir?: string) {
    this.root = join(rootDir ?? process.cwd(), ".aegis");
  }

  static open(rootDir?: string): CheckpointLog {
    const log = new CheckpointLog(rootDir);
    mkdirSync(log.root, { recursive: true });
    return log;
  }

  private path(): string {
    return join(this.root, "events.jsonl");
  }

  snapFile(n: number): string {
    return join(this.root, `snap-${n}.json`);
  }

  append(ev: Event): void {
    appendFileSync(this.path(), JSON.stringify(ev) + "\n");
    this.em.emit("event", ev);
  }

  snapshot(obj: unknown): number {
    let n = 0;
    try {
      n = JSON.parse(readFileSync(join(this.root, "snaphead.json"), "utf8")).n ?? 0;
    } catch {
      n = 0;
    }
    const next = n + 1;
    writeFileSync(join(this.root, "snaphead.json"), JSON.stringify({ n: next }));
    writeFileSync(this.snapFile(next), JSON.stringify({ at: Date.now(), state: obj }));
    return next;
  }

  private records(): unknown[] {
    const lines = readFileSync(this.path(), "utf8").trim().split("\n").filter(Boolean);
    const out: unknown[] = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line));
      } catch {
        // skip malformed line
      }
    }
    return out;
  }

  list(): number[] {
    try {
      return this.records()
        .map((r) => r as { type?: string; detail?: { snap?: number } })
        .filter((e) => e.type === "checkpoint")
        .map((e) => e.detail?.snap)
        .filter((s): s is number => typeof s === "number");
    } catch {
      return [];
    }
  }

  restore(n: number): unknown {
    return JSON.parse(readFileSync(this.snapFile(n), "utf8")).state;
  }

  replay(from: number): Event[] {
    try {
      return this.records()
        .map((r) => r as Event)
        .filter((e) => {
          const snap = (e as { detail?: { snap?: number } }).detail?.snap;
          return e.type === "checkpoint" && typeof snap === "number" && snap >= from;
        });
    } catch {
      return [];
    }
  }

  em = new EventEmitter();
}
