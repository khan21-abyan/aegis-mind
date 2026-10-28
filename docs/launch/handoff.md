# Aegis Mind — Launch Handoff (human passes only)

Repo: https://github.com/khan21-abyan/aegis-mind (public; local clone `aegis-mind/`). The remote is pushed through `7deca23`, with legacy tag `v0.1.0`. Root npm package metadata is `aegis-mind@1.0.0`; the release tag should be `v1.0.0` (do not move or delete the existing tag). Verified: 27/27 tests, strict tsc, npm pack includes bundled core, clean tarball install resolves the CLI and bundled core.

## Assets you own but must protect
- Signing private key: `C:\Users\abuhu\.aegis-keys\private.pem` — **back this up NOW** (copy to a second private location). Losing it means the pubkey baked into the shipped CLI mismatches and NOBODY can be issued a Pro license (regenerating = re-shipping a CLI). If leaked, roll: new pair, one-line change in `packages/cli/src/keys.ts`, rebuild, re-publish.
- The public key in the repo matches this private key (verified: minted license parses to `scope: pro` offline).
- Two GitHub PATs were pasted into chat during setup. Revoke both immediately at GitHub → Settings → Developer settings → Personal access tokens. Do not paste replacement tokens into chat.

## Step-by-step (in this exact order)

1. **GitHub is already published.** The public project is https://github.com/khan21-abyan/aegis-mind. Do not create another repository. The empty duplicate `techmissionofficial/aegis-mind` was created during auth troubleshooting; it is not the launch repo and can be deleted by its owner. The local clone has four extra commits and a local `v1.0.0` tag; from PowerShell in the `aegis-mind` folder, run `git push origin master` then `git push origin v1.0.0`. Git Credential Manager will authenticate in your browser; approve the prompt as the repo owner. Never paste a PAT into chat.
2. **npm account** → sign in to npm in a terminal (`npm login`, with your own 2FA) inside `aegis-mind/`. `npm view` found both `aegis-mind@1.0.0` and `@aegis-mind/core@0.1.0` unclaimed at the last check. `npm pack --dry-run` verified root `aegis-mind@1.0.0` and bundled `@aegis-mind/core`; a clean temp install of the tarball succeeded. After reviewing account/ownership and creating the `v1.0.0` GitHub release tag, publish the root package with `npm publish --access public`. Do not separately publish core unless intentionally supporting it as its own public package.
3. **Gumroad account** → product "Aegis Mind Pro License Key", $29. Fulfillment = run:
   `node tools/mint-license.mjs --private C:/Users/abuhu/.aegis-keys/private.pem --email <buyer> --plan pro --print`
   and paste the 2 base64 lines into Gumroad's delivery message with install instructions. Consider a tiny `IMPORTANT: delivery is a license file — save as .aegis/license.txt` paste-in.
4. After creating the Gumroad product, add its purchase URL to the README. This URL is not available yet.
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
- `v1.0.0` release tag needs to be pushed to GitHub; keep the existing legacy `v0.1.0` tag unchanged.
