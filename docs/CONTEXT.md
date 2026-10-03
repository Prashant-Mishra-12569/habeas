# Context from the planning chat (Oct 3, 2026)

This file carries everything decided in the planning conversation between Prashant and Claude, so a new Claude Code session can continue without losing the thread. Read it fully once; refer back when a decision comes up.

## About Prashant

- Prashant Mishra, based in India (IST, UTC+05:30). GitHub `Prashant-Mishra-12569`, X `@0xprashantt`, Telegram `prashantoncrypto`.
- Interested in Web3, smart contracts, trading automation. Has built on Stellar before; that project ended up running on mock data, which he does not want to repeat.
- Wants direct, no-sugar-coating answers. Wants the site to feel human-made: plain words, no AI-sounding copy, tasteful colours, good fonts, some animation including on scroll, polished on mobile.
- Has testnet XLM in his Freighter wallet. **We do not need his secret key and must never ask for it.**

## The hackathon

- **Find Your Way: Hackathon**, run by Tellus Cooperative (a Latin American Stellar education co-op, strongest in Chile) on Stellar Passport. Warm-up for HackMeridian 2026 (Lisbon, Oct 25–26).
- Page: https://demo.stellarpassport.xyz/hackathons/find-your-way-meridian-hackathon
- Prashant is registered, **General Track**. Teams of 1–5.
- **Submissions close Oct 12, 2026** (live countdown on the page). An older Tellus blog post (Sep 23) said Oct 5; the page supersedes it. We plan to submit Oct 11.
- Prize pool 5,000 USDC. General Track: 1st 2,000 · 2nd 1,000 · 3rd 500 · two honorable mentions 250. (University Track is Chile students only.)
- Judging criteria: technical execution, meaningful use of Stellar, originality, potential impact, user experience, presentation quality.
- Official post: https://blog.telluscoop.com/p/findyourway

## Why Habeas (where the idea came from)

1. **The organizers asked for it, indirectly.** On Sep 25, 2026 Tellus published an analysis of U.S. Bank's USBDC stablecoin on Stellar: https://blog.telluscoop.com/p/usbdc-un-banco-puso-su-dinero-a-prueba-en-la-blockchain-de-stellar
   - Sep 9: U.S. Bank announced USBDC (pilot, not for customers yet).
   - Sep 19, 02:53:03 UTC: the issuer sent 24,000 tokens; at 03:08:33 it clawed back the same amount. Asset code on-chain is `USBDCP`. Issuer account (per the article): `GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E`. Operations: https://horizon.stellar.org/operations/277025910283366401 and https://horizon.stellar.org/operations/277026709147193345 (**verify both on Horizon before using**).
   - Issuer flags: `AUTH_REQUIRED`, `AUTH_REVOCABLE`, `AUTH_CLAWBACK_ENABLED`.
   - The article's conclusion: the act is visible on-chain, but the justification and any way to dispute it are not. No public procedure for contesting a wrong freeze or clawback.
2. **SDF's priorities.** The Stellar Builder Summit (São Paulo, Aug 2026) had an "Enterprise Compliance & RWA" track; RWA on Stellar was about $2B per Messari Q1 2026 (cited by SDF). Franklin Templeton's BENJI fund relies on the same freeze/clawback powers.
3. **Empty space.** Past winners cluster in agents/x402, ZK privacy, DeFi, escrow. Nobody built holder-side recourse for regulated assets.

## Research on past winners (what impressed judges)

- **HackMeridian 2025 (Rio):** Innovation: The Simple Fund, 4Bridge, Stellar Forge. Composability (built on Blend, Soroswap, DeFindex, Kale, Reflector): Lance, Star Lends, Panorama Block.
- **Stellar Hacks: Real-World ZK (Jun 2026, 380+ projects):** Wraith, AnchorShield, Umbra Wallet, zkProofofReserve, Tukar. Judges praised Wraith for being honest about exactly what was wired up.
- **Stellar Hacks: Agents (Apr 2026, 260+ projects):** Cards402, CleverCon, RenderGate, x402 MCP template, TollPay. SDF noted 4–5 near-identical agent registries in one hackathon (crowded lane).
- **Stellar Builder Summit São Paulo (Aug 2026):** privacy wallet, QuietBook (sealed-bid RWA book-building), Green Road (Trustless Work), PIX ramp aggregator, BRL treasury yield, StellarPay middleware, Stellar Memory.
- Patterns: solve the network's current pain point, use Stellar-native primitives, ship live on testnet, honest demo, "we all need this" infrastructure, proof judges can verify.

## Competitors in this hackathon (20 projects as of Oct 3)

None touch freeze/clawback or holder protection. The strongest:

- **Local402**: x402 priced in local currency (CLP, UF), Soroban swap, built in Chile, live on mainnet, verified build (SEP-55), upstream x402 fix merged, bilingual. Home-country advantage. https://local402.vercel.app
- **AgentAllowance**: policy-limited agent budgets with Soroban smart accounts + x402; public evidence index and short "proof path" for judges. https://agentallowance-console.onrender.com
- **AegisOS**: signed receipts proving what an x402 agent bought; 47 contract tests + 207 TS tests; honest limits. https://aegisos-stellar.vercel.app
- **Honorarios**: Peru freelancer tax reserve (8%), passkeys, SEP-24 tested, very clear problem.
- Others: WalletNow, Cosmos Wallet (mainnet), Fortgate (KYC evidence, Mexico), Qhapaq (RWA milestones), Soroban Studio, Breadline (escrow), VeriFire, LockA, KwanPay, Cofiblocks, Kimaex, Axon, CodeZard, TurboEntrega, OGPASS, Xlm CLI.
- 194 builders registered; expect more entries before Oct 12.

## Prior art

- **MintGate** (https://github.com/SURUJ404/stellarcontracts): a Soroban contract that acts as SAC admin with roles, mint rate limits, pause, and freeze-before-seize. Created Sep 26, 2026 (the day after the Tellus article), 2 commits, 0 stars, no hackathon mentioned, not submitted to this hackathon as of Oct 3. It controls the issuer's own staff; it has **no** holder notice, appeal, reviewer or default-unfreeze. Mention it honestly in the README. Do not fork or copy it.

## Decisions made

- **Name:** Habeas (from habeas corpus: no punishment without a hearing).
- **Build in Claude Code on Prashant's Windows PC**, because the planning chat's cloud workspace could not reach Stellar's network.
- **Testnet** for the contract and all case activity. The asset check reads **real mainnet data** (read-only). Mainnet deploy optional at the end, only with Prashant's OK.
- **x402: yes, small.** A paid machine endpoint returning a signed "is this token safe to accept" answer. Website check stays free. First thing cut if behind.
- **Not adding:** ZK, MPP, AI chatbot, token, passkey smart wallets.
- **Standout features:** Try it live (real testnet case for judges, with or without a wallet), free appeal (relayer pays fees), back-door-closed check, evidence page, verified build, honest limits, English + Spanish.
- **Telegram alerts:** yes. Prashant creates the bot via @BotFather when the time comes; give him step-by-step instructions then.
- **Design:** carbon-copy forms theme; colours and type in `CLAUDE.md` and `docs/PLAN.md` section 12. Animation with `motion` (Prashant asked for framer-motion; same library, renamed). Optional Lenis. 21st.dev components allowed as starting points, restyled. Build `/styleguide` first for Prashant's approval.
- **Grades:** no A–F letter grades (non-technical people misread them). Plain questions and answers plus one of three verdicts: Protected by Habeas · Powers never used · Powers used without a public process. Describe U.S. Bank's action as a legitimate pilot: the point is the missing process, not blame.
- **Commits:** small, milestone-based, plain human language, pushed regularly.

## Technical facts verified in the planning chat

- SAC exposes `set_admin`, `admin`, `set_authorized`, `authorized`, `mint`, `clawback` (Stellar docs, Stellar Asset Contract page). Admin can be any Address. Clawback on a trustline needs the trustline clawback flag, which is set only if the issuer had `AUTH_CLAWBACK_ENABLED` when the trustline was created. Revoking needs `AUTH_REVOCABLE`.
- Classic issuer accounts can still send classic `Clawback` / `SetTrustLineFlags` operations directly even after the SAC admin changes. That is why the back-door check and the issuer-account lock (spike S4) matter.
- x402 on Stellar: official packages `@x402/*` (2.28.0 on Oct 3). Testnet USDC SAC per Stellar docs: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`. Facilitators listed in Stellar docs: OpenZeppelin Channels (testnet URL needs an API key), x402.org (lists Stellar testnet), Vellar (community, testnet). Confirm at build time.
- Library versions seen Oct 3, 2026: soroban-sdk 28.0.0, @stellar/stellar-sdk 17.2.1, @creit.tech/stellar-wallets-kit 2.7.0, next 16.3.8, react 19.3.0, tailwindcss 4.3.3, motion 14.0.0, lenis 1.3.26, shadcn 4.21.1, grammy 1.46.0, vitest 5.0.3. TypeScript 7.0.2 is out; use whatever Next.js supports.

## Planning artifacts

- Idea brief (Claude Docs, readable by Prashant): https://claude.ai/code/artifact/4d0ae26b-c81f-411f-b52c-f9955c5ad8e2. It has the research tables, scorecard, risks, demo script and competition check.
- 3-minute video script: opens on the real USBDC clawback, shows the same event through Habeas, ends with "Habeas. No freeze without notice." Full table in the brief.
