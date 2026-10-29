# Pricing

## Free — MIT core

Everything in `packages/core`, forever free under the MIT license:

- Governance kernel (budget caps, loop detection, halt decisions)
- Healing policies (retry with backoff)
- Time-travel checkpoints (journal + snapshot/restore)
- OpenAI-compatible local proxy
- Single-agent dashboard (live SSE event stream)

## Pro — sales paused (copy refresh pending)

The proxy now performs automatic failover end-to-end: after one same-model retry, it walks the configured `AEGIS_FAILOVERS` chain (up to 5 models), with each attempt reserving budget. The behavior is covered by integration tests. The Gumroad offer stays unpublished until its page copy is updated to describe the now-real behavior; do not purchase or advertise until it is republished.

## The honest line

All project code, including the CLI license gate, is MIT-licensed. The optional signed license file is not account- or machine-bound and is transferable; the gate is a convenience, not tamper-proof enforcement. There is no activation server or license-server call.
