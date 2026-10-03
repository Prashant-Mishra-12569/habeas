# Habeas: A to Z build plan

**Habeas: a fair process before anyone takes your money.**
Find Your Way Hackathon (Stellar Passport · Tellus Cooperative) · General Track · submissions close **Oct 12, 2026**.
Target: submit on **Oct 11**, keep Oct 12 as buffer.

---

## 0. Where we build

**Build in Claude Code on your own computer, not in this chat.**

I tested this chat's cloud workspace. It cannot reach Stellar at all: testnet RPC, Horizon and Friendbot are all blocked. If we built here, I could write code but never deploy it or test it against the real network. That is exactly how your last Stellar project ended up running on mock data. On your machine, Claude Code can deploy contracts, run the app and click through it against real testnet.

What to do:

1. Open Claude Code on your Windows PC in the folder `C:\Users\prash\Documents\habeas` (already created, with these files inside).
2. The folder has `CLAUDE.md` (rules for the build), `docs/PLAN.md` (this file) and `docs/CONTEXT.md` (everything we decided in the planning chat).
3. First message to Claude Code: *"Read CLAUDE.md, docs/CONTEXT.md and docs/PLAN.md. Then start Phase 1."*

Claude Code reads `CLAUDE.md` automatically at the start of every session, so every session follows the same rules.

### Do not share your wallet secret key. With anyone. Including me.

We don't need it. Claude Code creates fresh testnet accounts with `stellar keys generate --fund`, and Friendbot funds them for free. Your Freighter wallet is only used in the browser to click through the app as a user, and that only ever needs your **public** address (starts with `G`).

### Testnet vs mainnet

**Testnet is the right call.** The contract and all case activity run on testnet. The Explorer still reads **real mainnet data**, read-only and free: USBDC, USDC, PYUSD, BENJI. So judges see real-world numbers without you spending anything. Mainnet deployment is optional on Oct 10 if time and a few XLM allow; it is not required to win.

---

## 1. What we're building (v1 scope)

One sentence: **Habeas turns "your tokens were frozen and taken" into a case with a reason, a deadline, a chance to answer, and a neutral decision, recorded on Stellar.**

| Part | What it is | Who it's for |
| --- | --- | --- |
| **Habeas contract** (Soroban) | Becomes the asset's admin through the Stellar Asset Contract. Freezes and clawbacks can only happen through a case | Issuers (banks, funds, stablecoin teams) |
| **Asset check** (web) | Paste any Stellar asset and get plain answers: can the issuer freeze it, take it back, has it done so, did it say why, is the back door closed | Anyone holding a token |
| **Case pages** (web) | Holder sees their case and appeals in one tap; issuer opens cases; reviewer decides | Holders, issuers, reviewers |
| **Try it live** (web) | A judge gets real test tokens, gets frozen, appeals and wins, all on real testnet, in about 2 minutes, with or without a wallet | Judges, first-time visitors |
| **Free appeal** | A frozen holder can appeal without owning any XLM; Habeas pays the network fee | Holders |
| **Agent check API** (x402) | Machines (wallets, AI agents, payment apps) pay a tiny USDC fee per call to get a signed answer: "is this token safe to accept?" | Developers, agents |
| **Telegram alerts** | "Your DEMOUSD was frozen. Case #12. You have 72 hours to answer." | Holders |

### Words we use (keep these consistent everywhere)

| Technical term | What we say on screen |
| --- | --- |
| deauthorize / revoke authorization | **freeze** |
| clawback | **take back** (first mention: "take back (clawback)") |
| arbiter | **reviewer** |
| holder | **holder** or "you" |
| issuer / operator | **issuer** |
| evidence hash | **fingerprint of the file** |
| restore authorization | **unfreeze** |
| case outcome: restored | **Cleared** |
| case outcome: clawback | **Taken back** |

---

## 2. How we stand out against the top entries

The strongest current entries are Local402, AgentAllowance and AegisOS. All three are agent-payment projects, so judges will compare them with each other. We compete on a different axis (regulated money, people's rights) and borrow what made strong projects impressive:

| What impressed judges | Who did it | What Habeas does |
| --- | --- | --- |
| A short proof path judges can click through | AgentAllowance | An evidence page: one transaction link per step |
| Verified build of the deployed contract (SEP-55) | Local402 | Same, from GitHub Actions |
| "Try it" in one command or click | Local402 | **Try it live** runs a full real case for the judge |
| Honest about limits | Wraith (ZK winner), AegisOS, Honorarios | A plain "what this does not do" section |
| Bilingual Spanish/English | Local402, most top entries | README, site language toggle, subtitles |
| A real local problem with real detail | Honorarios | The real U.S. Bank clawback, pulled live from mainnet |

### The x402 decision

**Yes, add x402, but as one small, natural feature, not the headline.**

Where it fits honestly: before a wallet, payment app or AI agent accepts a token, it should know whether the issuer can freeze or take it back. Our asset check already computes that. The x402 endpoint sells that answer to machines, signed by Habeas, for a fraction of a cent per call. People on the website keep using it free.

- It connects Habeas to the agent wave every judge is watching, without putting us in the crowded agent lane.
- It is about 1 day of work with the official `@x402/*` packages on Stellar testnet.
- If we fall behind, it is the first thing we cut.

We are **not** adding: ZK proofs, MPP, an AI chatbot, a token, passkey smart wallets. Each would add risk without making the core story stronger.

### Other upgrades that make Habeas hard to ignore

1. **Free appeal (gasless).** A frozen person may have zero XLM. The holder only signs the appeal; our relayer submits the transaction and pays the fee. This is a small detail that shows we thought about real people.
2. **"Back door closed" check.** The Explorer verifies that the asset's admin is a contract running the verified Habeas code, and that the issuer account can't skip it with a direct classic clawback. Trust becomes something anyone can check.
3. **Try it without a wallet.** A judge who has never installed Freighter gets a temporary testnet wallet in the browser. Real transactions, zero setup.

---

## 3. Architecture

```
                ┌──────────────────────────── Stellar testnet ───────────────────────────┐
                │                                                                       │
 Issuer ──open case──►  Habeas contract  ──set_authorized / clawback──►  Asset's SAC    │
 Holder ──appeal────►   (case records,                                   (DEMOUSD)      │
 Reviewer ─decide───►    timers, events)                                                │
 Anyone ──settle────►                                                                   │
                └───────────────────────────────────────────────────────────────────────┘
                          ▲ simulate reads / submit txs            ▲ events
                          │                                        │
                ┌─────────┴─────────── Next.js app (Vercel) ───────┴─────────┐
                │  Pages: home · asset check · case · try it · evidence      │
                │  API: /api/asset · /api/relay · /api/demo/* · /api/v1/check │
                │        (x402-protected)                                    │
                └─────────┬───────────────────────────────────┬──────────────┘
                          │ read-only                         │
                 Horizon + RPC (mainnet & testnet)     Telegram alert worker
                                                       (polls contract events)
```

Rules:

- **Case data lives in the contract.** The site reads it with RPC simulation (`get_case`, `cases_for`). No database for cases, so nothing can drift from the chain.
- **Asset history comes from Horizon** (full operation history for classic assets) plus RPC for contract data.
- **Demo keys** (demo issuer, demo reviewer, relayer) are testnet-only secrets in server environment variables. Never in the browser, never in git.

---

## 4. Tech stack (latest stable, checked Oct 3, 2026)

| Layer | Choice | Version seen on Oct 3 |
| --- | --- | --- |
| Contract | Rust + `soroban-sdk` | 28.0.0 |
| CLI | Stellar CLI (`stellar`) | latest release; install with winget or cargo |
| Web | Next.js (App Router) + React | 16.3.8 / 19.3.0 |
| Styling | Tailwind CSS | 4.3.3 |
| Animation | Motion (`motion`, formerly framer-motion) + optional Lenis | 14.0.0 / 1.3.26 |
| UI primitives | shadcn/ui (CLI `shadcn`), restyled; 21st.dev components as starting points | shadcn 4.21.1 |
| Language | TypeScript | **use the version Next.js 16 officially supports** (TS 7.0.2 is out but very new; don't fight the toolchain) |
| Stellar JS | `@stellar/stellar-sdk` | 17.2.1 |
| Wallets | `@creit.tech/stellar-wallets-kit` (Freighter, xBull, Albedo, more) | 2.7.0 |
| x402 | `@x402/next`, `@x402/stellar`, `@x402/fetch` | 2.28.0 |
| Telegram | `grammy` | 1.46.0 |
| Tests | `cargo test` (contract), Vitest (TS), Playwright (end-to-end) | Vitest 5.0.3 |
| Hosting | Vercel (web), Render or Railway free tier (alert worker) | — |

Claude Code: re-check versions with `npm view <pkg> version` and the crates index before installing. If a library's API changed, follow its current docs, not memory.

Recommended for Claude Code: install SDF's Stellar dev skill and the Raven MCP server (both listed on developers.stellar.org under "Building with AI"). They give Claude Code up-to-date Stellar docs while it writes code.

---

## 5. Phase 1: spikes (prove the risky parts first)

Before building anything big, prove these four things on testnet with tiny scripts in `spikes/`. If one fails, we change the design now, not on day 6.

| # | Question | How to test | If it fails |
| --- | --- | --- | --- |
| S1 | Can a contract set as SAC admin call `set_authorized(false)`, `set_authorized(true)`, `clawback` and `mint`? | Issue `DEMOUSD` with `AUTH_REVOCABLE` + `AUTH_CLAWBACK_ENABLED` set **before** any holder opens a trustline. Deploy SAC, `set_admin` to a tiny test contract, call each function | Stop and rethink; this is the core |
| S2 | Does clawback work on a balance held by a **contract** address (C…), not just a G account? | Send DEMOUSD to a contract, then clawback from it | Drop the "protects DeFi pools" talking point |
| S3 | Free appeal: holder signs only the auth entry, relayer is tx source and pays the fee | Freighter `signAuthEntry` (or SDK `authorizeEntry`) + relayer submits | Fallback: fee-bump transaction; second fallback: holder pays a tiny fee |
| S4 | Back door: after `set_admin`, can the issuer still run a classic `Clawback`? Then lock it (master weight 0, or add reviewer as required co-signer) and confirm it fails | Classic ops via CLI/SDK | Document clearly; the Explorer check still shows the truth |

Write results into `spikes/RESULTS.md` with transaction links. These links become part of the evidence page.

---

## 6. Phase 2: the contract

`contracts/habeas/`

### Setup

- `__constructor(sac, issuer, reviewer, answer_window_secs, review_window_secs)`
- One Habeas instance per asset.

### Case lifecycle

| Function | Who signs | Rules |
| --- | --- | --- |
| `open_case(holder, amount, reason, file_hash)` | issuer | Freezes the holder immediately via SAC. `amount` ≤ holder balance. One active case per holder. Reason is a fixed code (fraud, sanctions order, sent by mistake, court order, other) |
| `appeal(case_id, file_hash)` | holder | Only while the answer window is open |
| `withdraw(case_id)` | issuer | Issuer drops the case → unfreeze |
| `decide(case_id, uphold, note_hash)` | reviewer | Only after an appeal, only inside the review window |
| `settle(case_id)` | **anyone** | No appeal and window over → take back. Upheld → take back. Rejected → unfreeze. Reviewer silent past the window → **unfreeze (holder wins by default)** |
| `emergency_take_back(holder, amount, reason, file_hash)` | issuer **and** reviewer | Court orders / active theft. Immediate, still recorded as a closed case |

### Issuer still needs normal powers

- `mint(to, amount)`: issuer (keeps issuing working)
- `approve_holder(holder)`: issuer, for `AUTH_REQUIRED` assets (can only set authorized = true; it can never freeze)
- `change_reviewer(new)`: needs issuer **and** current reviewer
- No function hands the SAC admin back without the reviewer's consent and a delay. Otherwise Habeas is a promise, not a guarantee.

### Reads

`get_config()`, `get_case(id)`, `cases_for(holder)`, `case_count()`, `version()`

### Events (the alert worker and the site rely on these)

`case_opened`, `case_appealed`, `case_decided`, `case_settled(outcome)`, `case_withdrawn`, `emergency_take_back`

### Quality bar

- Typed errors (`NotIssuer`, `WindowClosed`, `CaseNotActive`, `AlreadyActiveCase`, `AmountTooHigh`…)
- Extend TTL on every persistent entry touched, plus a public `bump(case_id)`
- Write state before external SAC calls
- **At least 25 tests:** happy paths, every timeout branch, every unauthorized caller, double settle, emergency path, reviewer change, one-active-case rule
- `cargo clippy -- -D warnings` clean
- Deploy to testnet, `set_admin` the DEMOUSD SAC to Habeas, run one full case from the CLI, save tx links

---

## 7. Phase 3: the asset check (Explorer)

Route: `/check/[asset]` where asset is `CODE-ISSUER` (mainnet default; `?network=testnet` for test assets).

What it shows, in plain questions and answers (this replaces letter grades, which non-technical people misread):

```
USBDCP · issued by U.S. Bank                                       mainnet

Can the issuer freeze your tokens?          Yes
Can it take them back (clawback)?           Yes
Has it taken tokens back?                   Yes, 1 time · Sep 19, 2026 · 24,000 USBDCP  [view]
Did it give a public reason?                No public reason found
Is there a fair process before it acts?     No
Is the back door closed?                    Not applicable (no Habeas)

How this was checked: issuer flags, signers and 100% of clawback and freeze
operations from Stellar's public record. Last checked 2 minutes ago.
```

Data sources (all real, nothing made up):

- Horizon `/accounts/{issuer}`: flags, signers, thresholds
- Horizon `/accounts/{issuer}/operations`: filter `clawback`, `clawback_claimable_balance`, `set_trust_line_flags`, `allow_trust`; paginate until done (cap and say so if capped)
- Horizon `/assets`: number of holders
- RPC: derive the asset's SAC contract ID, call `admin()`; if the admin is a contract, read its WASM hash and compare with the verified Habeas build hash
- Overall verdict, three states only: **Protected by Habeas** · **Powers never used** · **Powers used without a public process**

Preloaded examples on the home page: USBDC, USDC, PYUSD, BENJI (mainnet) and DEMOUSD (testnet, protected). Claude Code must look up and confirm the real issuer addresses; no guessing.

Tone rule: the U.S. Bank event is described as a legitimate pilot. The point is the missing process, not blame.

---

## 8. Phase 4: case pages

| Route | What's on it |
| --- | --- |
| `/case/[id]` | The case, readable by anyone: status, reason, amount, deadlines, timeline of every step with transaction links |
| `/me` | Connected wallet's cases: "You have 1 open case. Answer by Oct 9, 14:00." |
| `/issuer` | Open a case (holder address, amount, reason, upload a file; the fingerprint is computed in the browser and the file never leaves the device) |
| `/review` | Reviewer queue: cases waiting for a decision, with both fingerprints and a decide button |

Every action button names exactly what happens: **Freeze and open case**, **Send my answer**, **Uphold**, **Reject**, **Settle case**. The success message repeats the same verb.

---

## 9. Phase 5: Try it live (the judge experience)

This is the most important page after the home page. A judge should get through it in about 2 minutes.

1. **Start**: "Use my wallet" (Freighter etc. on testnet) or "Try without a wallet" (temporary testnet wallet created in the browser, funded by Friendbot).
2. **Get test money**: server creates the trustline flow and mints 1,000 DEMOUSD to them. Real tx link shown.
3. **Get frozen**: the demo issuer opens a case against them: "Suspected fraud". Their balance shows a frozen state.
4. **Answer**: they tap **Send my answer** (free appeal; we pay the fee).
5. **Decision**: the demo reviewer (2 of 3 signer panel) rejects the issuer's claim. Shortened windows on the demo instance: answer window 3 min, review window 2 min.
6. **Settle**: they tap **Settle case**. Unfrozen. "Cleared."
7. **The other ending**: a toggle "What if I don't answer?" runs a second case to the take-back ending, so judges see both outcomes.
8. End screen: their full case file with every transaction link, plus "Share your case".

Abuse limits: per-IP and per-address rate limits on demo endpoints; demo mint capped; relayer only submits calls to the Habeas contract's `appeal` and `settle`.

---

## 10. Phase 6: x402 agent check

- `GET /api/v1/check/[asset]` protected with `@x402/next` on Stellar testnet, priced at 0.001 USDC (testnet USDC contract from the Stellar x402 docs).
- Response: the same answers as the web check, as JSON, **signed** with a published Habeas ed25519 key so the buyer can verify it later.
- Facilitator: use one listed in Stellar's x402 docs that supports testnet (OpenZeppelin Channels needs an API key; the x402.org facilitator lists Stellar testnet support; confirm at build time).
- `examples/agent-check.ts`: a 30-line script using `@x402/fetch` that pays and prints the answer. Shown in the README and the developer page.
- The free web check stays free. Only the machine endpoint is paid.

---

## 11. Phase 7: Telegram alerts

- Bot made with `grammy`. Commands: `/watch G...`, `/stop`, `/cases`.
- Worker polls RPC `getEvents` for the Habeas contract every 20–30 s and messages watchers on `case_opened`, `case_decided`, `case_settled`.
- Message example: *"Your DEMOUSD balance is frozen. Case #12: suspected fraud. You can answer until Oct 9, 14:00 IST. Open case: habeas.app/case/12"*
- Runs as a small Node process on Render or Railway free tier. If hosting gets in the way, it runs locally during the video and is marked "beta" in the README.
- You create the bot with @BotFather and put the token in `.env`. Never commit it.

---

## 12. Design system

### Idea: the carbon copy

Old paper forms came in sets: a white original, a yellow copy and a pink copy, so every party walked away with **the same record**. That is exactly what Habeas does on-chain: the issuer, the holder and the reviewer all see the same case. The case form, stacked on its slightly offset yellow and pink copies, is the one memorable visual. Everything around it stays quiet.

### Colors

| Name | Hex | Use |
| --- | --- | --- |
| Form white | `#F7F8F4` | Page background (cool white, not cream) |
| Graphite | `#1F2229` | Body text, headings |
| Ballpoint blue | `#1F3A8F` | Primary actions, links, the "ink" of filled-in form fields |
| Canary copy | `#F1E8B8` | Second form layer, "waiting for an answer" states |
| Pink copy | `#EBCFD3` | Third form layer, "frozen" states |
| Cleared green | `#2F6E4E` | Cleared / unfrozen |
| Taken-back red | `#9E2B33` | Used rarely: only for a completed take-back |
| Rule gray | `#D6D9D0` | Form lines, dividers |

Why these: real carbon copies are pale and slightly dusty, never bright. Keeping canary and pink soft (low saturation) is what stops the palette from looking cheap. Blue is a deep ballpoint ink, not a startup blue. Strong colour is reserved for state: blue = action, green = cleared, red = taken back.

Dark mode: graphite page (`#17191E`), form white becomes the text, form layers become dim tinted papers (`#2A2817` canary, `#2C1F22` pink). Check contrast (WCAG AA) on every pair.

**Before building pages, build `/styleguide`** showing the palette, type scale, buttons, the case form in every state, and the main animation. The user approves the look there first. Changing taste on day 1 is cheap; on day 6 it is not.

### Type

- **Public Sans** for everything a person reads (headings at 700–800 with slightly tight tracking, body at 400, 16–18 px, line height 1.55). It was made for public-service websites, which fits "a public process".
- **IBM Plex Mono** only for real data: addresses, hashes, case numbers, amounts in the timeline.
- Type scale 1.25 ratio. Line length under 72 characters.
- Load fonts with `next/font` (self-hosted, no layout shift).
- On `/styleguide`, show one alternative heading face next to Public Sans (Schibsted Grotesk, which has a newspaper-and-forms character) so the user can pick. Body text stays Public Sans either way.

### Layout

```
Home (desktop)                              Home (mobile)
┌──────────────────────────────────────┐    ┌──────────────────┐
│ Habeas                 Check  Try it │    │ Habeas      ≡    │
│                                      │    │                  │
│ Your tokens can be     ┌──────────┐  │    │ Your tokens can  │
│ frozen and taken.      │ CASE FORM│▒ │    │ be frozen and    │
│ You should know why.   │ (real    │▒ │    │ taken. You       │
│                        │ USBDC    │▒ │    │ should know why. │
│ [Check a token]        │ event)   │  │    │ ┌──────────────┐ │
│ [Try it live]          └──────────┘  │    │ │  CASE FORM   │ │
│                                      │    │ └──────────────┘ │
│ How a case works  1 2 3 4 (sequence) │    │ [Check a token]  │
│ Check any token  [ paste asset    ]  │    │ [Try it live]    │
│ For builders: contract · API · x402  │    │ How a case works │
└──────────────────────────────────────┘    └──────────────────┘
```

- **The hero is the problem, shown with real data**: the actual Sep 19 USBDC clawback filled into the case form, with the "Reason" and "Right to answer" fields empty and marked "Not provided". No stock illustration, no gradient blob.
- Left-aligned text everywhere. Generous white space. Form lines (thin rule gray) as the structural device, because forms are the subject.
- "How a case works" is numbered because it really is a sequence.
- Mobile first: the case card is designed at 375 px wide first. Tap targets ≥ 44 px. Bottom-anchored primary button on case pages.

### Motion

Library: **Motion** (`motion` on npm, imported from `motion/react`). This is the same library as framer-motion, renamed. Both packages are at 14.0.0; use `motion`. Optional: **Lenis** (`lenis`) for gentle smooth scrolling on desktop only.

Every animation tells part of the story of a case. Nothing moves just to decorate.

| Where | What happens | Trigger |
| --- | --- | --- |
| Hero | The case form fills itself in with the real USBDC event, like someone typing on a form: asset, amount, date, transaction. The two empty fields, "Reason" and "Right to answer", then get a quiet "Not provided" mark. Plays once, about 2.5 s | Page load |
| How a case works | A sticky case form on the left; four steps on the right. As you scroll, a blue ink line draws down the steps, and the form changes state to match: Frozen → Answered → Reviewed → Cleared. Each change slides a carbon copy out from under the form | Scroll (`useScroll` + `useTransform`) |
| Asset check results | Answers appear line by line like a form being completed, with the real values | After the user presses Check |
| Any case state change | The new carbon copy slides out and the status updates | User action or confirmed transaction |
| Try it live | A progress strip of the case steps fills as each real transaction confirms | Transaction confirmations |

Rules:

- Durations 200–600 ms for UI, easing `[0.22, 1, 0.36, 1]`. No bouncy springs on serious states like "Frozen".
- Animate only `transform` and `opacity`. Test at 60 fps on a mid-range Android phone.
- On mobile, the sticky scroll section becomes a simple vertical sequence with each step's form state shown inline.
- `prefers-reduced-motion`: everything shows in its final state instantly.
- No fade-and-slide-up on every section, no parallax blobs, no cursor followers.

### Components and 21st.dev

- Base primitives: **shadcn/ui** (built on Radix, so dialogs, menus and toasts are accessible) restyled with our tokens.
- **21st.dev**: use its free community components as a starting point for structure (navigation, dialogs, toasts, a stepper), then restyle them to our palette and type. Skip its flashy effects (aurora backgrounds, glowing beams, animated gradients); everyone uses them and they would make Habeas look common. The 21st MCP needs a free 21st.dev account and its own setup (`npx @21st-dev/cli@latest init`, see 21st.dev/mcp). It is optional; copy-pasting components from the site works too.

### Design references to study (structure and clarity, not look)

Claude Code should open these in a browser and note what works before designing:

- Local402 dashboard (https://local402.vercel.app): clear proof, bilingual, mainnet evidence
- AgentAllowance console and docs (https://agentallowance-console.onrender.com): the short "proof path" for judges
- AegisOS (https://aegisos-stellar.vercel.app): verifiable claims and honest limits
- stellar.org and meridian.stellar.org: the ecosystem's tone, so Habeas feels at home but not copied

Write 5–10 bullet notes in `docs/DESIGN-NOTES.md` on what to borrow (clarity, proof) and what to avoid (anything that looks like every other dashboard).

### Avoid (these make a site look generated)

- ALL-CAPS labels above headings, words joined with "·" as decoration, arrows tacked onto buttons
- One accented word in a headline
- Identical rounded cards with soft shadows for everything
- Gradient backgrounds, glow effects, emoji in UI
- Words like "revolutionary", "seamless", "unlock", "empower", "leverage", "next-gen", "game-changer", "web3-native"

### Writing rules

- Say what happens, in words a non-crypto person knows. "Freeze", not "deauthorize".
- Active voice. Short sentences. Sentence case.
- Errors explain what happened and what to do: "Your answer window closed on Oct 9 at 14:00. The issuer can now settle the case."
- Empty states invite action: "No cases for this address. That's good news."

Draft home page copy:

> **Your tokens can be frozen and taken. You should know why.**
> Banks and funds that issue tokens on Stellar can freeze them or take them back. That's sometimes needed: fraud happens, mistakes happen. But today it can happen with no reason given and no way to answer.
> Habeas adds a fair process: a public reason, a deadline, a chance to answer, and a neutral decision. If the process stalls, you get your money back by default.
> [Check a token] [Try it live]

Spanish version of every page via a simple language toggle (EN / ES). Have the Spanish reviewed by a native speaker if possible (Tellus community Discord is a good place to ask).

---

## 13. Repo, commits and quality

- New public GitHub repo: `habeas` (MIT license).
- Layout:

```
habeas/
  CLAUDE.md
  README.md            (EN + ES)
  docs/PLAN.md · docs/EVIDENCE.md · docs/SPEC-cases.md
  contracts/habeas/    (Rust, tests)
  spikes/              (scripts + RESULTS.md)
  apps/web/            (Next.js)
  apps/alerts/         (Telegram worker)
  examples/agent-check.ts
  scripts/             (deploy, seed demo asset, rotate demo keys)
  .github/workflows/   (contract tests, web tests, verified build)
```

- **Commits:** small, one milestone each, written like a person explaining what changed. Examples:
  - `Add case lifecycle to the contract: open, appeal, decide, settle`
  - `Holder wins by default if the reviewer never decides`
  - `Asset check now reads real clawback history from Horizon`
  - `Fix: answer window used ledger close time in seconds, not ms`
  - Not: `feat: implement comprehensive robust case management system 🚀`
- Push after every milestone, so the GitHub history shows steady progress over the week.
- CI: `cargo test`, clippy, Vitest, Playwright smoke test against testnet, and the SEP-55 verified build workflow (confirm the current official workflow in Stellar's docs).

### The "no mock data" rule

1. No hardcoded balances, cases, transactions or "example" numbers in the UI. Everything comes from Horizon or RPC.
2. If a network call fails, show an honest error with a retry, never fake data.
3. Seed scripts create **real** testnet state (issue DEMOUSD, deploy, set admin, run sample cases).
4. Playwright tests run the full case flow against real testnet before every release.
5. The evidence page lists real transaction hashes produced by those scripts.

---

## 14. Submission package

1. **Live site** on Vercel.
2. **README** (EN + ES): the problem in 4 sentences, a 30-second GIF, how it works diagram, contract IDs, how to run locally, x402 example, what this does not do, roadmap.
3. **Evidence page** (`docs/EVIDENCE.md` and `/evidence` on the site): contract ID, verified build hash, one tx link for each step (open, appeal, decide, settle as cleared, settle as taken back, reviewer timeout, emergency), test counts, spike results.
4. **Demo video, under 3 minutes**, Spanish subtitles. Script in the idea brief (opens on the real USBDC event).
5. **5-slide deck**: problem, why now, how it works, demo, roadmap.
6. **What this does not do** (judges reward honesty):
   - It does not decide who is right; the reviewer does.
   - v1 uses one reviewer panel chosen by the issuer; independent reviewer networks are roadmap.
   - It runs on testnet; no real issuer uses it yet.
   - Case files stay off-chain; only fingerprints are public.
7. **Post on X** from @0xprashantt with the video, tagging @TellusCoop, @StellarPassport, @BuildOnStellar.

---

## 15. Day-by-day timeline (IST)

| Day | Goal | Done when |
| --- | --- | --- |
| **Sat Oct 3** (tonight) | Claude Code set up, repo created, toolchain installed, spikes S1 and S4 | `spikes/RESULTS.md` has real tx links |
| **Sun Oct 4** | Spikes S2, S3. Contract complete with tests. Deployed, SAC admin handed over | Full case run from CLI on testnet |
| **Mon Oct 5** | Web app skeleton, `/styleguide` **approved by you**, asset check reading real mainnet + testnet data | You approve the look; `/check/...` works for USBDC and DEMOUSD |
| **Tue Oct 6** | Case pages: issuer, holder, reviewer, public case view | A case can be run end-to-end in the browser with Freighter |
| **Wed Oct 7** | Try it live (with and without wallet), free appeal relayer | A friend with no crypto finishes the demo on their phone |
| **Thu Oct 8** | x402 agent check + example script; Telegram alerts | Agent script pays and gets a signed answer; Telegram message arrives |
| **Fri Oct 9** | Polish: mobile QA on real phones, dark mode, accessibility, Spanish, verified build CI, Playwright | Lighthouse accessibility ≥ 95; all CI green |
| **Sat Oct 10** | README, evidence page, deck, record video. Optional: mainnet deploy | Everything in section 14 exists |
| **Sun Oct 11** | Final check from a clean browser, **submit**, post on X | Submission confirmed in Stellar Passport |
| **Mon Oct 12** | Buffer only | — |

**Cut order if behind:** Telegram alerts → x402 → dark mode → "without a wallet" option → emergency path in UI (keep it in the contract).
**Never cut:** the contract, the asset check on real data, Try it live, the evidence page, the video.

---

## 16. What you need to do (only you can)

1. Done: GitHub CLI is signed in on your PC. Username: `Prashant-Mishra-12569`. Claude Code creates the public `habeas` repo there.
3. Create a Vercel account (free) and connect it to GitHub when we deploy (around Oct 5).
4. Create a Telegram bot with @BotFather around Oct 8 and paste the token into `.env` yourself.
5. If we use the OpenZeppelin x402 facilitator, generate its testnet API key yourself and paste it into `.env`.
6. Test on your own phone and ask one non-crypto friend to try the demo.
7. Record the video in your own voice. Judges trust a real person.
8. Never paste any secret key into chat. Keys go only into `.env` files on your machine.
