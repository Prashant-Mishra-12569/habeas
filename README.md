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

- Contract: [`contracts/habeas`](contracts/habeas), 50 tests against the real Stellar Asset Contract, deployed from a [verified GitHub build](docs/EVIDENCE.md#check-the-build-yourself).
- Every case ending has been run on testnet, with transaction links: [`docs/EVIDENCE.md`](docs/EVIDENCE.md).
- How cases work, functions, errors and events: [`docs/SPEC-cases.md`](docs/SPEC-cases.md).
- Coming next: a token check that reads real mainnet data, case pages, and "Try it live".

## Closing the back door

Making Habeas the token's admin is not enough on its own. The issuer's account can still freeze or take back with classic Stellar operations, skipping the contract. We tested this on testnet ([S4](spikes/RESULTS.md#s4-the-classic-back-door)). Habeas deployments lock the issuer account so the reviewer must co-sign any classic action, and the token check will report whether an asset's back door is really closed.

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

## What this does not do

- It does not decide who is right. The reviewer does.
- The reviewer is chosen by the issuer. Independent reviewer networks are future work.
- While a case is open, the holder's whole balance of that token is frozen, not just the disputed amount. That's how Stellar freezing works. Only up to the case amount can be taken back.
- No real issuer uses it yet. It runs on testnet.
- Files stay off-chain. Only their fingerprints (SHA-256) are public.

## Related work

[MintGate](https://github.com/SURUJ404/stellarcontracts) also puts a contract in charge of a token's admin powers, with roles, mint limits and a freeze before seizing. It controls the issuer's own staff; it has no holder notice, answer, reviewer or default unfreeze. Habeas is about the holder's side.

## License

MIT
