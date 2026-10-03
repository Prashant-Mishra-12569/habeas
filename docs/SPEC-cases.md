# Habeas contract: how a case works

Source: `contracts/habeas/src/`. One Habeas contract per asset, set as that asset's Stellar Asset Contract (SAC) admin.

## Roles

| Role | Who | Can do |
| --- | --- | --- |
| Issuer | An operator key of the token issuer. **Not** the asset's classic issuer account, which is locked (see `spikes/RESULTS.md`, S4) | Open and withdraw cases, mint, approve holders |
| Reviewer | A neutral person or panel (any Stellar address, so a multisig account works) | Decide answered cases |
| Holder | Anyone holding the asset | Answer their own case |
| Anyone | Any account, including our relayer | Settle a case once it can close, extend storage |

## Lifecycle

```
open_case ──► Open (frozen)
               │ holder answers in time ─► Answered (frozen)
               │                            │ reviewer upholds ─► Upheld ─┐
               │                            │ reviewer rejects ─► Rejected ┤ settle
               │                            │ reviewer silent past window ─┤
               │ no answer, window over ───────────────────────────────────┤
               │ issuer withdraws (any active state) ──────────────────────┤
               │ issuer + reviewer emergency_close ────────────────────────┤
               ▼                                                           ▼
                                                     Cleared (unfrozen)  or  Taken back
```

| Ending | `status` | `ended_by` | Tokens |
| --- | --- | --- | --- |
| Reviewer rejects, then settle | `Cleared` | `ReviewerRejected` | Holder keeps all, unfrozen |
| Reviewer silent past the review window, then settle | `Cleared` | `ReviewerSilent` | Holder keeps all (holder wins by default) |
| Issuer withdraws | `Cleared` | `Withdrawn` | Holder keeps all, unfrozen |
| Reviewer upholds, then settle | `TakenBack` | `ReviewerUpheld` | `amount` taken back, rest unfrozen |
| Holder never answers, window over, then settle | `TakenBack` | `NoAnswer` | `amount` taken back, rest unfrozen |
| Emergency (issuer **and** reviewer) | `TakenBack` | `Emergency` | Given amount taken back at once, rest unfrozen |

While a case is active, the holder's **whole** balance of that asset is frozen (that's how SAC freezing works); only up to `amount` can be taken back. Take-back never exceeds the current balance.

## Functions

| Function | Signs | Errors it can return |
| --- | --- | --- |
| `open_case(holder, amount, reason, statement, file_hash) -> u64` | issuer | `InvalidHolder`, `StatementRequired`, `StatementTooLong`, `InvalidAmount`, `AmountTooHigh`, `AlreadyActiveCase` |
| `appeal(case_id, statement, file_hash?)` | holder | `CaseNotFound`, `AlreadyAnswered`, `CaseNotActive`, `StatementTooLong`, `AnswerWindowClosed` |
| `decide(case_id, uphold, statement, file_hash?)` | reviewer | `CaseNotFound`, `NotAnswered`, `AlreadyDecided`, `CaseNotActive`, `StatementRequired`, `ReviewWindowClosed` |
| `settle(case_id) -> Status` | nobody | `CaseNotFound`, `TooEarlyToSettle`, `CaseNotActive` |
| `withdraw(case_id)` | issuer | `CaseNotFound`, `CaseNotActive` |
| `emergency_take_back(holder, amount, reason, statement, file_hash) -> u64` | issuer + reviewer | as `open_case` |
| `emergency_close(case_id, amount, statement, file_hash)` | issuer + reviewer | `CaseNotActive`, amount errors |
| `mint(to, amount)` | issuer | `InvalidAmount` |
| `approve_holder(holder)` | issuer | `AlreadyActiveCase` (can't unfreeze someone with a case) |
| `change_reviewer(new_reviewer)` | issuer + current reviewer + new reviewer | `SameIssuerAndReviewer` |
| `propose_handover(new_admin)` | issuer + reviewer | |
| `cancel_handover(by)` | `by` (issuer or reviewer) | `NotIssuerOrReviewer`, `NoPendingHandover` |
| `complete_handover()` | nobody, after 7 days | `NoPendingHandover`, `HandoverNotReady`, `ActiveCasesExist` |
| `bump(case_id)` | nobody | `CaseNotFound` |

Reads: `get_config`, `get_case(id)`, `cases_for(holder)`, `active_case(holder)`, `case_count`, `active_count`, `pending_handover`, `version`.

Deadlines are inclusive: the holder can answer at exactly `answer_by`; settling for no answer needs `now > answer_by`. Same for `review_by`.

Statements are public, at most 280 bytes. The issuer and the reviewer must give one; the holder's is optional. Files stay off-chain; only their SHA-256 fingerprint is stored.

## Reason codes

`Fraud`, `SanctionsOrder`, `SentByMistake`, `CourtOrder`, `Other`. Enums are stored by name, so explorers show `["Fraud"]`, not a number.

## Error codes

| # | Name | # | Name |
| --- | --- | --- | --- |
| 1 | CaseNotFound | 11 | AlreadyDecided |
| 2 | CaseNotActive | 12 | InvalidHolder |
| 3 | AlreadyActiveCase | 13 | StatementRequired |
| 4 | InvalidAmount | 14 | StatementTooLong |
| 5 | AmountTooHigh | 15 | InvalidWindow |
| 6 | AnswerWindowClosed | 16 | SameIssuerAndReviewer |
| 7 | ReviewWindowClosed | 17 | NoPendingHandover |
| 8 | TooEarlyToSettle | 18 | HandoverNotReady |
| 9 | NotAnswered | 19 | ActiveCasesExist |
| 10 | AlreadyAnswered | 20 | NotIssuerOrReviewer |

Careful in clients: the asset contract (SAC) has its own numbered errors (for example #13 = trustline missing). Only treat a code as a Habeas error when the diagnostic log shows Habeas raised it. `scripts/lib/stellar.mjs` does this.

## Events

First topic is the event name. `case_id` and `holder` are topics so a watcher can filter by holder.

| Event | Topics | Data |
| --- | --- | --- |
| `case_opened` | case_id, holder | amount, reason, answer_by |
| `case_appealed` | case_id, holder | review_by |
| `case_decided` | case_id, holder | upheld |
| `case_settled` | case_id, holder | outcome, ended_by, taken |
| `case_withdrawn` | case_id, holder | |
| `emergency_take_back` | case_id, holder | taken |
| `holder_approved` | holder | |
| `reviewer_changed` | | old_reviewer, new_reviewer |
| `handover_proposed` / `handover_cancelled` / `handover_completed` | | new_admin, ready_at / cancelled_by |

## Storage

Config, counters and a pending handover live in instance storage. Cases, each holder's active case and history live in persistent storage. Every entry touched is extended to about 90 days; windows are capped at 30 days, so a case always outlives its deadlines. `bump(case_id)` lets anyone extend a case.
