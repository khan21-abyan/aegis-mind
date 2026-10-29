# Show HN post

> Title: `Show HN: Aegis Mind – a local supervisor kernel that halts runaway AI agents and recovers them through API outages`
>
> First comment (the launch comment) below. Keep the title factual; HN punishes hype.

## Launch comment

Your agent died at 03:41 making its 14,000th API call. Mine didn't — and I can prove it in 60 seconds (GIF in the repo README).

Aegis Mind is a supervisor kernel for autonomous agents. It runs locally as an OpenAI-compatible proxy: you point your agent at `localhost:4242`, and every call passes through a governance kernel before it reaches the upstream API.

What the kernel does:

- Budget halt: set a spend cap, the kernel answers 429 and the run stops instead of burning money overnight.
- Loop detection: recent turns are hashed; repeated identical payloads inside a window get blocked.
- Automatic healing in the proxy: upstream failures (429/5xx/timeouts) are classified by the kernel and the proxy recovers them itself — one retry on the same model with backoff (honoring `Retry-After`), then a configured failover chain when Pro is licensed. Your agent's client doesn't change; `recovered` is journaled.
- Checkpoints: the full event journal lands on disk; snapshot and restore a run to any point (time travel).
- Dashboard: an SSE "brain" view streaming every forward, error, heal, and halt live.

Design constraints I held to: Node >= 20, only node:http/node:crypto/node:fs/node:path, zero runtime dependencies in the core package, and zero cloud — no telemetry, no license server, no phoning home. The only network traffic is the LLM traffic you're proxying anyway.

Open core: the kernel/healing/checkpoints/proxy/dashboard core is MIT. A Pro tier ($29, offline-verified signed license) adds the multi-model failover chain config (up to 5 models).

Install: `npx @abyan/aegis-mind`

Repo: [link]. Happy to answer questions about the kernel design, the healing policy model, or why I refuse to add a license server.

## what NOT to do

- No fake numbers: no invented uptime, savings, or "14,000 calls" style figures beyond the true story already in the copy.
- No astroturfing: no alt accounts replying to yourself, no coordinated upvotes, no friend-pile-ons.
- One launch max: a Show HN post is a one-shot; if it doesn't take, don't repost variants for at least a long cooldown. HN rules on self-promotion and reposts apply unchanged.
- Don't argue with moderation or vote-brigade critics; answer technical questions only.
