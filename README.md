# Habeas

**A fair process before anyone takes your tokens.**

Banks and funds that issue tokens on Stellar can freeze them or take them back (clawback). Sometimes that's needed: fraud happens, mistakes happen. But today it can happen with no reason given and no way to answer. On Sep 19, 2026, the issuer of U.S. Bank's pilot stablecoin sent 24,000 tokens and took them back 15 minutes later. The public record shows the act, but no reason and no process ([the operations](docs/EVIDENCE.md#the-real-world-event-habeas-responds-to-mainnet)).

Habeas is a Soroban contract that becomes a token's admin, so freezing and taking back can only happen through a **case**:

1. The issuer opens a case with a public reason and the fingerprint of a supporting file. The holder is frozen.
2. The holder can answer before a deadline. Answering is free: Habeas pays the network fee.
3. A neutral reviewer decides.
4. Anyone can settle the case: **Cleared** (unfrozen) or **Taken back**.

If the holder never answers, the tokens can be taken back after the deadline. **If the reviewer never decides, the holder wins by default.** Emergencies (a court order, theft in progress) need the issuer *and* the reviewer, and are still recorded with a reason.

Built for the [Find Your Way Hackathon](https://demo.stellarpassport.xyz/hackathons/find-your-way-meridian-hackathon) by Tellus Cooperative.

## Status

Work in progress. Running on Stellar **testnet**.

- Contract: [`contracts/habeas`](contracts/habeas), 54 tests against the real Stellar Asset Contract, deployed from a [verified GitHub build](docs/EVIDENCE.md#check-the-build-yourself).
- Every case ending has been run on testnet, with transaction links: [`docs/EVIDENCE.md`](docs/EVIDENCE.md).
- How cases work, functions, errors and events: [`docs/SPEC-cases.md`](docs/SPEC-cases.md).
- Coming next: a token check that reads real mainnet data, case pages, and "Try it live".

## Closing the back door

Making Habeas the token's admin is not enough on its own. The issuer's account can still freeze or take back with classic Stellar operations, skipping the contract. We tested this on testnet ([S4](spikes/RESULTS.md#s4-the-classic-back-door)). There are two ways to close it, and the token check reports which one an asset uses:

- **The reviewer co-signs (what a real bank would choose).** The reviewer is added as a signer on the issuer account and the thresholds are raised, so the issuer can't sign a freeze or take back alone. The bank keeps its account for anything else it may need later, but only with the reviewer's agreement.
- **The issuer key is switched off (the demo).** Once the account's classic setup is finished, its key weight is set to 0. Nobody can ever sign for it again; minting still works because it goes through Habeas. It's the simplest setup to verify, and it can't be undone.

## Reviewer: one person or a panel

The demo uses one reviewer key. The contract doesn't care what kind of address the reviewer is, so a panel works without any change: a Stellar multisig account or a smart account. The test [`two_of_three_members_can_decide`](contracts/habeas/src/test.rs) registers a 2-of-3 panel as the reviewer and signs decisions with real ed25519 keys: two members can decide, while one member alone, an outsider, or the same member twice are refused.

## Run it yourself

You need Rust, the [Stellar CLI](https://developers.stellar.org/docs/tools/cli) (28.x) and Node 20+.

```bash
cargo test
```

```bash
bash scripts/deploy-testnet.sh
```

```bash
cd scripts && npm install && cd .. && node scripts/run-demo-cases.mjs
```

The deploy script creates fresh testnet accounts with Friendbot, issues a demo asset, deploys Habeas, locks the issuer account and checks the lock. The second script runs every kind of case and writes the transaction hashes to `deployments/testnet-run.json`.

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
