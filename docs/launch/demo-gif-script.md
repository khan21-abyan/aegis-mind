# Demo GIF script — 60 seconds, 10 panels

> Target: one continuous screen recording, ≤ 60s total, cut to the panel timings below.
> Record at 1280×800, terminal font ≥ 14pt, dashboard on the right half.
> Every on-screen caption is 3–5 words. Do not fabricate results: the run must actually do what each panel shows.

| # | Time | Action | On-screen text | Expected visual |
|---|------|--------|----------------|-----------------|
| 1 | 0:00–0:04 | Type `npx @abyan/aegis-mind` in a clean terminal and hit enter | `npx @abyan/aegis-mind` | Bare prompt; command typed; enter |
| 2 | 0:04–0:10 | Banner prints; hold | `AEGIS MIND online` | ASCII banner, proxy `:4242`, dash `:4343`, mode line |
| 3 | 0:10–0:18 | Open dashboard in browser, let an agent run a few turns | `your agent's brain, live` | Dashboard pulsing: events streaming in, turns ticking up |
| 4 | 0:18–0:24 | Kill the stub upstream process (Ctrl+C in its terminal) | `upstream killed` | Upstream terminal shows interrupt; dashboard still live |
| 5 | 0:24–0:30 | Next agent call hits the dead upstream | `502 — but still alive` | Red `model_error` event on dashboard; agent terminal shows 502 body |
| 6 | 0:30–0:36 | Heal policy waits, client retries | `retrying with backoff…` | Retry visible in event stream; wait tick between attempts |
| 7 | 0:36–0:44 | Restart stub upstream; retry succeeds | `recovered ✓` | `recovered` event, dashboard row flips green, agent gets 200 |
| 8 | 0:44–0:52 | Let spend hit the budget cap mid-run | `budget halt — stopped` | Kernel returns 429; dashboard shows `budget_exhausted`; run ends, not dies |
| 9 | 0:52–0:58 | Show the journal: `code .aegis/` in VS Code | `the journal — every decision` | `events.jsonl` tail + `snap-N.json` snapshot files visible |
| 10 | 0:58–1:00 | End card hold | `aegis-mind · npx @abyan/aegis-mind` | Logo/banner + install one-liner, 2s hold |

## Production notes

- Kill/restart the stub upstream from a second terminal that stays visible in frame for panels 4–7.
- Panel 8 needs a low `AEGIS_BUDGET` so the halt happens naturally on camera — do not fake the 429.
- Panel 9 shows the real journal on disk: `code .aegis/` — tail `events.jsonl` and the `snap-N.json` snapshots taken earlier in the run are plainly visible; nothing to fake and nothing shipped-but-undocumented is implied.
- If a panel misbehaves, re-record the whole take; do not splice in staged output.
- Total must stay ≤ 60s: if over, tighten holds on panels 2 and 10 first.
