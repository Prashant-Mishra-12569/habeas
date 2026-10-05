<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/habeas-mark-carbon.png">
  <img src="apps/web/public/brand/habeas-mark.png" alt="Habeas logo" width="96">
</picture>

# Habeas

[Español](README.es.md)

**A fair process before anyone takes your tokens.** Live: https://habeas-stellar.vercel.app

Banks and funds that issue tokens on Stellar can freeze them or take them back (clawback). Sometimes that's needed: fraud happens, mistakes happen. But today it can happen with no reason given and no way to answer. On Sep 19, 2026, the issuer of U.S. Bank's pilot stablecoin sent 24,000 tokens and took them back 15 minutes later. The public record shows the act, but no reason and no process ([the operations](docs/EVIDENCE.md#the-real-world-event-habeas-responds-to-mainnet)).

Habeas is a Soroban contract that becomes a token's admin, so freezing and taking back can only happen through a **case**:

1. The issuer opens a case with a public reason and the fingerprint of a supporting file. The holder is frozen.
2. The holder can answer before a deadline. Answering is free: Habeas pays the network fee.
3. A neutral reviewer decides.
4. Anyone can settle the case: **Cleared** (unfrozen) or **Taken back**.

If the holder never answers, the tokens can be taken back after the deadline. **If the reviewer never decides, the holder wins by default.** Emergencies (a court order, theft in progress) need the issuer *and* the reviewer, and are still recorded with a reason.

Built for the [Find Your Way Hackathon](https://demo.stellarpassport.xyz/hackathons/find-your-way-meridian-hackathon) by Tellus Cooperative.

## Status

Running on Stellar **testnet**. Live site: **https://habeas-stellar.vercel.app** (English and Spanish, light "Paper" and dark "Carbon").

- **Contract:** [`contracts/habeas`](contracts/habeas), 54 tests against the real Stellar Asset Contract, deployed from a [verified GitHub build](docs/EVIDENCE.md#check-the-build-yourself).
- **Every case ending** has been run on testnet, with transaction links: [`docs/EVIDENCE.md`](docs/EVIDENCE.md) and [/evidence](https://habeas-stellar.vercel.app/evidence).
- **Free answer, proven with a real wallet:** in Freighter the holder signs only the authorization and Habeas pays the network fee ([case 8](https://habeas-stellar.vercel.app/case/8)).
- **Token check on real mainnet data:** [USBDCP](https://habeas-stellar.vercel.app/check/USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E), USDC, PYUSD and BENJI, plus the protected demo token.
- **Works on phones, accessible:** every page is tested at 320, 390, 768 and 1440 px in CI (Playwright), and against WCAG 2.x AA with axe in both themes and languages; Lighthouse accessibility 100.
- How cases work, functions, errors and events: [`docs/SPEC-cases.md`](docs/SPEC-cases.md).
- **Try it live**, with or without a wallet (phones too): get frozen, answer for free, the reviewer decides, settle; then the other ending where silence means the tokens are taken back. Playwright runs it on testnet.
- **Case pages:** every case's timeline with its transactions, a free settle button, and pages for holders (`/me`), the issuer (`/issuer`) and the reviewer (`/review`).
- **Paid check for agents (x402):** wallets and AI agents pay 0.001 testnet USDC per call for a signed token check ([below](#paid-check-for-agents-x402)).
- **Telegram alerts:** [@habeas_alerts_bot](https://t.me/habeas_alerts_bot) runs 24/7. Watch an address and get a message when it's frozen, answered, decided and closed. Case pages, My cases and Try it live open the bot with the address already filled in ([`apps/alerts`](apps/alerts)).

## Paid check for agents (x402)

Before a wallet, payment app or AI agent accepts a token, it should know whether the issuer can freeze or take it back, and whether it has. The website answers that for free. Machines can ask `GET /api/v1/check/CODE-ISSUER?network=mainnet|testnet` and pay 0.001 USDC per answer with [x402](https://www.x402.org) on Stellar testnet. The answer is the same JSON the check page uses, signed with an ed25519 key published at [`/api/v1/key`](https://habeas-stellar.vercel.app/api/v1/key), so the buyer can keep it and prove later what Habeas said and when.

```bash
cd examples && npm install
```

```bash
AGENT_SECRET=S... node agent-check.ts USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E
```

[`examples/agent-check.ts`](examples/agent-check.ts) pays, checks the signature against the pinned key and prints the verdict. `AGENT_SECRET` is a testnet account with a little testnet USDC (`scripts/setup-x402.mjs` makes one). Payment is collected only when an answer comes back: a bad asset or a Stellar outage returns an error and nothing is charged. Payments on testnet: [`docs/EVIDENCE.md`](docs/EVIDENCE.md#paid-agent-check-x402) and the [developer page](https://habeas-stellar.vercel.app/developers).

## Closing the back door

Making Habeas the token's admin is not enough on its own. The issuer's account can still freeze or take back with classic Stellar operations, skipping the contract. We tested this on testnet ([S4](spikes/RESULTS.md#s4-the-classic-back-door)). There are two ways to close it, and the token check reports which one an asset uses:

- **The reviewer co-signs (what a real bank would choose).** The reviewer is added as a signer on the issuer account and the thresholds are raised, so the issuer can't sign a freeze or take back alone. The bank keeps its account for anything else it may need later, but only with the reviewer's agreement.
- **The issuer key is switched off (the demo).** Once the account's classic setup is finished, its key weight is set to 0. Nobody can ever sign for it again; minting still works because it goes through Habeas. It's the simplest setup to verify, and it can't be undone.

## Reviewer: one person or a panel

The demo uses one reviewer key. The contract doesn't care what kind of address the reviewer is, so a panel works without any change: a Stellar multisig account or a smart account. The test [`two_of_three_members_can_decide`](contracts/habeas/src/test.rs) registers a 2-of-3 panel as the reviewer and signs decisions with real ed25519 keys: two members can decide, while one member alone, an outsider, or the same member twice are refused.

## Common questions

**Who decides, and does the holder always win?** No. A reviewer named when the contract is set up decides, with a public reason. The issuer can't be the reviewer and can't replace it alone. Every ending, each run on testnet ([/evidence](https://habeas-stellar.vercel.app/evidence)):

| What happened | Result |
| --- | --- |
| The holder never answered | Taken back |
| The reviewer sided with the issuer | Taken back |
| The reviewer sided with the holder | Cleared |
| The holder answered and the reviewer stayed silent past the deadline | Cleared |
| The issuer withdrew the case | Cleared |
| Emergency signed by the issuer and the reviewer together | Taken back |

In Try it live the website plays the reviewer and you pick the decision, so you can see both outcomes.

**How does Habeas know whose evidence is true?** It doesn't, and it doesn't claim to. Like a court, it guarantees the process, not the verdict: a public reason, a deadline to answer, a neutral decision with its own reason, and a record nobody can quietly change. Files stay with the parties; their fingerprints (SHA-256) are on Stellar, so a file can't be swapped later.

**Why trust one reviewer?** You don't have to. The reviewer can be a 2-of-3 panel with no change to the contract, already tested with real signatures ([above](#reviewer-one-person-or-a-panel)).

**Why would an issuer use it?** A token whose freezes and take backs go through a public process is easier for holders, exchanges and regulators to trust. The free [token check](https://habeas-stellar.vercel.app/check) shows the difference: "Protected by Habeas" next to "Powers used without a public process".

**Can it run on mainnet?** The contract is the same code on mainnet and testnet. Before real money it needs an independent audit, a real reviewer organisation and an issuer who chooses to hand over the token's admin. Until then it runs on testnet and reads mainnet.

## Run it yourself

You need Rust, the [Stellar CLI](https://developers.stellar.org/docs/tools/cli) (28.x) and Node 22.18 or newer (24 recommended; the alerts bot and the x402 example run TypeScript directly).

```bash
cargo test
```

```bash
bash scripts/deploy-testnet.sh
```

```bash
cd scripts && npm install && cd .. && node scripts/run-demo-cases.mjs
```

```bash
cd apps/web && cp .env.example .env.local && npm install && npm run dev
```

The site needs three testnet keys in `apps/web/.env.local` for Try it live and a fourth to sign paid checks (see `.env.example`); every other page only reads public Stellar data.

The deploy script creates fresh testnet accounts with Friendbot, issues a demo asset, deploys Habeas, locks the issuer account and checks the lock. The second script runs every kind of case and writes the transaction hashes to `deployments/testnet-run.json`.

The Telegram alerts bot has its own setup (a token from @BotFather): [`apps/alerts/README.md`](apps/alerts/README.md).

## Roadmap

- A reviewer panel (2 of 3) for the live demo. The contract already supports it (see above); what's missing is the signing flow in the website.
- Independent reviewer networks, so the issuer doesn't pick the reviewer.
- Mainnet deployment once an issuer wants to use it.

## What this does not do

- It does not decide who is right. The reviewer does.
- The reviewer is chosen by the issuer. Independent reviewer networks are on the roadmap.
- While a case is open, the holder's whole balance of that token is frozen, not just the disputed amount. That's how Stellar freezing works. Only up to the case amount can be taken back.
- No real issuer uses it yet. It runs on testnet.
- Files stay off-chain. Only their fingerprints (SHA-256) are public.

## Related work

[MintGate](https://github.com/SURUJ404/stellarcontracts) also puts a contract in charge of a token's admin powers, with roles, mint limits and a freeze before seizing. It controls the issuer's own staff; it has no holder notice, answer, reviewer or default unfreeze. Habeas is about the holder's side.

## License

MIT
