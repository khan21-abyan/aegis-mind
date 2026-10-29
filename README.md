# Aegis Mind

Aegis Mind helps keep autonomous agent runs observable and bounded. It is a local supervisor kernel that sits between your agent and its model API: a governance kernel halts runs on configured budget limits and detected loops, a healing engine classifies upstream failures and recovers them inside the proxy — one automatic retry on the same model, then a configured failover chain (Pro) — time-travel checkpoints let you restore recorded state, and a live dashboard streams decisions as they happen — on your machine, with an MIT-licensed core.

## Quickstart

```sh
npx @abyan/aegis-mind
```

## Pro license status

The proxy now performs automatic recovery end-to-end: one retry on the same model, then the configured failover chain, covered by integration tests. Pro sales remain paused while the Gumroad offer copy is refreshed; the offer is currently unpublished. The Pro license unlocks `AEGIS_FAILOVERS` (up to 5 failover models).

Point your agent's OpenAI-compatible client at the proxy (`http://localhost:4242`) and open the dashboard (`http://localhost:4343`). During development, run the CLI straight from source:

```sh
npx tsx packages/cli/src/index.ts
```

Useful flags: `--port <n>` (proxy, default 4242), `--dash <n>` (dashboard, default 4343), `--upstream <url>` (default `https://api.openai.com`). Env: `AEGIS_BUDGET` spend cap, `AEGIS_FAILOVERS` comma-separated failover models (Pro), `AEGIS_LICENSE` license file path.

> Note: `AEGIS_BUDGET` is per-call cost accounting with a flat per-call cost stub — treat it as a call/token-budget ceiling config; real token-cost accounting is not in core.

## Architecture

- **Local-first** — everything runs on your machine; state lands in `.aegis/` next to your work.
- **Zero-cloud** — no telemetry, no license ping, no phoning home, ever. The only network traffic is the LLM calls you proxy.
- **Governance kernel** — budget caps and loop detection halt a run before it becomes an invoice.
- **Healing (automatic, in-proxy)** — the kernel classifies each upstream failure (429/5xx/transport errors) and the proxy recovers it for you: one retry on the same model with backoff (honoring `Retry-After` on 429s), then the configured failover chain when Pro is licensed. Each attempt reserves budget; `recovered` is journaled and streamed. Non-retryable responses pass through untouched.
- **Checkpoint snapshots** — events are journaled; integrations can explicitly snapshot supplied state and restore a recorded snapshot. Hidden agent state is not captured automatically.
- **Live brain dashboard** — SSE-streamed view of every forward, error, heal, and halt.
- **MIT core** — `packages/core` and the CLI are MIT-licensed. The offline license gate is not tamper-proof and does not change the MIT grant. See [PRICING.md](PRICING.md).

## Requirements

- Node >= 20

## Build

```sh
npm run build
```

Compiles `packages/core` and `packages/cli` with `tsc -p` into their `dist/` folders; the `aegis-mind` bin points at `packages/cli/dist/index.js`.

## License

The project is MIT-licensed. An offline Ed25519 license helper exists; the Pro gate enables the failover-chain configuration in the official CLI, but the code itself is MIT and the gate is not tamper-proof. See [PRICING.md](PRICING.md).
