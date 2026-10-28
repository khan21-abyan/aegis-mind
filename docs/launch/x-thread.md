# X thread (6–8 tweets)

> Post as one thread, no edits after launch. Each tweet under 280 chars.

## Tweet 1 — hook

Your agent died at 03:41 making its 14,000th API call.

Mine didn't — and I can prove it in 60 seconds.

Aegis Mind: a local supervisor kernel that halts runaway agents and prescribes the recovery through outages.

Thread 🧵

## Tweet 2 — governance kernel

1/ Governance kernel.

Every API call your agent makes passes through a local proxy. Set a budget cap — when it's hit, the kernel answers 429 and the run STOPS.

Overnight runs stop being a blank check.

## Tweet 3 — failure recovery

2/ Failure recovery.

Upstream 502 or timeout? The kernel logs a model_error and prescribes the heal policy — retry with backoff. Your agent's client loop executes it, `recovered` streams live. Instead of dying at turn 14,000, the run comes back green.

## Tweet 4 — time-travel

3/ Time-travel checkpoints.

Checkpoint state snapshots are saved locally when your integration creates them. Restore one of those recorded snapshots through the checkpoint API.

Pass the state you need to snapshot; Aegis Mind doesn't capture or rewind hidden agent state automatically. Debugging agents gets a durable local checkpoint log.

## Tweet 5 — dashboard

4/ The "brain" dashboard.

A live SSE view of every forward, error, heal, and halt — as it happens.

You finally SEE what your agent is doing at 3am instead of guessing from the invoice.

## Tweet 6 — install

5/ Install is one line:

npx aegis-mind

Node 20+. 100% local: no telemetry, no account, no phoning home. The only traffic through it is the LLM calls you were making anyway.

MIT core: github link in bio/repo.

## Tweet 7 — honest pricing close

6/ Pricing, honestly:

Core (kernel, healing, checkpoints, proxy, dashboard) = free, MIT.

Pro ($29, multi-model failover chains) = a signed license file verified OFFLINE on your machine.

No license server. No phoning home. Ever.

## what NOT to do

- No fake numbers: never tweet invented uptime, savings, or call counts beyond the true story in tweet 1.
- No astroturfing: no alt accounts, no reply-farming your own thread, no engagement pods.
- One launch max per account: if the thread flops, don't delete-and-repost spam; wait and launch once with the GIF ready.
- Don't buy impressions or replies; X paid-boost rules unchanged.
