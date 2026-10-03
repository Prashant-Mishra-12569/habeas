# Progress

Updated after every milestone. Newest first.

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

### Next

- Create the public `habeas` repo on GitHub and push (waiting on `gh auth login`).
- Phase 2: the Habeas contract in `contracts/habeas/`.
