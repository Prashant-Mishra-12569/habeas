//! Tests run against the real Stellar Asset Contract built into the SDK, with
//! the issuer's revocable and clawback flags set, as on testnet.
extern crate std;

use super::*;
use crate::events;
use crate::storage::{DataKey, EXTEND_TO};
use soroban_sdk::{
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, Events as _, IssuerFlags, Ledger as _, MockAuth, MockAuthInvoke,
    },
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, IntoVal, String, Val, Vec,
};

const ANSWER: u64 = 3 * 24 * 60 * 60;
const REVIEW: u64 = 2 * 24 * 60 * 60;
const START: u64 = 1_790_000_000;
/// 1,000 tokens with 7 decimals.
const BALANCE: i128 = 10_000_000_000;

struct T {
    env: Env,
    id: Address,
    sac: Address,
    issuer: Address,
    reviewer: Address,
    holder: Address,
}

impl T {
    fn new() -> T {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|l| {
            l.timestamp = START;
            l.sequence_number = 1_000;
        });
        let issuer = Address::generate(&env);
        let reviewer = Address::generate(&env);
        let holder = Address::generate(&env);

        // The asset's classic issuer account is separate from the Habeas
        // issuer key (see spikes/RESULTS.md, S4).
        let asset_issuer = Address::generate(&env);
        let asset = env.register_stellar_asset_contract_v2(asset_issuer);
        asset.issuer().set_flag(IssuerFlags::RevocableFlag);
        asset.issuer().set_flag(IssuerFlags::ClawbackEnabledFlag);
        let sac = asset.address();

        let id = env.register(
            Habeas,
            (
                sac.clone(),
                issuer.clone(),
                reviewer.clone(),
                ANSWER,
                REVIEW,
            ),
        );
        StellarAssetClient::new(&env, &sac).set_admin(&id);
        let t = T {
            env,
            id,
            sac,
            issuer,
            reviewer,
            holder,
        };
        t.c().mint(&t.holder, &BALANCE);
        t
    }

    fn c(&self) -> HabeasClient<'_> {
        HabeasClient::new(&self.env, &self.id)
    }

    fn token(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.sac)
    }

    fn asset(&self) -> StellarAssetClient<'_> {
        StellarAssetClient::new(&self.env, &self.sac)
    }

    fn s(&self, text: &str) -> String {
        String::from_str(&self.env, text)
    }

    fn file(&self, byte: u8) -> BytesN<32> {
        BytesN::from_array(&self.env, &[byte; 32])
    }

    fn open(&self, amount: i128) -> u64 {
        self.c().open_case(
            &self.holder,
            &amount,
            &Reason::Fraud,
            &self.s("Card payment reported as stolen"),
            &self.file(1),
        )
    }

    fn appeal(&self, id: u64) {
        self.c()
            .appeal(&id, &self.s("This was my own card"), &Some(self.file(2)));
    }

    fn decide(&self, id: u64, uphold: bool) {
        self.c()
            .decide(&id, &uphold, &self.s("Bank statement checked"), &None);
    }

    fn advance(&self, secs: u64) {
        self.env.ledger().with_mut(|l| {
            l.timestamp += secs;
            l.sequence_number += (secs / 5) as u32;
        });
    }

    fn frozen(&self, who: &Address) -> bool {
        !self.asset().authorized(who)
    }

    fn balance(&self, who: &Address) -> i128 {
        self.token().balance(who)
    }

    /// Addresses whose signature the last call needed.
    fn signers(&self) -> std::vec::Vec<Address> {
        self.env.auths().into_iter().map(|(a, _)| a).collect()
    }

    /// From now on only `who` has signed a call to `fn_name` with `args`.
    fn only_signer(&self, who: &Address, fn_name: &str, args: Vec<Val>) {
        self.env.mock_auths(&[MockAuth {
            address: who,
            invoke: &MockAuthInvoke {
                contract: &self.id,
                fn_name,
                args,
                sub_invokes: &[],
            },
        }]);
    }

    fn emitted(&self, event: impl soroban_sdk::Event) -> bool {
        let xdr = event.to_xdr(&self.env, &self.id);
        self.env
            .events()
            .all()
            .filter_by_contract(&self.id)
            .events()
            .contains(&xdr)
    }
}

// ------------------------------------------------------------ constructor

#[test]
fn constructor_stores_config() {
    let t = T::new();
    let cfg = t.c().get_config();
    assert_eq!(cfg.sac, t.sac);
    assert_eq!(cfg.issuer, t.issuer);
    assert_eq!(cfg.reviewer, t.reviewer);
    assert_eq!(cfg.answer_window, ANSWER);
    assert_eq!(cfg.review_window, REVIEW);
    assert_eq!(t.c().version(), 1);
    assert_eq!(t.c().case_count(), 0);
    assert_eq!(t.asset().admin(), t.id);
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn constructor_rejects_issuer_as_reviewer() {
    let env = Env::default();
    let a = Address::generate(&env);
    let sac = Address::generate(&env);
    env.register(Habeas, (sac, a.clone(), a, ANSWER, REVIEW));
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn constructor_rejects_zero_window() {
    let env = Env::default();
    let sac = Address::generate(&env);
    let (i, r) = (Address::generate(&env), Address::generate(&env));
    env.register(Habeas, (sac, i, r, 0u64, REVIEW));
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn constructor_rejects_window_over_30_days() {
    let env = Env::default();
    let sac = Address::generate(&env);
    let (i, r) = (Address::generate(&env), Address::generate(&env));
    env.register(Habeas, (sac, i, r, ANSWER, MAX_WINDOW_SECS + 1));
}

// ---------------------------------------------------------------- open_case

#[test]
fn open_case_freezes_and_records_everything() {
    let t = T::new();
    let id = t.open(4_000_000_000);
    assert_eq!(t.signers(), std::slice::from_ref(&t.issuer));
    assert!(t.emitted(events::CaseOpened {
        case_id: id,
        holder: t.holder.clone(),
        amount: 4_000_000_000,
        reason: Reason::Fraud,
        answer_by: START + ANSWER,
    }));

    assert_eq!(id, 1);
    assert!(t.frozen(&t.holder));
    assert_eq!(t.balance(&t.holder), BALANCE);
    let case = t.c().get_case(&id);
    assert_eq!(case.status, Status::Open);
    assert_eq!(case.amount, 4_000_000_000);
    assert_eq!(case.reason, Reason::Fraud);
    assert_eq!(case.statement, t.s("Card payment reported as stolen"));
    assert_eq!(case.issuer_file, t.file(1));
    assert_eq!(case.opened_at, START);
    assert_eq!(case.answer_by, START + ANSWER);
    assert_eq!(case.ended_by, EndedBy::NotEnded);
    assert_eq!(t.c().active_case(&t.holder), Some(id));
    assert_eq!(t.c().cases_for(&t.holder), soroban_sdk::vec![&t.env, id]);
    assert_eq!(t.c().case_count(), 1);
    assert_eq!(t.c().active_count(), 1);
}

#[test]
fn frozen_holder_cannot_move_tokens() {
    let t = T::new();
    t.open(10);
    let other = Address::generate(&t.env);
    assert!(t.token().try_transfer(&t.holder, &other, &1).is_err());
}

#[test]
fn open_case_needs_the_issuer() {
    let t = T::new();
    let stranger = Address::generate(&t.env);
    let (amount, reason, statement, file) = (10i128, Reason::Fraud, t.s("x"), t.file(1));
    t.only_signer(
        &stranger,
        "open_case",
        (&t.holder, amount, reason, &statement, &file).into_val(&t.env),
    );
    let r = t
        .c()
        .try_open_case(&t.holder, &amount, &reason, &statement, &file);
    assert!(matches!(r, Err(Err(_))));
    assert!(!t.frozen(&t.holder));
}

#[test]
fn open_case_rejects_bad_amounts() {
    let t = T::new();
    let (s, f) = (t.s("x"), t.file(1));
    let open = |amount: i128| {
        t.c()
            .try_open_case(&t.holder, &amount, &Reason::Other, &s, &f)
    };
    assert_eq!(open(0), Err(Ok(Error::InvalidAmount)));
    assert_eq!(open(-5), Err(Ok(Error::InvalidAmount)));
    assert_eq!(open(BALANCE + 1), Err(Ok(Error::AmountTooHigh)));
    assert!(open(BALANCE).is_ok());
}

#[test]
fn one_active_case_per_holder() {
    let t = T::new();
    t.open(10);
    let r = t
        .c()
        .try_open_case(&t.holder, &5, &Reason::Other, &t.s("again"), &t.file(1));
    assert_eq!(r, Err(Ok(Error::AlreadyActiveCase)));
}

#[test]
fn open_case_rejects_issuer_reviewer_and_habeas_as_holder() {
    let t = T::new();
    for who in [t.issuer.clone(), t.reviewer.clone(), t.id.clone()] {
        let r = t
            .c()
            .try_open_case(&who, &1, &Reason::Other, &t.s("x"), &t.file(1));
        assert_eq!(r, Err(Ok(Error::InvalidHolder)));
    }
}

#[test]
fn open_case_needs_a_short_public_reason() {
    let t = T::new();
    let f = t.file(1);
    let r = t
        .c()
        .try_open_case(&t.holder, &1, &Reason::Other, &t.s(""), &f);
    assert_eq!(r, Err(Ok(Error::StatementRequired)));
    let long = "a".repeat(MAX_STATEMENT_BYTES as usize + 1);
    let r = t
        .c()
        .try_open_case(&t.holder, &1, &Reason::Other, &t.s(&long), &f);
    assert_eq!(r, Err(Ok(Error::StatementTooLong)));
    let max = "a".repeat(MAX_STATEMENT_BYTES as usize);
    assert!(t
        .c()
        .try_open_case(&t.holder, &1, &Reason::Other, &t.s(&max), &f)
        .is_ok());
}

// ------------------------------------------------------------------- appeal

#[test]
fn holder_appeals_inside_the_window() {
    let t = T::new();
    let id = t.open(10);
    t.advance(ANSWER - 60);
    t.appeal(id);
    assert_eq!(t.signers(), std::slice::from_ref(&t.holder));
    let now = START + ANSWER - 60;
    assert!(t.emitted(events::CaseAppealed {
        case_id: id,
        holder: t.holder.clone(),
        review_by: now + REVIEW,
    }));

    let case = t.c().get_case(&id);
    assert_eq!(case.status, Status::Answered);
    assert_eq!(case.answered_at, now);
    assert_eq!(case.review_by, now + REVIEW);
    assert_eq!(case.holder_statement, t.s("This was my own card"));
    assert_eq!(case.holder_file, Some(t.file(2)));
    assert!(t.frozen(&t.holder));
}

#[test]
fn appeal_on_the_last_second_counts() {
    let t = T::new();
    let id = t.open(10);
    t.advance(ANSWER);
    t.appeal(id);
    assert_eq!(t.c().get_case(&id).status, Status::Answered);
}

#[test]
fn appeal_after_the_window_is_refused() {
    let t = T::new();
    let id = t.open(10);
    t.advance(ANSWER + 1);
    let r = t.c().try_appeal(&id, &t.s(""), &None);
    assert_eq!(r, Err(Ok(Error::AnswerWindowClosed)));
}

#[test]
fn appeal_twice_is_refused() {
    let t = T::new();
    let id = t.open(10);
    t.appeal(id);
    assert_eq!(
        t.c().try_appeal(&id, &t.s(""), &None),
        Err(Ok(Error::AlreadyAnswered))
    );
}

#[test]
fn appeal_without_a_statement_or_file_is_allowed() {
    let t = T::new();
    let id = t.open(10);
    t.c().appeal(&id, &t.s(""), &None);
    assert_eq!(t.c().get_case(&id).status, Status::Answered);
}

#[test]
fn only_the_holder_can_appeal() {
    let t = T::new();
    let id = t.open(10);
    let (s, f): (String, Option<BytesN<32>>) = (t.s("not me"), None);
    t.only_signer(&t.issuer, "appeal", (id, &s, &f).into_val(&t.env));
    assert!(matches!(t.c().try_appeal(&id, &s, &f), Err(Err(_))));
}

#[test]
fn appeal_on_missing_case() {
    let t = T::new();
    assert_eq!(
        t.c().try_appeal(&99, &t.s(""), &None),
        Err(Ok(Error::CaseNotFound))
    );
}

// ------------------------------------------------------------------- decide

#[test]
fn reviewer_decides_after_the_appeal() {
    let t = T::new();
    let id = t.open(10);
    t.appeal(id);
    t.advance(100);
    t.decide(id, false);
    assert_eq!(t.signers(), std::slice::from_ref(&t.reviewer));
    assert!(t.emitted(events::CaseDecided {
        case_id: id,
        holder: t.holder.clone(),
        upheld: false,
    }));
    let case = t.c().get_case(&id);
    assert_eq!(case.status, Status::Rejected);
    assert_eq!(case.decided_at, START + 100);
    assert_eq!(case.reviewer_statement, t.s("Bank statement checked"));
    // Still frozen until someone settles.
    assert!(t.frozen(&t.holder));
}

#[test]
fn reviewer_cannot_decide_before_the_holder_answers() {
    let t = T::new();
    let id = t.open(10);
    let r = t.c().try_decide(&id, &true, &t.s("x"), &None);
    assert_eq!(r, Err(Ok(Error::NotAnswered)));
}

#[test]
fn reviewer_cannot_decide_after_the_review_window() {
    let t = T::new();
    let id = t.open(10);
    t.appeal(id);
    t.advance(REVIEW + 1);
    let r = t.c().try_decide(&id, &true, &t.s("late"), &None);
    assert_eq!(r, Err(Ok(Error::ReviewWindowClosed)));
}

#[test]
fn reviewer_decides_once() {
    let t = T::new();
    let id = t.open(10);
    t.appeal(id);
    t.decide(id, true);
    let r = t
        .c()
        .try_decide(&id, &false, &t.s("changed my mind"), &None);
    assert_eq!(r, Err(Ok(Error::AlreadyDecided)));
}

#[test]
fn reviewer_must_explain_the_decision() {
    let t = T::new();
    let id = t.open(10);
    t.appeal(id);
    let r = t.c().try_decide(&id, &true, &t.s(""), &None);
    assert_eq!(r, Err(Ok(Error::StatementRequired)));
}

#[test]
fn issuer_cannot_decide() {
    let t = T::new();
    let id = t.open(10);
    t.appeal(id);
    let (s, f): (String, Option<BytesN<32>>) = (t.s("I win"), None);
    t.only_signer(&t.issuer, "decide", (id, true, &s, &f).into_val(&t.env));
    assert!(matches!(t.c().try_decide(&id, &true, &s, &f), Err(Err(_))));
}

// ------------------------------------------------------------------- settle

#[test]
fn rejected_case_settles_as_cleared_by_anyone() {
    let t = T::new();
    let id = t.open(4_000_000_000);
    t.appeal(id);
    t.decide(id, false);
    assert_eq!(t.c().settle(&id), Status::Cleared);
    assert!(t.signers().is_empty(), "settle needs no signature");
    assert!(t.emitted(events::CaseSettled {
        case_id: id,
        holder: t.holder.clone(),
        outcome: Status::Cleared,
        ended_by: EndedBy::ReviewerRejected,
        taken: 0,
    }));

    assert!(!t.frozen(&t.holder));
    assert_eq!(t.balance(&t.holder), BALANCE);
    let case = t.c().get_case(&id);
    assert_eq!(case.status, Status::Cleared);
    assert_eq!(case.ended_by, EndedBy::ReviewerRejected);
    assert_eq!(t.c().active_case(&t.holder), None);
    assert_eq!(t.c().active_count(), 0);
}

#[test]
fn upheld_case_takes_back_the_amount_and_unfreezes_the_rest() {
    let t = T::new();
    let id = t.open(4_000_000_000);
    t.appeal(id);
    t.decide(id, true);
    assert_eq!(t.c().settle(&id), Status::TakenBack);
    assert_eq!(t.balance(&t.holder), BALANCE - 4_000_000_000);
    assert!(!t.frozen(&t.holder));
    let case = t.c().get_case(&id);
    assert_eq!(case.ended_by, EndedBy::ReviewerUpheld);
    assert_eq!(case.taken, 4_000_000_000);
}

#[test]
fn no_answer_means_take_back_after_the_window() {
    let t = T::new();
    let id = t.open(250);
    t.advance(ANSWER + 1);
    assert_eq!(t.c().settle(&id), Status::TakenBack);
    assert_eq!(t.balance(&t.holder), BALANCE - 250);
    assert_eq!(t.c().get_case(&id).ended_by, EndedBy::NoAnswer);
}

#[test]
fn cannot_settle_while_the_holder_can_still_answer() {
    let t = T::new();
    let id = t.open(250);
    t.advance(ANSWER);
    assert_eq!(t.c().try_settle(&id), Err(Ok(Error::TooEarlyToSettle)));
}

#[test]
fn holder_wins_by_default_if_the_reviewer_never_decides() {
    let t = T::new();
    let id = t.open(250);
    t.appeal(id);
    t.advance(REVIEW);
    assert_eq!(t.c().try_settle(&id), Err(Ok(Error::TooEarlyToSettle)));
    t.advance(1);
    assert_eq!(t.c().settle(&id), Status::Cleared);
    assert_eq!(t.balance(&t.holder), BALANCE);
    assert!(!t.frozen(&t.holder));
    assert_eq!(t.c().get_case(&id).ended_by, EndedBy::ReviewerSilent);
}

#[test]
fn settle_twice_is_refused() {
    let t = T::new();
    let id = t.open(250);
    t.advance(ANSWER + 1);
    t.c().settle(&id);
    assert_eq!(t.c().try_settle(&id), Err(Ok(Error::CaseNotActive)));
    assert_eq!(t.balance(&t.holder), BALANCE - 250);
}

#[test]
fn closed_case_cannot_be_appealed_or_decided() {
    let t = T::new();
    let id = t.open(250);
    t.advance(ANSWER + 1);
    t.c().settle(&id);
    assert_eq!(
        t.c().try_appeal(&id, &t.s(""), &None),
        Err(Ok(Error::CaseNotActive))
    );
    assert_eq!(
        t.c().try_decide(&id, &true, &t.s("x"), &None),
        Err(Ok(Error::CaseNotActive))
    );
}

// ----------------------------------------------------------------- withdraw

#[test]
fn issuer_withdraws_and_the_holder_is_unfrozen() {
    let t = T::new();
    let id = t.open(250);
    t.appeal(id);
    t.c().withdraw(&id);
    assert_eq!(t.signers(), std::slice::from_ref(&t.issuer));
    assert!(t.emitted(events::CaseWithdrawn {
        case_id: id,
        holder: t.holder.clone(),
    }));
    assert!(!t.frozen(&t.holder));
    let case = t.c().get_case(&id);
    assert_eq!(case.status, Status::Cleared);
    assert_eq!(case.ended_by, EndedBy::Withdrawn);
    assert_eq!(t.c().try_withdraw(&id), Err(Ok(Error::CaseNotActive)));
}

#[test]
fn only_the_issuer_can_withdraw() {
    let t = T::new();
    let id = t.open(250);
    t.only_signer(&t.holder, "withdraw", (id,).into_val(&t.env));
    assert!(matches!(t.c().try_withdraw(&id), Err(Err(_))));
}

#[test]
fn a_new_case_can_open_after_the_last_one_closed() {
    let t = T::new();
    let first = t.open(10);
    t.c().withdraw(&first);
    let second = t.open(20);
    assert_eq!(second, 2);
    assert_eq!(
        t.c().cases_for(&t.holder),
        soroban_sdk::vec![&t.env, first, second]
    );
    assert!(t.frozen(&t.holder));
}

// ---------------------------------------------------------------- emergency

#[test]
fn emergency_take_back_needs_issuer_and_reviewer() {
    let t = T::new();
    let id = t.c().emergency_take_back(
        &t.holder,
        &300,
        &Reason::CourtOrder,
        &t.s("Court order 2026-114"),
        &t.file(9),
    );
    let signers = t.signers();
    assert_eq!(signers.len(), 2);
    assert!(signers.contains(&t.issuer) && signers.contains(&t.reviewer));
    assert!(t.emitted(events::EmergencyTakeBack {
        case_id: id,
        holder: t.holder.clone(),
        taken: 300,
    }));

    assert_eq!(t.balance(&t.holder), BALANCE - 300);
    assert!(!t.frozen(&t.holder));
    let case = t.c().get_case(&id);
    assert_eq!(case.status, Status::TakenBack);
    assert_eq!(case.ended_by, EndedBy::Emergency);
    assert_eq!(case.taken, 300);
    assert_eq!(t.c().active_case(&t.holder), None);
    assert_eq!(t.c().active_count(), 0);
    assert_eq!(t.c().cases_for(&t.holder), soroban_sdk::vec![&t.env, id]);
}

#[test]
fn issuer_alone_cannot_take_back_in_an_emergency() {
    let t = T::new();
    let (amount, reason, s, f) = (300i128, Reason::CourtOrder, t.s("x"), t.file(9));
    t.only_signer(
        &t.issuer,
        "emergency_take_back",
        (&t.holder, amount, reason, &s, &f).into_val(&t.env),
    );
    let r = t
        .c()
        .try_emergency_take_back(&t.holder, &amount, &reason, &s, &f);
    assert!(matches!(r, Err(Err(_))));
    assert_eq!(t.balance(&t.holder), BALANCE);
}

#[test]
fn emergency_take_back_refuses_a_holder_with_a_case() {
    let t = T::new();
    t.open(10);
    let r =
        t.c()
            .try_emergency_take_back(&t.holder, &300, &Reason::CourtOrder, &t.s("x"), &t.file(9));
    assert_eq!(r, Err(Ok(Error::AlreadyActiveCase)));
}

#[test]
fn emergency_close_ends_an_active_case_at_once() {
    let t = T::new();
    let id = t.open(100);
    t.appeal(id);
    t.c()
        .emergency_close(&id, &500, &t.s("Court order 2026-115"), &t.file(7));
    assert_eq!(t.signers().len(), 2);
    assert_eq!(t.balance(&t.holder), BALANCE - 500);
    assert!(!t.frozen(&t.holder));
    let case = t.c().get_case(&id);
    assert_eq!(case.status, Status::TakenBack);
    assert_eq!(case.ended_by, EndedBy::Emergency);
    assert_eq!(case.taken, 500);
    assert_eq!(case.reviewer_file, Some(t.file(7)));
    assert_eq!(t.c().active_count(), 0);
}

// ------------------------------------------------------------ issuer powers

#[test]
fn issuer_mints_through_habeas() {
    let t = T::new();
    let other = Address::generate(&t.env);
    t.c().mint(&other, &77);
    assert_eq!(t.signers(), std::slice::from_ref(&t.issuer));
    assert_eq!(t.balance(&other), 77);
    assert_eq!(t.c().try_mint(&other, &0), Err(Ok(Error::InvalidAmount)));
}

#[test]
fn approve_holder_cannot_unfreeze_someone_with_a_case() {
    let t = T::new();
    t.open(10);
    assert_eq!(
        t.c().try_approve_holder(&t.holder),
        Err(Ok(Error::AlreadyActiveCase))
    );
    assert!(t.frozen(&t.holder));

    let fresh = Address::generate(&t.env);
    t.c().approve_holder(&fresh);
    assert!(!t.frozen(&fresh));
}

// --------------------------------------------------------------- governance

#[test]
fn changing_the_reviewer_needs_all_three() {
    let t = T::new();
    let new_reviewer = Address::generate(&t.env);
    t.c().change_reviewer(&new_reviewer);
    let signers = t.signers();
    assert_eq!(signers.len(), 3);
    for who in [&t.issuer, &t.reviewer, &new_reviewer] {
        assert!(signers.contains(who));
    }
    assert_eq!(t.c().get_config().reviewer, new_reviewer);

    // The new reviewer decides open cases from now on; the old one can't.
    let id = t.open(10);
    t.appeal(id);
    let (s, f): (String, Option<BytesN<32>>) = (t.s("old reviewer"), None);
    t.only_signer(&t.reviewer, "decide", (id, true, &s, &f).into_val(&t.env));
    assert!(matches!(t.c().try_decide(&id, &true, &s, &f), Err(Err(_))));
}

#[test]
fn reviewer_cannot_become_the_issuer() {
    let t = T::new();
    assert_eq!(
        t.c().try_change_reviewer(&t.issuer),
        Err(Ok(Error::SameIssuerAndReviewer))
    );
}

#[test]
fn issuer_alone_cannot_change_the_reviewer() {
    let t = T::new();
    let friend = Address::generate(&t.env);
    t.only_signer(&t.issuer, "change_reviewer", (&friend,).into_val(&t.env));
    assert!(matches!(t.c().try_change_reviewer(&friend), Err(Err(_))));
}

#[test]
fn admin_handover_waits_seven_days() {
    let t = T::new();
    let next = Address::generate(&t.env);
    let h = t.c().propose_handover(&next);
    assert_eq!(t.signers().len(), 2);
    assert_eq!(h.ready_at, START + HANDOVER_DELAY_SECS);
    assert_eq!(t.c().pending_handover(), Some(h));

    t.advance(HANDOVER_DELAY_SECS - 1);
    assert_eq!(
        t.c().try_complete_handover(),
        Err(Ok(Error::HandoverNotReady))
    );
    t.advance(1);
    t.c().complete_handover();
    assert_eq!(t.asset().admin(), next);
    assert_eq!(t.c().pending_handover(), None);
}

#[test]
fn admin_handover_waits_for_open_cases() {
    let t = T::new();
    let id = t.open(10);
    t.c().propose_handover(&Address::generate(&t.env));
    t.advance(HANDOVER_DELAY_SECS);
    assert_eq!(
        t.c().try_complete_handover(),
        Err(Ok(Error::ActiveCasesExist))
    );
    t.c().withdraw(&id);
    t.c().complete_handover();
}

#[test]
fn issuer_alone_cannot_start_a_handover() {
    let t = T::new();
    let next = Address::generate(&t.env);
    t.only_signer(&t.issuer, "propose_handover", (&next,).into_val(&t.env));
    assert!(matches!(t.c().try_propose_handover(&next), Err(Err(_))));
}

#[test]
fn reviewer_can_cancel_a_handover_but_strangers_cannot() {
    let t = T::new();
    t.c().propose_handover(&Address::generate(&t.env));
    let stranger = Address::generate(&t.env);
    assert_eq!(
        t.c().try_cancel_handover(&stranger),
        Err(Ok(Error::NotIssuerOrReviewer))
    );
    t.c().cancel_handover(&t.reviewer);
    assert_eq!(t.signers(), std::slice::from_ref(&t.reviewer));
    assert_eq!(t.c().pending_handover(), None);
    t.advance(HANDOVER_DELAY_SECS);
    assert_eq!(
        t.c().try_complete_handover(),
        Err(Ok(Error::NoPendingHandover))
    );
    assert_eq!(t.asset().admin(), t.id);
}

// ---------------------------------------------------------------------- TTL

#[test]
fn case_entries_are_kept_alive() {
    let t = T::new();
    let id = t.open(10);
    let ttl = |key: DataKey| {
        t.env
            .as_contract(&t.id, || t.env.storage().persistent().get_ttl(&key))
    };
    assert_eq!(ttl(DataKey::Case(id)), EXTEND_TO);
    assert_eq!(ttl(DataKey::Active(t.holder.clone())), EXTEND_TO);
    assert_eq!(ttl(DataKey::HolderCases(t.holder.clone())), EXTEND_TO);

    // 70 days later the entries have aged; a public bump renews them.
    t.advance(70 * 24 * 60 * 60);
    assert!(ttl(DataKey::Case(id)) < EXTEND_TO);
    t.c().bump(&id);
    assert_eq!(ttl(DataKey::Case(id)), EXTEND_TO);
    assert_eq!(ttl(DataKey::HolderCases(t.holder.clone())), EXTEND_TO);
    let instance = t
        .env
        .as_contract(&t.id, || t.env.storage().instance().get_ttl());
    assert_eq!(instance, EXTEND_TO);
}

#[test]
fn bump_on_missing_case() {
    let t = T::new();
    assert_eq!(t.c().try_bump(&5), Err(Ok(Error::CaseNotFound)));
}

// ---------------------------------------------------------- full story

#[test]
fn two_holders_two_endings() {
    let t = T::new();
    let ana = t.holder.clone();
    let ben = Address::generate(&t.env);
    t.c().mint(&ben, &BALANCE);

    let a = t.open(100);
    let b = t.c().open_case(
        &ben,
        &200,
        &Reason::SentByMistake,
        &t.s("Sent twice"),
        &t.file(3),
    );
    assert_eq!(t.c().active_count(), 2);

    // Ana answers and the reviewer clears her. Ben stays silent.
    t.appeal(a);
    t.decide(a, false);
    t.advance(ANSWER + 1);
    assert_eq!(t.c().settle(&a), Status::Cleared);
    assert_eq!(t.c().settle(&b), Status::TakenBack);

    assert_eq!(t.balance(&ana), BALANCE);
    assert_eq!(t.balance(&ben), BALANCE - 200);
    assert!(!t.frozen(&ana) && !t.frozen(&ben));
    assert_eq!(t.c().active_count(), 0);
    assert_eq!(t.c().case_count(), 2);
}
