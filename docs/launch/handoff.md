# Aegis Mind — Launch Handoff (human passes only)

Repo: https://github.com/khan21-abyan/aegis-mind (public; local clone `aegis-mind/`). Remote currently has `master` through `8dda763` and tags `v0.1.0`, `v1.0.0`.

## Assets you own but must protect
- Signing private key: `C:\Users\abuhu\.aegis-keys\private.pem` — **back this up NOW** (copy to a second private location). Losing it means the pubkey baked into the shipped CLI mismatches and NOBODY can be issued a Pro license (regenerating = re-shipping a CLI). If leaked, roll: new pair, one-line change in `packages/cli/src/keys.ts`, rebuild, re-publish.
- The public key in the repo matches this private key (verified: minted license parses to `scope: pro` offline).
- Two GitHub PATs were pasted into chat during setup. Revoke both immediately at GitHub → Settings → Developer settings → Personal access tokens. Do not paste replacement tokens into chat.

## Step-by-step (in this exact order)

1. **GitHub is already published.** The public project is https://github.com/khan21-abyan/aegis-mind. The remote `master` currently includes the release-prep commits and `v1.0.0` tag. The empty duplicate `techmissionofficial/aegis-mind` was created during auth troubleshooting; it is not the launch repo and can be deleted by its owner. Never paste a PAT into chat.
2. **npm package name:** `aegis-mind` was rejected by npm as too similar to existing `aegismind`. Root package is `@abyan/aegis-mind@1.0.0`; the scoped name was unclaimed at the latest registry check. The executable remains `aegis-mind`, invoked with `npx @abyan/aegis-mind`. Scoped package verification is complete: tests 27/27, typecheck passed, 51-file pack with bundled core, clean temp install, and CLI validation smoke test. Publish is still blocked by npm's interactive 2FA authorization; don't create a bypass token. Publish root package with `npm publish --access public` after interactive 2FA succeeds; core remains bundled and needs no separate publish.
3. **Gumroad product is live:** Aegis Mind Pro License, $29, public URL `https://abyanookhan.gumroad.com/l/frwvl`; editor: `https://gumroad.com/products/frwvl/edit`. It is live and the Content tab has saved manual-fulfillment instructions (Gumroad confirmed “Changes saved!”). The product summary and buyer content state the license is individually issued after purchase, not instant. Fulfillment = run:
   `node tools/mint-license.mjs --private C:/Users/abuhu/.aegis-keys/private.pem --email <buyer> --plan pro --print`
   and paste the 2 base64 lines into Gumroad's delivery message with install instructions. Consider a tiny `IMPORTANT: delivery is a license file — save as .aegis/license.txt` paste-in.
   The Content tab already contains equivalent buyer instructions. The product is currently live; don't unpublish unless fulfillment cannot be provided. You may upload `docs/launch/pro-license-fulfillment.md` there as a downloadable copy too. Public page description editor was not populated because the rich-text editor wasn't writable through browser automation; summary and post-purchase content contain manual-fulfillment disclosure.
4. README now links the live Gumroad URL and discloses $29 one-time plus manual delivery.
5. **Launch day** (pick Tue–Thu 6–8am PT): post all three prepared docs:
   - `docs/launch/show-hn.md` → news.ycombinator.com/submit (Show HN; link = GitHub repo, first line of post = the hook)
   - `docs/launch/reddit-localllama.md` → r/LocalLLaMA (read sub rules; flair if needed)
   - `docs/launch/x-thread.md` → your X account
   Then: first 48h you reply to every comment (your voice; trust comes from a human, not from posted-as-bot). Repo README must be all truthful claims — the copy has already been audit-checked to survive public scrutiny.
6. **Time-boxes:** expect the first sale between day 3 and day 30. After 30 days with zero sales, do NOT kill the repo — switch hooks (I rewrite the launch docs free), because the asset compounds.

## What was already audited and is safe to claim publicly
- Kernel halts runs on budget/loops; events journaled to `.aegis/events.jsonl`; checkpoints restorable; SSE dashboard on 127.0.0.1 only; offline Ed25519 licenses; zero telemetry; MIT core.
- NOT shipped (never claim): server-side auto-retry (the agent's loop executes the prescription), real token-cost accounting, multi-agent supervision, dashboard Pro panels.
- Pro ships exactly one extra: multi-model failover chains config.
- Before selling Pro, get a legal/positioning review: the CLI package carrying the offline Pro gate is itself MIT-licensed, so a buyer can remove the gate from their copy. Do not promise tamper-proof licensing or legal exclusivity.

## Unfinished-but-blocking-nothing
- Demo GIF: script is filmable (`docs/launch/demo-gif-script.md`, ≤60s) — you film it with the CLI on this machine; I can drive the screen if asked.
- `--help` flag currently falls through to boot (cosmetic; warn-continue is the behavior).
- GitHub release draft for tag `v1.0.0` is saved. Review and publish it yourself from the GitHub Releases page when ready.
