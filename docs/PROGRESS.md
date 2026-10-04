# Progress

Updated after every milestone. Live site: https://habeas-stellar.vercel.app · Repo: https://github.com/Prashant-Mishra-12569/habeas

## Where we are (Oct 4, 2026)

| Phase | Status |
| --- | --- |
| 1. Tools, repo, spikes | Done. All four spikes passed, including S3 in a real Freighter wallet. |
| 2. Contract | Done. 54 tests, verified build deployed on testnet, every ending run on-chain. |
| 3. Web app, styleguide, asset check | Done. Styleguide approved, redesign live, works from 320 px phones to desktop. |
| 4. Case pages | Done. `/case/[id]` (form, timeline with every transaction, countdown, free settle, free answer), `/me`, `/issuer`, `/review`. |
| 5. Try it live | Done. With or without a wallet (phones use the no-wallet path), both endings, case file and share link. Playwright runs it on testnet. |
| 6. x402 agent check | Done. `/api/v1/check/[asset]` paid with x402 (0.001 testnet USDC), signed answers, `examples/agent-check.ts`, `/developers`. Paid on testnet by the example and by Playwright. |
| 7. Telegram alerts | Done. @habeas_alerts_bot runs 24/7 on Railway (volume at `/data`); case 42 sent a message for every step to Prashant's phone. |

## What's left

**Next:**

- Phase 10 (Prashant): deck, video, X post.

**Needs Prashant:**

- GitHub Actions secrets (optional, so CI also runs the paid check): `HABEAS_ATTEST_SECRET` (same value) and `AGENT_SECRET` (`stellar keys secret habeas-agent`, a testnet account with 4.99 testnet USDC; each CI run spends 0.001).
- Spanish read by a native speaker (site, README.es.md, bot messages); a phone test with a friend who doesn't use crypto; the video in your own voice.

**Small items to decide or do later:**

- The USBDCP issuer has now taken tokens back 37 times (latest Oct 3, 2026), not only on Sep 19. The hero still tells the Sep 19 story, which is accurate; we could add "and 36 more since" once we decide on wording.
- Optional: turn off the Vercel Toolbar in the Vercel project settings. Its loader reads `document.cookie`, which Chrome lists as a performance "issue" in DevTools. The other one comes from Next.js itself (`next-instant-navigation-testing` check). Neither is our code and neither affects visitors.
- Optional (from the plan): the Stellar dev skill and Raven MCP for Claude Code. Not installed; we've worked from the SDK sources and Stellar's docs directly.

## Phase 9: logo, SEO and final polish (Oct 4)

- Logo: Prashant's mark (`apps/web/public/brand/habeas-logo.png`) in the header and footer, favicon, app and Apple icons, web manifest (with a maskable icon), stellar.toml (`ORG_LOGO`, DEMOUSD `image`), README and styleguide. `scripts/make-brand.mjs` makes every size from the one file. On Carbon the navy pillars vanished, so Carbon uses a variant with the pillars lifted toward slate.
- SEO: per-page titles and descriptions in EN/ES; case and token pages describe real chain data ("Case #20: Taken back"); canonical links; Open Graph and X cards; share images drawn like the site (site card, case card with the live status stamp, token card with the issuer's settings); sitemap, robots (API excluded), manifest, schema.org `WebApplication` data, no auto phone links on iOS. `e2e/seo.spec.ts` checks it.
- Evidence page: now lists the website-run cases (7, 8, 9, 12, 19, 20) with a link per step, which outlive RPC's 7-day event window, and the x402 setup and payments.
- Full Playwright suite on the final build: 80 passed, 1 skipped (the paid check, which needs `AGENT_SECRET`).

## Phase 9: accessibility (Oct 4)

- Lighthouse accessibility: 100 on all ten main pages (was 98 on home, 100 elsewhere).
- Fixed: the wordmark's carbon copies were two extra hidden copies of "Habeas", so the link's accessible name didn't match its text; they're now drawn with `text-shadow`, same look. The hero form's title skipped a heading level (h1 to h3).
- Found beyond Lighthouse with axe on desktop and in Carbon: the "how a case works" steps dimmed with opacity fell to 2.5:1 contrast; steps not reached yet now use the muted ink colour (AA) instead.
- Reduced motion: rows and stamps that were scheduled to animate during hydration still ran with their delays for visitors with "Reduce motion" on (check page rows were invisible for ~1 s). They now remount in their final state as soon as the browser reports the setting; measured: all rows visible at +100 ms.
- `e2e/a11y.spec.ts`: axe WCAG 2.x A/AA on 10 pages × (phone Paper EN, phone Carbon ES, desktop Paper EN), in CI.

## Phase 7: Telegram alerts (Oct 4)

- `apps/alerts`: grammy 1.46 bot, Node 24 running TypeScript directly (no build step). Reads Habeas events from RPC `getEvents` every 20 s, following the cursor across RPC's bounded scan windows; keeps watchers and the cursor in `data/state.json` so a restart doesn't resend alerts; after a week offline (RPC's retention) it restarts from the latest ledger.
- `/watch`, `/stop`, `/cases`, `/start`, in English or Spanish by the person's Telegram language. Holders hear every step; the reviewer hears when a decision is needed (silence means the holder wins); the issuer hears answers, decisions and closings. One message per chat per event.
- `--dry-run` prints the messages without Telegram. Replayed Prashant's cases 19 and 20, and caught case 25 live as `scripts/test-free-answer.mjs` ran it (opened, answered, decided, settled, each within one poll).
- 8 tests with `node --test` on real events from cases 19 and 20 (saved as XDR in `src/fixtures`, since RPC drops them after ~7 days) plus a live contract read. CI: `.github/workflows/alerts.yml`, which also replays the last day of events.

## Phase 6: x402 agent check (Oct 4)

- `GET /api/v1/check/CODE-ISSUER?network=` behind `withX402` (`@x402/next` 2.28.0): exact scheme, `stellar:testnet`, 0.001 USDC (Circle's testnet USDC contract), paid to a treasury account, verified and collected by the x402.org facilitator, which also pays the fee. The answer is the asset check JSON plus an ed25519 signature over sha256 of a prefixed canonical JSON; the key is published at `/api/v1/key`.
- Charged only for answers: `withX402` settles only when the handler succeeds. A bad asset (400), an unknown one (404) or a Stellar outage (502) costs nothing; checked on testnet (balance unchanged, no transaction).
- `examples/agent-check.ts`: a buyer in ~50 lines with `@x402/fetch`; pays, verifies the signature against the pinned key, prints the verdict. Runs on Node 22.18+ with no build step.
- `/developers` (EN/ES): request, price, what the answer says, how it's signed, how to try it, and the paid checks so far, read live from Horizon.
- `scripts/setup-x402.mjs` made the treasury, signing and example agent accounts (agent bought 5 testnet USDC on the testnet exchange). Tests: 3 Vitest (canonical JSON, signature, tampering), Playwright 402 contract and a paid round trip. Payments in `docs/EVIDENCE.md`.
- `@x402/stellar` depends on Stellar SDK 16, which pulled an axios with known advisories; an npm override pins axios 1.20 (`npm audit` clean apart from `eslint-config-next`'s lint-time globbing, which has no fix upstream).

## Phases 4 and 5 (Oct 4)

- Sources for the home page story (U.S. Bank's announcement, Tellus Cooperative's analysis, the two Horizon operations) under the hero, each checked to resolve, with the language noted.
- Case timeline from contract events (`src/lib/timeline.ts`): each step's ledger is estimated from the case record's timestamp and corrected against a real ledger's close time, so a step costs ~2 RPC calls instead of scanning days. RPC keeps events ~7 days; older steps show "link no longer kept" and why. 5 Vitest tests on real cases.
- Server actions: settle (relayer pays, anyone can trigger; waits out a few seconds of ledger lag and retries once), demo reviewer decision, test-wallet funding (Friendbot, relayer fallback), wallet-signed build/submit for the issuer and reviewer pages (submit accepts only Habeas `open_case`, `decide`, `withdraw`; a call needing someone else's signature is refused at build with a plain message). Best-effort rate limits on demo endpoints.
- Try it live: a throwaway key in the tab's session storage for visitors without a wallet (SDK loaded only then), five steps, the second ending with a countdown, case file links. Found and fixed with the e2e test: the countdown aimed at the exact deadline second, but deadlines run on ledger time and a transaction lands in the next ledger; countdowns now add a ledger of margin and short waits say "about N seconds".
- Tested on testnet: `scripts/test-free-answer.mjs` (case 9, all four steps found), `scripts/test-wallet-roles.mjs` (case 12, issuer and reviewer pages' API, refusals), case 7 settled by default, and `e2e/try-live.spec.ts` (full no-wallet session on a phone, both endings, then /me). Records in `deployments/testnet-web.json` and `docs/EVIDENCE.md`.

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
