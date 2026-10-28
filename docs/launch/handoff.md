# Aegis Mind — Launch Handoff

Repo: https://github.com/khan21-abyan/aegis-mind (public; local clone `aegis-mind/`). Remote `master` currently ends at `d55c384`, with tags `v0.1.0` and `v1.0.0`.

## Assets to protect
- Signing private key: `C:\Users\abuhu\.aegis-keys\private.pem`. Back it up to a second private location. Losing it means no new Pro licenses can be issued without rotating the public key and republishing the CLI. If leaked, rotate it and republish.
- Two GitHub PATs were pasted into chat during setup. Revoke both at GitHub → Settings → Developer settings → Personal access tokens. Never paste tokens into chat.

## Current release state

1. **GitHub:** https://github.com/khan21-abyan/aegis-mind is public. The empty duplicate `techmissionofficial/aegis-mind` was created during auth troubleshooting; it is not the launch repo and can be deleted by its owner.
2. **npm:** `@abyan/aegis-mind@1.0.0` is published at https://www.npmjs.com/package/@abyan/aegis-mind. Install/run with `npx @abyan/aegis-mind`; the executable is `aegis-mind`. The unscoped name was rejected by npm as too similar to existing `aegismind`. Verified npm metadata, latest dist-tag, clean registry install and CLI validation smoke test. `@aegis-mind/core` is bundled and not separately published.
3. **Gumroad:** Aegis Mind Pro License is live for $29 at https://abyanookhan.gumroad.com/l/frwvl. The saved content tells buyers that license fulfillment is manual and not instant. The live product summary and description disclose the manual, individual license delivery.
   - For each order, run: `node tools/mint-license.mjs --private C:/Users/abuhu/.aegis-keys/private.pem --email <buyer> --plan pro --print`
   - Deliver the two-line signed license through Gumroad. Buyer saves it to `.aegis/license.txt` in the directory where they run Aegis Mind.
4. **GitHub Release:** draft release for tag `v1.0.0` is saved. Review and publish it from GitHub Releases when ready. Note that the final scoped-package correction at commit `d55c384` is later than the existing `v1.0.0` tag; don't move existing tags without a deliberate versioning decision.
5. **Marketing:** prepared launch copy is in `docs/launch/show-hn.md`, `reddit-localllama.md`, and `x-thread.md`. Human should review community rules and post from their own accounts; reply to comments personally.

## Product claims audited
- Ships: budget/loop halts, event journal, explicitly supplied checkpoint snapshots/restores, loopback-only proxy and SSE dashboard, offline Ed25519 license verification, MIT core.
- Does not ship: server-side automatic retries, real token-cost accounting, multi-agent supervision, Dashboard Pro panels.
- Pro adds multi-model failover-chain configuration only. The agent's client loop executes retry/failover policies.
- Before expanding commercial claims, review licensing posture: the CLI that gates Pro is MIT-licensed, so users can remove the gate from their copies. Never promise tamper-proof licensing or legal exclusivity.

## Final verification
- Tests: 27/27 passing; strict TypeScript check passes.
- Scoped package: 51 files, core bundled; clean registry install and CLI validation smoke test passed.
- Demo GIF script: `docs/launch/demo-gif-script.md` (≤60s). Film only real behavior; don't fake results.
