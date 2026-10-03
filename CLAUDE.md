# CLAUDE.md: Habeas

Habeas gives people a fair process before a Stellar token issuer freezes or takes back their tokens: a public reason, a deadline to answer, a neutral reviewer, and "holder wins by default" if the process stalls. Built by Prashant Mishra (GitHub `Prashant-Mishra-12569`, X `@0xprashantt`) for the Find Your Way Hackathon. Submissions close **Oct 12, 2026**; we submit **Oct 11**.

At the start of a new session, read these before doing anything:

1. `docs/CONTEXT.md`: why we're building this, research, competitors, decisions already made
2. `docs/PLAN.md`: the A to Z plan; follow its phase order
3. `docs/PROGRESS.md`: what's done and what's next (create it in Phase 1 and keep it updated after every milestone)

## Non-negotiable rules

1. **No mock data, ever.** Every balance, case, transaction and number in the UI comes from Stellar (Horizon or RPC). If a call fails, show an honest error with a retry. Seed scripts create real testnet state. Prashant's last Stellar project ended up running on mock data; this one must not.
2. **Never ask for, print, log or commit secret keys.** Generate testnet accounts with `stellar keys generate --fund`. Secrets live only in `.env` / `.env.local`, which are git-ignored. Prashant's Freighter wallet is used only in the browser. If he offers a secret key, decline and explain it isn't needed.
3. **Prove before building.** Phase 1 spikes (`docs/PLAN.md` section 5) must pass on testnet first. Record tx links in `spikes/RESULTS.md`.
4. **Check versions before installing.** `npm view <pkg> version` and the crates index. Follow current library docs, not memory. Use the TypeScript version Next.js officially supports.
5. **Test against real testnet.** Contract: `cargo test` + a CLI run on testnet. Web: Playwright runs the full case flow on testnet.
6. **Stay inside this project folder** (`Documents\habeas`). Don't read or touch other files in Documents.
7. **Ask Prashant** before anything irreversible, anything costing real money (mainnet), and whenever a decision isn't covered by the plan. He prefers direct, no-sugar-coating answers.

## Environment

- Windows PC. Rust (rustup) and Node are installed. Install the Stellar CLI if missing and add the `wasm32v1-none` target.
- Use PowerShell-friendly commands, or Git Bash if available.
- GitHub CLI is signed in as `Prashant-Mishra-12569`.

## Stack

- Contract: Rust, `soroban-sdk` (28.x as of Oct 3, 2026), Stellar CLI. Path: `contracts/habeas/`.
- Web: Next.js 16 App Router, React 19, Tailwind 4, `@stellar/stellar-sdk`, `@creit.tech/stellar-wallets-kit`, `motion` (formerly framer-motion), optional `lenis`, shadcn/ui primitives. Path: `apps/web/`.
- x402: `@x402/next`, `@x402/stellar`, `@x402/fetch` on Stellar testnet.
- Alerts: `grammy` Telegram bot polling RPC `getEvents`. Path: `apps/alerts/`. When it's time, give Prashant step-by-step BotFather instructions; he pastes the token into `.env` himself.
- Tests: `cargo test`, Vitest, Playwright.

## Contract essentials

- One Habeas instance per asset; set as the asset's SAC admin via `set_admin`.
- Issuer flags `AUTH_REVOCABLE` + `AUTH_CLAWBACK_ENABLED` set before holders open trustlines.
- `open_case` freezes immediately (`set_authorized(false)`); `settle` is permissionless; reviewer silence past the review window = unfreeze.
- Emergency take-back requires issuer **and** reviewer auth.
- No way to take the SAC admin back without reviewer consent and a delay.
- Typed errors, TTL extension on every persistent entry, state written before SAC calls, 25+ tests.

## Words on screen

freeze (not deauthorize) · take back, first mention "take back (clawback)" · reviewer (not arbiter) · unfreeze · fingerprint of the file (not hash) · outcomes: Cleared / Taken back.
Plain, active, sentence case, written for someone who has never used crypto. No hype words (seamless, unlock, empower, revolutionary, leverage, next-gen, game-changer). Errors say what happened and what to do. English + Spanish.

## Design

Theme: **carbon-copy forms**. Old forms had white, yellow and pink copies so every party kept the same record; Habeas does that on-chain. Full spec: `docs/PLAN.md` section 12.

- **Build `/styleguide` first and get Prashant's approval** before building real pages.
- Colors: form white `#F7F8F4`, graphite `#1F2229`, ballpoint blue `#1F3A8F`, canary copy `#F1E8B8`, pink copy `#EBCFD3`, cleared green `#2F6E4E`, taken-back red `#9E2B33` (rare), rule gray `#D6D9D0`. Copies stay pale; strong colour only marks state.
- Type: Public Sans (all reading text; Schibsted Grotesk offered as an alternative heading face on `/styleguide`), IBM Plex Mono only for addresses, hashes, case numbers. Load with `next/font`.
- Motion tells the story of a case: hero form fills itself with the real USBDC event; a scroll-linked "how a case works" section with an ink line and a sticky form changing state; carbon copy slides out on every state change. Transform/opacity only, 200–600 ms, no bouncy springs, full `prefers-reduced-motion` support.
- Mobile first (375 px), tap targets ≥ 44 px, WCAG AA contrast, visible focus.
- 21st.dev / shadcn components are starting points; always restyle to our tokens. Skip aurora backgrounds, glowing beams, animated gradients.
- Avoid: all-caps eyebrow labels, one accented word in headlines, identical shadowed cards, gradients, glow, emoji, arrows on buttons.

## Git

- Repo: public `habeas` on `Prashant-Mishra-12569`. Small commits, one milestone each, pushed after every milestone, so the history shows steady work across the week.
- Commit messages read like a person explaining the change, e.g. `Holder wins by default if the reviewer never decides`. No emoji, no "feat: comprehensive robust…".
- Never commit `.env*` files, keys or build artifacts.

## Definition of done for any feature

Works on real testnet, has a test, looks right at 375 px and 1440 px, copy follows the words list, `docs/PROGRESS.md` updated, and related tx links added to `docs/EVIDENCE.md` when relevant.
