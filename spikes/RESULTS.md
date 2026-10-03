# Phase 1 spike results

Run on Stellar testnet on Oct 3, 2026 with Stellar CLI 28.1.0, soroban-sdk 28.0.0 and @stellar/stellar-sdk 17.2.1. Every link below was checked on Horizon after the run.

**All four spikes passed.** One design change came out of S4 (see the end).

Links go to [stellar.expert](https://stellar.expert/explorer/testnet). `tx` = transaction.

## Setup

| What | Address |
| --- | --- |
| Issuer (DEMOUSD) | `GA6L645WCJLPTCTMNGWSB7C7IFIF35FX6BFFVZBK5V2EUILPPUX5K5G4` |
| Holder | `GB7ZYVZJ6GQN4QS7DFC2RSGMCEHV5OYXLF3DD3VDIPPF4E6OEH2NS3NX` |
| Reviewer | `GBQDEQ6YFF5Z3WXSRO6PBVOFYGKHNKY5QXLLCOJQN3W6C7RUC4HLYBBY` |
| Relayer | `GAXJZQQE6XWVP5HVJ6LPVS5IC37CYGQ2J5LTUYLKT5KZE6YJFIJ7LRE5` |
| DEMOUSD asset contract (SAC) | `CBYTIJBUIRKGHDNWJQAW35KVIGF2S2A23IZVWCTULB6X6RVULQX2FVQU` |
| Spike admin contract | `CCGZN3OMNLFLMELPOU7QHGFM242RPTGW7K3V2QDZJFGJQXKBS3YIM5QJ` |

The spike contract is in [`spike-admin/src/lib.rs`](spike-admin/src/lib.rs). It wraps the SAC's `set_authorized`, `clawback` and `mint`, plus an `appeal` that needs only the holder's signature.

| Step | tx |
| --- | --- |
| Issuer turns on `AUTH_REVOCABLE` + `AUTH_CLAWBACK_ENABLED` (before any trustline) | [4a480064](https://stellar.expert/explorer/testnet/tx/4a4800640106699a6023d232a2659b5e7ad7a003dcec1cd3e0e528eec11a6e28) |
| Holder opens a DEMOUSD trustline (Horizon shows `is_clawback_enabled: true`) | [1d25d4e2](https://stellar.expert/explorer/testnet/tx/1d25d4e240a910ffe1272e8bb3179888025a5cdd3126f27169d124e2c443f01e) |
| Issuer sends the holder 1,000 DEMOUSD | [fcdec2eb](https://stellar.expert/explorer/testnet/tx/fcdec2eb3fdd636853337e458f8813124e267c615583410ebc65f83d00da539d) |
| Deploy the DEMOUSD SAC | [ac468ab2](https://stellar.expert/explorer/testnet/tx/ac468ab286e1099ffb85e68aa0e9f9db3ca688d0f4947338ecd2e3fdb8bb1afd) |
| Deploy the spike admin contract | [02e267ce](https://stellar.expert/explorer/testnet/tx/02e267cea1c46c8a952a0ad343355d571ae466137d3ff0acf80fa8f81de80817) |
| `set_admin`: SAC admin moves from the issuer to the spike contract | [a3c1e83c](https://stellar.expert/explorer/testnet/tx/a3c1e83c3d48534424830d43a490cecfeb87e25f81c5ec828bd4edcf2c4e5025) |

## S1: a contract set as SAC admin can freeze, unfreeze, take back and mint

**Passed.**

| Call through the contract | Holder after | tx |
| --- | --- | --- |
| `freeze` | authorized = false, 1,000 | [4567d844](https://stellar.expert/explorer/testnet/tx/4567d844110726a99a8f27a083d7206f3ea9c03502801b4338ec357866c9bc2d) |
| `unfreeze` | authorized = true, 1,000 | [275aa363](https://stellar.expert/explorer/testnet/tx/275aa363807fcb5ead5aef62b1443aa5e2733034fb5a4619768ee2567fab011b) |
| `take_back` 100 | 900 | [30a91605](https://stellar.expert/explorer/testnet/tx/30a91605803fafc3a2a2b36ec143fd5f19d069e9103a68a6343763956fe84659) |
| `mint` 50 | 950 | [03babdc2](https://stellar.expert/explorer/testnet/tx/03babdc27cb5d756f045436b74c4f7e8cae3cc6289e077d11396b3607c9b1333) |

A frozen holder really can't move tokens: holder2 was frozen through the contract ([2b7f5128](https://stellar.expert/explorer/testnet/tx/2b7f51282629ba68493c25eeb5886e04b6af6347f6bae2418107f5bdd166135e)), then tried to send LOCKUSD and failed on-chain with `src_not_authorized` ([9281ea40](https://stellar.expert/explorer/testnet/tx/9281ea4022a90f4754fc873d393eb195c2e453b6f90fc3781bcff40659085abb)), then was unfrozen ([fa91f9e7](https://stellar.expert/explorer/testnet/tx/fa91f9e770e2796d097ed91559a30bece73b814d805f6f9ec1dc055973669923)).

(An earlier attempt, [211b111e](https://stellar.expert/explorer/testnet/tx/211b111ea3908f29ad0f4160e171408cef30efc5315f17c3b7a0a17fab308c6f), failed with `no_trust` because the receiver had no trustline. That proves nothing about freezing, so it is not counted.)

## S2: take back from a balance held by a contract (C... address)

**Passed.** A second copy of the spike contract (`CDYZPP3VUBA2RZ3OU5JIEGPRFF6GUOY2BN7GL4BKNF5IGGHSAHBCLGPU`, [deploy 325fdd01](https://stellar.expert/explorer/testnet/tx/325fdd01d17c4dc815231eec90ecb94b680a1e2b3d45687d456289bc8c2cfa35)) stood in for a pool.

| Call | Contract balance after | tx |
| --- | --- | --- |
| `mint` 200 to the contract | 200, authorized | [eddee607](https://stellar.expert/explorer/testnet/tx/eddee607960bb43925feeb68c4a79e6038391bcc85a446ce26181a2224eab37d) |
| `freeze` the contract | 200, frozen | [9a313fda](https://stellar.expert/explorer/testnet/tx/9a313fdace0f4f5a8b5096a61258a140266404999cd71b08ed6e5b2d6d5836a1) |
| `take_back` 50 **while frozen** | 150 | [dc9a733c](https://stellar.expert/explorer/testnet/tx/dc9a733cf7dafc039353fd240580f575a6be189c40b38803af65568885964de1) |
| `unfreeze` | 150, authorized | [fc1d996f](https://stellar.expert/explorer/testnet/tx/fc1d996f1d40edb3f02d625bb18d37bb19ab2eaab33692f82dabd9d1ac07fed5) |

Take-back works on a frozen balance, which the contract needs: `open_case` freezes and `settle` may later take back.

## S3: free appeal (holder signs, relayer pays)

**Passed** using the SDK's `authorizeEntry`. Script: [`js/s3-free-appeal.mjs`](js/s3-free-appeal.mjs).

1. Holder frozen ([7958040c](https://stellar.expert/explorer/testnet/tx/7958040c210a5d52ebbf55c9ebf52f85087e53bd513853f273ee7eec6ffd0408)) and left with exactly 1.5 XLM, the network minimum for one trustline, so it can't pay any fee ([2710283d](https://stellar.expert/explorer/testnet/tx/2710283db2bbd2a3a56b03d2bd228d7da58220bbb5d096e32108d30f08d75bb6)).
2. Relayer builds `appeal(holder)` with itself as the transaction source and simulates it. The holder signs only the one Soroban auth entry. The relayer re-simulates, signs the envelope and submits.
3. Results: [a1729181](https://stellar.expert/explorer/testnet/tx/a17291818ac358d5b95ab5088a51fb0785bdc169f90bfdcda7cae3251f453b7c) and [73788e68](https://stellar.expert/explorer/testnet/tx/73788e68a858b6be93853568c1979ad6669d51b2838f1bee15f589b5e5164493). Holder XLM 1.5000000 before and after. Relayer paid 0.0016313 XLM.

**Confirmed in a real wallet (Oct 3, 2026):** on the live site (`/try`), Freighter in Chrome showed "Confirm Authorizations: appeal", signed only the authorization, and the relayer submitted and paid: [8d2c8c93](https://stellar.expert/explorer/testnet/tx/8d2c8c9372c126a6e6bec26190115e228f0a1b33cb10d743bb2221a7056ca859) (case 8, holder `GDFTUXEF…GKGN6`). The network now hands out CAP-71 `addressV2` credentials, whose preimage type is new; Freighter signed it as is, so the planned fallbacks (legacy credentials, fee bump) weren't needed. Full steps in `deployments/testnet-freighter.json`.

## S4: the classic back door

**Confirmed open, then closed.** Run on a second asset, LOCKUSD, so the contract's operator could be a key separate from the issuer account (see "Design change" below).

| What | Address |
| --- | --- |
| Issuer 2 (LOCKUSD) | `GAP62PXB2JKTRP5IYV5S5QJIGUJLDR7OHYP5GNHERGOKZT62OAOZWD6E` |
| Holder 2 | `GAN4G4XMVVL2GLBOPUSKEUUPDPBC67P3TPLFMZF3JQLMN2L5ITGHHBTJ` |
| LOCKUSD SAC | `CC3XUZJVPR46U7RJES2FC4PTYBSOO5LTGYZ732Z3JI656ENC26FHGARX` ([deploy 97fbd547](https://stellar.expert/explorer/testnet/tx/97fbd547f4a957213b08b97ff4ff61db5cc6d9ab5e1850d9e768e832c6dc4667)) |
| Spike admin, operator = relayer | `CAQXXHFBX2QPJ4C3TNNLSCAVKEEQHOUXHV677XILXX4JRQAEUC6KKF75` ([deploy daa07f5e](https://stellar.expert/explorer/testnet/tx/daa07f5ec082969bfc928875fab010f89a81cd01bf33d06c1884614edc6cd735)) |

Setup: flags [f61bfed2](https://stellar.expert/explorer/testnet/tx/f61bfed2ef2541ac9ff2c3af00999d059a79a43e1fe9fe564bed85e542caa47a), trustline [1ad51eaa](https://stellar.expert/explorer/testnet/tx/1ad51eaa72257f2f9004771b5582db2fa139b03231da9515f5dcc0014fbfddfd), 1,000 LOCKUSD [e8540b4d](https://stellar.expert/explorer/testnet/tx/e8540b4df759c28d0dcaae36f98229780e7f8e8bee10507b9cb47b7e77adca49), `set_admin` to the contract [0c3a7e1b](https://stellar.expert/explorer/testnet/tx/0c3a7e1bd3ab16820316b71b3ce41f141d17bce91b551cbcc6c39bf15f652fac).

**Before the lock**, with a contract as SAC admin, the issuer account alone can still skip it:

| Classic operation, issuer signs alone | Result | tx |
| --- | --- | --- |
| `Clawback` 10 LOCKUSD | Succeeded, 1,000 → 990 | [e0856c3e](https://stellar.expert/explorer/testnet/tx/e0856c3e8cbf825e678ec5ba9d903628400236aa30f8b17a48bd4ab02772bf03) |
| `SetTrustLineFlags` clear authorize (freeze) | Succeeded | [34ef736c](https://stellar.expert/explorer/testnet/tx/34ef736c1c0d4d182e978b411670d38fab9edf1398b85e4b9ba38be148eaad93) |
| `SetTrustLineFlags` set authorize (unfreeze) | Succeeded | [b2e93923](https://stellar.expert/explorer/testnet/tx/b2e9392324d8841dda69fe1aa3f64df7495f30162b555580366368bf0d7aebe3) |

So `set_admin` alone does **not** make Habeas a guarantee.

**The lock:** issuer 2 adds the reviewer as a signer (weight 1), keeps its own key at weight 1, and sets low/medium/high thresholds to 2 ([2f3956eb](https://stellar.expert/explorer/testnet/tx/2f3956ebbaa8eac4f161da0bf19ace21303415572a600e52891b2b61c34f025c)). Horizon confirms signers `GAP62P…:1, GBQDEQ…:1`, thresholds 2/2/2. Both keys together can undo this.

**After the lock:**

| Attempt | Result |
| --- | --- |
| Issuer alone, classic `Clawback` | Rejected: `TxBadAuth`. Never reached the ledger, so there is no tx link |
| Issuer alone, classic freeze | Rejected: `TxBadAuth`. No tx link, same reason |
| Taking the SAC admin back (`set_admin` on the SAC) | Refused: needs the current admin's auth, which is the contract |
| Contract `freeze` | Worked: [471b07ff](https://stellar.expert/explorer/testnet/tx/471b07ffb77e7c597294261d21ef3e25c9798d15f87f6f886ef58526fb12bdb2) |
| Contract `take_back` 10 | Worked, 990 → 980: [4232edec](https://stellar.expert/explorer/testnet/tx/4232edeceda3409bc8d0515a345351d7280b3c68a265229d7d0632d79d4638c0) |
| Contract `unfreeze` | Worked: [6cd9f2d8](https://stellar.expert/explorer/testnet/tx/6cd9f2d8843442c5b5741a419cbdbdb665a5ed91f1900f77e81505bf070f31d7) |
| Contract `mint` 10 | Worked, 980 → 990: [394b31e3](https://stellar.expert/explorer/testnet/tx/394b31e3516012a4153e76054ef45ce83c38ae3f7667578812d9689aabc116f8) |

Minting keeps working after the lock because SAC `mint` only needs the SAC admin (the contract), not the issuer account's signature.

## Design change from S4

The contract's "issuer" role must be **a separate operator address, not the asset's classic issuer account.** Once the issuer account is locked (multisig with the reviewer, or master weight 0), any `require_auth` on that account also needs the reviewer. That would make every routine `open_case` and `mint` need the reviewer too.

So in `__constructor(sac, issuer, reviewer, ...)`, `issuer` is the operator key the issuer's staff use. The asset's classic issuer account gets locked and is only used for setup. The asset check should report:

- **Back door closed:** SAC admin is a verified Habeas contract **and** the classic issuer account can't sign `Clawback` / `SetTrustLineFlags` alone (master weight 0, or medium threshold above the issuer key's weight with the reviewer as co-signer).
- **Back door open:** anything else, even if the SAC admin is Habeas.

Two lock options for real issuers. Both should be documented:

1. **Reviewer as co-signer** (tested above). Can be undone with both signatures.
2. **Master weight 0, no other signers.** Permanent: the issuer account can never sign again. Simplest to verify. Not tested here because it can't be undone; we'll ask before using it.
