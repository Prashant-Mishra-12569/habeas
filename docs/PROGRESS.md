# Progress

Updated after every milestone. Live site: https://habeas-stellar.vercel.app · Repo: https://github.com/Prashant-Mishra-12569/habeas

## Where we are (Oct 3, 2026, end of day)

| Phase | Status |
| --- | --- |
| 1. Tools, repo, spikes | Done. All four spikes passed, including S3 in a real Freighter wallet. |
| 2. Contract | Done. 54 tests, verified build deployed on testnet, every ending run on-chain. |
| 3. Web app, styleguide, asset check | Done. Styleguide approved, redesign live, works from 320 px phones to desktop. |
| 4. Case pages | Started: public `/case/[id]` and the free answer (proven with Freighter). Issuer and reviewer pages not built. |
| 5. Try it live | Started: the Freighter path works end to end on the live site. No-wallet path not built. |
| 6. x402 agent check | Not started. |
| 7. Telegram alerts | Not started. |

## What's left

**Next phases (not started, by Prashant's call):**

- Phase 4: issuer page (open a case, file fingerprint computed in the browser), reviewer queue and decide, `/me` for a connected wallet, case timeline from contract events, settle button.
- Phase 5: Try it live without a wallet (temporary in-browser key funded by Friendbot; this is the phone path), the demo reviewer deciding, the "what if I don't answer" second ending, a shareable case file, rate limits on the demo endpoints.
- Phase 6: x402 paid machine check (`/api/v1/check/[asset]`, signed answers, `examples/agent-check.ts`).
- Phase 7: Telegram alerts (Prashant creates the bot with @BotFather).
- Phase 9 polish: Lighthouse accessibility ≥ 95, Spanish reviewed by a native speaker, Playwright running the full case flow on testnet.
- Phase 10: README in Spanish, demo video, 5-slide deck, X post.

**Small items to decide or do later:**

- The USBDCP issuer has now taken tokens back 37 times (latest Oct 3, 2026), not only on Sep 19. The hero still tells the Sep 19 story, which is accurate; we could add "and 36 more since" once we decide on wording.
- Optional: turn off the Vercel Toolbar in the Vercel project settings. Its loader reads `document.cookie`, which Chrome lists as a performance "issue" in DevTools. The other one comes from Next.js itself (`next-instant-navigation-testing` check). Neither is our code and neither affects visitors.
- Optional (from the plan): the Stellar dev skill and Raven MCP for Claude Code. Not installed; we've worked from the SDK sources and Stellar's docs directly.

## Phase 3 and early 4/5 (Oct 3)

- Live on Vercel; serves `/.well-known/stellar.toml` (SEP-1, CORS open) for DEMOUSD.
- Demo asset issuer locked for good (`scripts/lock-issuer.sh`): spare XLM to the relayer, home domain set, on-chain data entry `habeas` pointing to the contract, then master weight 0 and the reviewer removed as signer. A classic clawback is refused; minting through Habeas still works. If DEMOUSD ever needs a redo, use a fresh asset issuer.
- Design: Paper (default) and Carbon themes, English default and Spanish, form-native details (tick boxes, perforation, pen circle). Decisions in `docs/DESIGN-NOTES.md`.
- Pages, all reading Stellar live: home, `/check`, `/check/[asset]`, `/case/[id]`, `/try`, `/evidence`, `/styleguide`.
- Asset check (`src/lib/asset-check.ts`): flags, signers, issuer operation scan (capped at 2,000 and says so), take-back memos, who runs the token contract (none / issuer / another contract / verified Habeas), back door mode (key off / co-signed / open). Four verdicts, including "Can't be frozen or taken back". 9 Vitest tests on real mainnet and testnet.
- Free answer: the server simulates `appeal` with the relayer as source, the browser signs only the preimage (Freighter `signAuthEntry`), the server rebuilds the call, attaches the signature and the relayer submits and pays. The relayer never relays anything the browser built except a DEMOUSD trustline. Proven by script (case 7) and by Prashant in Freighter on the live site (case 8, tx `8d2c8c93`). Freighter signed the new CAP-71 `addressV2` preimage as is.
- Mobile: audited every page with Playwright device emulation at 320, 360, 390, 412, 768, 1024 and 1440 px, in English and Spanish, Paper and Carbon. Fixed the header overflow at 320 px, 40 px switches, oversized type, the comparison layout, tick-box wrapping, dimmed steps on phones, take-back list layout, long addresses, and a hydration error that hit visitors with "Reduce motion" on. CI now runs `e2e/layout.spec.ts` (7 pages × 4 sizes).
- Tooling choices: TypeScript 5.9.3 (what create-next-app 16.3.8 installs), `@stellar/freighter-api` 6.0.1 directly instead of the multi-wallet kit (the kit pulled Trezor/Ledger/WalletConnect; it can return if we add more wallets), GitHub Actions on checkout/setup-node v7 (Node 24).

## Phase 2: the contract (Oct 3)

- `contracts/habeas`: open, appeal, decide, settle, withdraw, emergency take back / close, mint, approve holder, reviewer change (issuer + old + new reviewer), admin handover (issuer + reviewer, 7-day public delay, blocked while a case is active), reads, `bump`. Reference: `docs/SPEC-cases.md`.
- Decisions not in the plan: a short public statement (≤ 280 bytes) on every case; `emergency_close` for a case that's already open; every closing path unfreezes; take back is `min(amount, balance)`; enums stored by name.
- 54 tests against the real SAC, including a 2-of-3 reviewer panel signed with real ed25519 keys. Mutation checks confirm the tests catch removed signatures and flipped outcomes. Clippy clean.
- Verified build: tag `v0.1.0`, GitHub Actions release with a SEP-55 attestation; the testnet contract runs that exact wasm. `scripts/verify-build.mjs` runs Stellar Lab's Verified Build steps and passes. StellarExpert shows no badge (its intake drops submissions, stellar-expert/soroban-build-workflow#9, and only covers mainnet).
- Testnet: `scripts/deploy-testnet.sh`, `scripts/run-demo-cases.mjs` (all six endings plus three refusals), `docs/EVIDENCE.md` generated from the results. First local-build deployment archived in `deployments/archive/local-build/`.

## Phase 1: tools, repo, spikes (Oct 3)

- Stellar CLI 28.1.0, GitHub CLI 2.102.0, `wasm32v1-none`. No Visual Studio Build Tools on this PC, so Rust here uses the GNU toolchain (`rustup override`, local only).
- `habeas` has its own git repo; the home folder is a separate, untouched repo.
- Spikes S1–S4 passed (`spikes/RESULTS.md`): contract as SAC admin can freeze, unfreeze, take back and mint; take back works on contract balances; free answer (now also confirmed in Freighter); the classic back door exists after `set_admin` and is closed by locking the issuer account.
- Design change from S4: the contract's issuer role is a separate operator key; the asset's classic issuer account gets locked.
- The two U.S. Bank operations verified on mainnet Horizon.
