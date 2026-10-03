# Progress

Updated after every milestone. Newest first.

## Phase 3: web app (started Oct 3, 2026)

### Done

- Studied Local402, AgentAllowance, AegisOS and stellar.org: `docs/DESIGN-NOTES.md`. Key point: AegisOS already uses a legal "case file" look (exhibits, round stamp), so Habeas stays on carbon-copy forms and avoids stamps, exhibits and mono all-caps labels. AgentAllowance's Render site stayed blank for 15+ s twice: the site goes on Vercel.
- `apps/web`: Next.js 16.3.8, React 19.3.0, Tailwind 4, TypeScript 5.9.3 (create-next-app 16.3.8 installs `typescript ^5`, so we don't use TS 7), motion 14, @stellar/stellar-sdk 17.2.1. Fonts via `next/font`: Public Sans, Schibsted Grotesk (alternative heading), IBM Plex Mono.
- Palette checked for WCAG AA in light and dark. Added: muted text, a darker field line for inputs (3:1 on every copy), and lighter dark-mode blue/green/red (the plan's values fail on the dark page).
- `/styleguide` (waiting for Prashant's approval): colours, type, heading-face choice, buttons, fields, words list, the main animation (the real Sep 19 USBDC take back read live from mainnet Horizon, typed into the case form, with "Reason" and "Right to answer" marked "Not provided"), and two real testnet cases replayed step by step from their own on-chain timestamps. No mock data anywhere; failed reads show an error with "Try again".
- Checked at 375 px (no sideways scroll) and desktop, light and dark. `tsc`, `eslint` and `next build` clean.

### Waiting on Prashant

- Approve the styleguide, or say what to change. Pick heading face A (Public Sans) or B (Schibsted Grotesk).

## Phase 2: the contract (Oct 3, 2026)

### Done

- `contracts/habeas`: open, appeal, decide, settle, withdraw, emergency take back / close, mint, approve holder, reviewer change (needs issuer + old + new reviewer), admin handover (issuer + reviewer, 7-day public delay, blocked while any case is active), reads, `bump`. Typed errors, events with `case_id` and `holder` as topics, TTL extended on every touch, state written before SAC calls. Reference: `docs/SPEC-cases.md`.
- Decisions made while building (not spelled out in the plan):
  - Each case stores a short public statement (max 280 bytes) as well as the reason code; issuer and reviewer must give one, the holder's is optional. "Did it give a public reason?" then has a real answer on-chain.
  - `emergency_close(case_id, ...)` added next to `emergency_take_back`, so an emergency can end a case that's already open.
  - Every closing path unfreezes the holder; take-back paths take back `min(amount, balance)` first.
  - Enums are stored by name (`["Cleared"]`), not numbers, so explorers are readable.
- 50 tests against the real SAC from the SDK (plan asked for 25+). Mutation check: removing the holder's signature, flipping "reviewer silent" to take back, or dropping the reviewer from emergencies each makes tests fail. `cargo clippy -- -D warnings` clean.
- CI on GitHub: fmt, clippy, tests, wasm build. Green.
- Verified build: tag `v0.1.0` → GitHub Actions release with a SEP-55 build attestation (verified with `gh attestation verify`). The testnet instance is deployed from that exact wasm (`e822b7f1…`), and the on-chain wasm carries `source_repo` metadata. StellarExpert still showed "unverified" right after deploy; check again later.
- Testnet: `scripts/deploy-testnet.sh` issues DEMOUSD from scratch, deploys Habeas, hands it the SAC admin role, locks the issuer account, and checks a classic clawback is refused. `scripts/run-demo-cases.mjs` runs all six endings (cleared after appeal, taken back after appeal, no answer, reviewer silent, withdrawn, emergency) plus three refusals. Every hash checked on Horizon. `docs/EVIDENCE.md` is generated from the results.
- The first deployment (local build) is kept in `deployments/archive/local-build/`.
- Error parsing in `scripts/lib/stellar.mjs` tells Habeas errors apart from the asset contract's own numbered errors (they overlap, e.g. #13).
- README and MIT license added.

### Open questions for Prashant

- Final lock for the demo asset issuer: reviewer as co-signer (current, reversible) or master weight 0 (permanent)?
- Plan says the demo reviewer is a 2-of-3 panel. The contract supports it as-is (the reviewer is any address, so a multisig account works), but signing a Soroban auth entry with several keys needs custom code. Proposed: single reviewer key for the demo, panel listed as roadmap, unless you want it.

### Next

- Phase 3: web app skeleton and `/styleguide` for approval, design notes from the reference sites, asset check on real mainnet + testnet data.

## Phase 1: tools, repo, spikes (Oct 3, 2026)

### Done

- Read `CLAUDE.md`, `docs/CONTEXT.md`, `docs/PLAN.md`.
- Installed Stellar CLI 28.1.0 and GitHub CLI 2.102.0 with winget. Added the `wasm32v1-none` Rust target.
- This PC has no Visual Studio Build Tools, so the MSVC linker is missing. Rust builds in this folder use the GNU toolchain instead (`rustup override set stable-x86_64-pc-windows-gnu`, local to this machine, not committed). Contracts build to `wasm32v1-none` either way, so the output is the same.
- Gave `habeas` its own git repo. Note: the home folder `C:\Users\prash` is itself a git repo (remote `IAMONCRYPTO/PLURAL`, no commits); we leave it alone.
- Testnet accounts created with `stellar keys generate --fund` (secrets stay in the Stellar CLI key store):
  - `hb-issuer` GA6L645WCJLPTCTMNGWSB7C7IFIF35FX6BFFVZBK5V2EUILPPUX5K5G4
  - `hb-holder` GB7ZYVZJ6GQN4QS7DFC2RSGMCEHV5OYXLF3DD3VDIPPF4E6OEH2NS3NX
  - `hb-reviewer` GBQDEQ6YFF5Z3WXSRO6PBVOFYGKHNKY5QXLLCOJQN3W6C7RUC4HLYBBY
  - `hb-relayer` GAXJZQQE6XWVP5HVJ6LPVS5IC37CYGQ2J5LTUYLKT5KZE6YJFIJ7LRE5
- Spikes S1 to S4 all passed on testnet. Details and tx links in `spikes/RESULTS.md`:
  - S1: a contract set as SAC admin can freeze, unfreeze, take back and mint. A frozen holder's payment fails with `src_not_authorized`.
  - S2: take back works on a contract-held balance, even while frozen.
  - S3: a holder with 0 spendable XLM appealed; the relayer paid. Freighter `signAuthEntry` still to confirm in the browser.
  - S4: after `set_admin` the issuer account can still clawback/freeze directly (back door open). Locking it with the reviewer as co-signer closes it; the contract path keeps working.
- Design change from S4: the contract's `issuer` role is a separate operator key, not the asset's classic issuer account, which gets locked.

- Verified the two U.S. Bank operations on mainnet Horizon (payment and clawback of 24,000 USBDCP, Sep 19 02:53:03 and 03:08:33 UTC). Recorded in `docs/EVIDENCE.md`.
- Public repo created: https://github.com/Prashant-Mishra-12569/habeas. Commits use the GitHub no-reply email.
