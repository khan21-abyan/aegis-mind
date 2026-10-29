# Aegis Mind Pro License — fulfillment paused

This offer is currently unpublished. The proxy now performs automatic failover end-to-end (one same-model retry, then the configured chain, covered by integration tests), but do not sell or fulfill Pro licenses until the Gumroad page copy is refreshed to describe the real behavior and the offer is republished.

## Fulfillment

This Pro license is issued individually and requires manual fulfillment. A license is not generated automatically by this download page. After purchase, contact the creator through your Gumroad receipt and include the purchase email and order details. The seller will provide a signed license file separately.

## Install

Place the received two-line license text in `.aegis/license.txt` in the directory where you run Aegis Mind. The license unlocks Pro multi-model failover-chain configuration (`AEGIS_FAILOVERS`, up to 5 models).

The proxy itself performs the recovery: it retries once on the same model, then walks the failover chain automatically — no client-loop changes are needed. Keep your license private; it is signed for offline verification on your machine.

## Requirements

- Node.js 20 or later
- Aegis Mind CLI installed with `npx @abyan/aegis-mind`
- OpenAI-compatible upstream API configured for your agent
