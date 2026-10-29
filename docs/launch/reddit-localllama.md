# Reddit launch post — r/LocalLLaMA

> Draft for one launch. Post as a text post with the GIF linked/embedded. Title options below; pick one.

## Title options

1. Your agent died at 03:41 making its 14,000th API call. Mine didn't — and I can prove it in 60 seconds.
2. I built a local "supervisor kernel" that halts runaway agents on budget and recovers them through API outages automatically. MIT core, zero cloud.

## Body

My agent died at 03:41 making its 14,000th API call of an overnight run. Not because the model failed — because nothing was watching the loop it had fallen into. I woke up to the bill and a dead run.

So I built Aegis Mind: a supervisor kernel that sits between your agent and its model API. It's a local OpenAI-compatible proxy, so you point your agent at `localhost:4242` and everything it does passes through the kernel.

What it does, concretely:

- **Halts on budget.** Set a spend cap; the kernel returns 429 and stops the run instead of letting it burn.
- **Halts on loops.** Hashes recent turns; identical payloads repeated inside a window get caught and blocked.
- **Heals automatically, inside the proxy.** Upstream 502s/timeouts/429s are classified by the kernel; the proxy retries once on the same model with backoff (Pro: then walks a failover chain) — your agent's client doesn't change, and the run recovers instead of dying.
- **Checkpoint snapshots.** Events are journaled to disk; integrations can explicitly snapshot supplied state and restore a recorded snapshot. Hidden agent state is not captured automatically.
- **Live "brain" dashboard.** An SSE dashboard streams every forward, error, heal, and halt as it happens.

Everything is 100% local. No telemetry, no account, no phoning home — the only network traffic is the LLM calls you're already making, now through the proxy.

The core (kernel, healing, checkpoints, proxy, single-agent dashboard) is MIT. There's a paid Pro tier for the multi-model failover chain config (up to 5 models) — the license is a signed file verified offline.

Install:

```sh
npx @abyan/aegis-mind
```

Node >= 20. Repo and the demo GIF in the comments — I'll be here answering questions.

## what NOT to do

- No fake numbers: never invent uptime %, savings, or benchmark results. The GIF is the proof; the story above is the true one.
- No astroturfing: one account, one post, real replies from the maintainer. No sock-puppet comments, no upvote coordination.
- One launch max per subreddit, rules unchanged: read r/LocalLLaMA's self-promo rules before posting and follow them as written.
- Don't crosspost the identical text to other subs the same day; adapt per community or wait.
