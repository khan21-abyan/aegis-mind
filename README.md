# Aegis Mind

Your agents die at night. Aegis Mind guarantees they survive. It is a local supervisor kernel that sits between your autonomous agent and its model API: a governance kernel halts runaway runs on budget, a self-healing engine retries and fails over through outages, time-travel checkpoints let you restore any run to any moment, and a live "brain" dashboard streams every decision as it happens — 100% on your machine, 100% open core.

## Quickstart

```sh
npx aegis-mind
```

Point your agent's OpenAI-compatible client at the proxy (`http://localhost:4242`) and open the dashboard (`http://localhost:4343`). During development, run the CLI straight from source:

```sh
npx tsx packages/cli/src/index.ts
```

Useful flags: `--port <n>` (proxy, default 4242), `--dash <n>` (dashboard, default 4343), `--upstream <url>` (default `https://api.openai.com`). Env: `AEGIS_BUDGET` spend cap, `AEGIS_FAILOVERS` comma-separated failover models (Pro), `AEGIS_LICENSE` license file path.

## Architecture

- **Local-first** — everything runs on your machine; state lands in `.aegis/` next to your work.
- **Zero-cloud** — no telemetry, no license ping, no phoning home, ever. The only network traffic is the LLM calls you proxy.
- **Governance kernel** — budget caps and loop detection halt a run before it becomes an invoice.
- **Self-healing** — retries with backoff and (Pro) model failover chains recover from upstream outages mid-run.
- **Time-travel checkpoints** — every run is journaled; snapshot and restore any point.
- **Live brain dashboard** — SSE-streamed view of every forward, error, heal, and halt.
- **MIT core + Pro** — `packages/core` is MIT-licensed; the CLI bundles the proxy + dashboard and gates Pro surfaces on an offline Ed25519 license. See [PRICING.md](PRICING.md).

## Requirements

- Node >= 20

## Build

```sh
npm run build
```

Compiles `packages/core` and `packages/cli` with `tsc -p` into their `dist/` folders; the `aegis-mind` bin points at `packages/cli/dist/index.js`.

## License

`packages/core` is MIT. Pro features require a license — verified offline, always.
