# Pricing

## Free — MIT core

Everything in `packages/core`, forever free under the MIT license:

- Governance kernel (budget caps, loop detection, halt decisions)
- Healing policies (retry with backoff)
- Time-travel checkpoints (journal + snapshot/restore)
- OpenAI-compatible local proxy
- Single-agent dashboard (live SSE event stream)

## Pro — $29 (one-time, per developer)

For agents you run unattended:

- Multi-model failover chains config (`AEGIS_FAILOVERS` — the heal policy prescribes failover-first actions across your models; your client loop executes them)

## The honest line

Licenses are **offline-verified** with a signed Ed25519 signature checked on your machine. There is no account server, no activation server, and **no phoning home — ever**.
