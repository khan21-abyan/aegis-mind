# Aegis Mind — Launch Handoff (human passes only)

Repo: `aegis-mind/` (this machine). Everything technical is DONE and verified green (27/27 tests, strict tsc, npm pack clean, signing pipeline smoke-verified).

## Assets you own but must protect
- Signing private key: `C:\Users\abuhu\.aegis-keys\private.pem` — **back this up NOW** (copy to a second private location). Losing it means the pubkey baked into the shipped CLI mismatches and NOBODY can be issued a Pro license (regenerating = re-shipping a CLI). If leaked, roll: new pair, one-line change in `packages/cli/src/keys.ts`, rebuild, re-publish.
- The public key in the repo matches this private key (verified: minted license parses to `scope: pro` offline).

## Step-by-step (in this exact order)

1. **GitHub account** (skip if you have it) → create repo `aegis-mind` PUBLIC. Local then: `git remote add origin <url> && git push -u origin master`. (I do the push if a logged-in `gh` is present — see below.)
2. **npm account** → `npm login` in `aegis-mind/` (2FA), then `npm publish --access public`. Palette note: publish ships root package `aegis-mind` (bin `npx aegis-mind`) and bundles core. The `@aegis-mind/core` scope publish — only do it if you own the npm org `aegis-mind`; otherwise publish CLI alone and change root dep to bundled path (prepack already bundles core; ask me and I adjust the manifest in one pass).
3. **Gumroad account** → product "Aegis Mind Pro License Key", $29. Fulfillment = run:
   `node tools/mint-license.mjs --private C:/Users/abuhu/.aegis-keys/private.pem --email <buyer> --plan pro --print`
   and paste the 2 base64 lines into Gumroad's delivery message with install instructions. Consider a tiny `IMPORTANT: delivery is a license file — save as .aegis/license.txt` paste-in.
4. **README top of Buy section** should point to the Gumroad URL (tell me the URL and I push a README edit — 1 line).
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

## Unfinished-but-blocking-nothing
- Demo GIF: script is filmable (`docs/launch/demo-gif-script.md`, ≤60s) — you film it with the CLI on this machine; I can drive the screen if asked.
- `--help` flag currently falls through to boot (cosmetic; warn-continue is the behavior).
