//! Habeas: a fair process before a Stellar token issuer freezes or takes back
//! tokens.
//!
//! One Habeas contract runs per asset and is set as that asset's Stellar Asset
//! Contract (SAC) admin, so freezing and taking back can only happen through a
//! case. A case has a public reason, a deadline for the holder to answer and a
//! reviewer who decides. If the reviewer never decides, the holder wins by
//! default. `settle` can be called by anyone once a case can close.
#![no_std]

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use errors::Error;
pub use types::{AdminHandover, Case, Config, EndedBy, Reason, Status};

use events::{
    CaseAppealed, CaseDecided, CaseOpened, CaseSettled, CaseWithdrawn, EmergencyTakeBack,
    HandoverCancelled, HandoverCompleted, HandoverProposed, HolderApproved, ReviewerChanged,
};
use soroban_sdk::{
    contract, contractimpl, panic_with_error,
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, String, Vec,
};

pub const VERSION: u32 = 1;
/// Public statements are short on purpose; details go in the off-chain file.
pub const MAX_STATEMENT_BYTES: u32 = 280;
pub const MAX_WINDOW_SECS: u64 = 30 * 24 * 60 * 60;
/// How long a proposed admin handover waits before it can complete.
pub const HANDOVER_DELAY_SECS: u64 = 7 * 24 * 60 * 60;

#[contract]
pub struct Habeas;

#[contractimpl]
impl Habeas {
    pub fn __constructor(
        env: Env,
        sac: Address,
        issuer: Address,
        reviewer: Address,
        answer_window: u64,
        review_window: u64,
    ) {
        if issuer == reviewer {
            panic_with_error!(&env, Error::SameIssuerAndReviewer);
        }
        if !valid_window(answer_window) || !valid_window(review_window) {
            panic_with_error!(&env, Error::InvalidWindow);
        }
        storage::set_config(
            &env,
            &Config {
                sac,
                issuer,
                reviewer,
                answer_window,
                review_window,
            },
        );
        storage::extend_instance(&env);
    }

    // ---------------------------------------------------------------- cases

    /// The issuer opens a case. The holder is frozen right away.
    pub fn open_case(
        env: Env,
        holder: Address,
        amount: i128,
        reason: Reason,
        statement: String,
        file_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        let cfg = load_config(&env);
        cfg.issuer.require_auth();
        check_holder(&env, &cfg, &holder)?;
        check_statement(&statement, true)?;
        check_amount(&env, &cfg, &holder, amount)?;
        if storage::active_case(&env, &holder).is_some() {
            return Err(Error::AlreadyActiveCase);
        }

        let now = env.ledger().timestamp();
        let id = storage::next_case_id(&env);
        let case = Case {
            id,
            holder: holder.clone(),
            amount,
            reason,
            statement,
            issuer_file: file_hash,
            status: Status::Open,
            opened_at: now,
            answer_by: now + cfg.answer_window,
            answered_at: 0,
            holder_statement: String::from_str(&env, ""),
            holder_file: None,
            review_by: 0,
            decided_at: 0,
            reviewer_statement: String::from_str(&env, ""),
            reviewer_file: None,
            closed_at: 0,
            ended_by: EndedBy::NotEnded,
            taken: 0,
        };
        storage::save_case(&env, &case);
        storage::start_case(&env, &holder, id);
        CaseOpened {
            case_id: id,
            holder: holder.clone(),
            amount,
            reason,
            answer_by: case.answer_by,
        }
        .publish(&env);

        StellarAssetClient::new(&env, &cfg.sac).set_authorized(&holder, &false);
        Ok(id)
    }

    /// The holder answers. Only the holder signs, so a relayer can submit
    /// this and pay the fee for them.
    pub fn appeal(
        env: Env,
        case_id: u64,
        statement: String,
        file_hash: Option<BytesN<32>>,
    ) -> Result<(), Error> {
        let cfg = load_config(&env);
        let mut case = storage::load_case(&env, case_id)?;
        case.holder.require_auth();
        match case.status {
            Status::Open => {}
            Status::Answered | Status::Upheld | Status::Rejected => {
                return Err(Error::AlreadyAnswered)
            }
            Status::Cleared | Status::TakenBack => return Err(Error::CaseNotActive),
        }
        check_statement(&statement, false)?;
        let now = env.ledger().timestamp();
        if now > case.answer_by {
            return Err(Error::AnswerWindowClosed);
        }

        case.status = Status::Answered;
        case.answered_at = now;
        case.review_by = now + cfg.review_window;
        case.holder_statement = statement;
        case.holder_file = file_hash;
        storage::save_case(&env, &case);
        CaseAppealed {
            case_id,
            holder: case.holder,
            review_by: case.review_by,
        }
        .publish(&env);
        Ok(())
    }

    /// The reviewer decides after the holder answers, inside the review
    /// window. `uphold = true` sides with the issuer.
    pub fn decide(
        env: Env,
        case_id: u64,
        uphold: bool,
        statement: String,
        file_hash: Option<BytesN<32>>,
    ) -> Result<(), Error> {
        let cfg = load_config(&env);
        cfg.reviewer.require_auth();
        let mut case = storage::load_case(&env, case_id)?;
        match case.status {
            Status::Answered => {}
            Status::Open => return Err(Error::NotAnswered),
            Status::Upheld | Status::Rejected => return Err(Error::AlreadyDecided),
            Status::Cleared | Status::TakenBack => return Err(Error::CaseNotActive),
        }
        check_statement(&statement, true)?;
        let now = env.ledger().timestamp();
        if now > case.review_by {
            return Err(Error::ReviewWindowClosed);
        }

        case.status = if uphold {
            Status::Upheld
        } else {
            Status::Rejected
        };
        case.decided_at = now;
        case.reviewer_statement = statement;
        case.reviewer_file = file_hash;
        storage::save_case(&env, &case);
        CaseDecided {
            case_id,
            holder: case.holder,
            upheld: uphold,
        }
        .publish(&env);
        Ok(())
    }

    /// Anyone can close a case once its outcome is known:
    /// - reviewer upheld: take back
    /// - reviewer rejected: unfreeze
    /// - holder never answered and the answer window is over: take back
    /// - holder answered, reviewer silent past the review window: unfreeze
    pub fn settle(env: Env, case_id: u64) -> Result<Status, Error> {
        let cfg = load_config(&env);
        let case = storage::load_case(&env, case_id)?;
        let now = env.ledger().timestamp();
        let (outcome, ended_by) = match case.status {
            Status::Upheld => (Status::TakenBack, EndedBy::ReviewerUpheld),
            Status::Rejected => (Status::Cleared, EndedBy::ReviewerRejected),
            Status::Open if now > case.answer_by => (Status::TakenBack, EndedBy::NoAnswer),
            Status::Answered if now > case.review_by => (Status::Cleared, EndedBy::ReviewerSilent),
            Status::Open | Status::Answered => return Err(Error::TooEarlyToSettle),
            Status::Cleared | Status::TakenBack => return Err(Error::CaseNotActive),
        };
        let case = close_case(&env, &cfg, case, outcome, ended_by, None);
        CaseSettled {
            case_id,
            holder: case.holder,
            outcome,
            ended_by,
            taken: case.taken,
        }
        .publish(&env);
        Ok(outcome)
    }

    /// The issuer drops an active case. The holder is unfrozen.
    pub fn withdraw(env: Env, case_id: u64) -> Result<(), Error> {
        let cfg = load_config(&env);
        cfg.issuer.require_auth();
        let case = storage::load_case(&env, case_id)?;
        if !is_active(case.status) {
            return Err(Error::CaseNotActive);
        }
        let case = close_case(&env, &cfg, case, Status::Cleared, EndedBy::Withdrawn, None);
        CaseWithdrawn {
            case_id,
            holder: case.holder,
        }
        .publish(&env);
        Ok(())
    }

    /// Issuer and reviewer together take tokens back at once, for a court
    /// order or theft in progress. Still recorded as a closed case with a
    /// public reason. Use `emergency_close` if the holder already has a case.
    pub fn emergency_take_back(
        env: Env,
        holder: Address,
        amount: i128,
        reason: Reason,
        statement: String,
        file_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        let cfg = load_config(&env);
        cfg.issuer.require_auth();
        cfg.reviewer.require_auth();
        check_holder(&env, &cfg, &holder)?;
        check_statement(&statement, true)?;
        check_amount(&env, &cfg, &holder, amount)?;
        if storage::active_case(&env, &holder).is_some() {
            return Err(Error::AlreadyActiveCase);
        }

        let now = env.ledger().timestamp();
        let id = storage::next_case_id(&env);
        let case = Case {
            id,
            holder: holder.clone(),
            amount,
            reason,
            statement: statement.clone(),
            issuer_file: file_hash.clone(),
            status: Status::TakenBack,
            opened_at: now,
            answer_by: now,
            answered_at: 0,
            holder_statement: String::from_str(&env, ""),
            holder_file: None,
            review_by: 0,
            decided_at: now,
            reviewer_statement: statement,
            reviewer_file: Some(file_hash),
            closed_at: now,
            ended_by: EndedBy::Emergency,
            taken: amount,
        };
        storage::save_case(&env, &case);
        storage::push_history(&env, &holder, id);
        EmergencyTakeBack {
            case_id: id,
            holder: holder.clone(),
            taken: amount,
        }
        .publish(&env);

        StellarAssetClient::new(&env, &cfg.sac).clawback(&holder, &amount);
        Ok(id)
    }

    /// Issuer and reviewer together close an active case at once by taking
    /// back `amount`. The rest of the balance is unfrozen.
    pub fn emergency_close(
        env: Env,
        case_id: u64,
        amount: i128,
        statement: String,
        file_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let cfg = load_config(&env);
        cfg.issuer.require_auth();
        cfg.reviewer.require_auth();
        let mut case = storage::load_case(&env, case_id)?;
        if !is_active(case.status) {
            return Err(Error::CaseNotActive);
        }
        check_statement(&statement, true)?;
        check_amount(&env, &cfg, &case.holder, amount)?;

        case.decided_at = env.ledger().timestamp();
        case.reviewer_statement = statement;
        case.reviewer_file = Some(file_hash);
        let case = close_case(
            &env,
            &cfg,
            case,
            Status::TakenBack,
            EndedBy::Emergency,
            Some(amount),
        );
        EmergencyTakeBack {
            case_id,
            holder: case.holder,
            taken: case.taken,
        }
        .publish(&env);
        Ok(())
    }

    // ------------------------------------------------- normal issuer powers

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        let cfg = load_config(&env);
        cfg.issuer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        StellarAssetClient::new(&env, &cfg.sac).mint(&to, &amount);
        Ok(())
    }

    /// For assets that require approval before holding. This can only ever
    /// authorize; it can't freeze, and it can't unfreeze someone with a case.
    pub fn approve_holder(env: Env, holder: Address) -> Result<(), Error> {
        let cfg = load_config(&env);
        cfg.issuer.require_auth();
        if storage::active_case(&env, &holder).is_some() {
            return Err(Error::AlreadyActiveCase);
        }
        StellarAssetClient::new(&env, &cfg.sac).set_authorized(&holder, &true);
        HolderApproved { holder }.publish(&env);
        Ok(())
    }

    // ------------------------------------------------------------ governance

    /// Needs the issuer, the current reviewer and the new reviewer, so no
    /// side can swap the reviewer alone and the new one has agreed.
    pub fn change_reviewer(env: Env, new_reviewer: Address) -> Result<(), Error> {
        let mut cfg = load_config(&env);
        cfg.issuer.require_auth();
        cfg.reviewer.require_auth();
        new_reviewer.require_auth();
        if new_reviewer == cfg.issuer {
            return Err(Error::SameIssuerAndReviewer);
        }
        let old_reviewer = cfg.reviewer.clone();
        cfg.reviewer = new_reviewer.clone();
        storage::set_config(&env, &cfg);
        ReviewerChanged {
            old_reviewer,
            new_reviewer,
        }
        .publish(&env);
        Ok(())
    }

    /// Starts handing the asset's admin role to `new_admin`. Needs issuer and
    /// reviewer, and can only complete after `HANDOVER_DELAY_SECS`, so
    /// holders see it coming.
    pub fn propose_handover(env: Env, new_admin: Address) -> Result<AdminHandover, Error> {
        let cfg = load_config(&env);
        cfg.issuer.require_auth();
        cfg.reviewer.require_auth();
        let handover = AdminHandover {
            new_admin: new_admin.clone(),
            ready_at: env.ledger().timestamp() + HANDOVER_DELAY_SECS,
        };
        storage::set_handover(&env, &handover);
        HandoverProposed {
            new_admin,
            ready_at: handover.ready_at,
        }
        .publish(&env);
        Ok(handover)
    }

    /// Either the issuer or the reviewer can stop a pending handover.
    pub fn cancel_handover(env: Env, by: Address) -> Result<(), Error> {
        let cfg = load_config(&env);
        if by != cfg.issuer && by != cfg.reviewer {
            return Err(Error::NotIssuerOrReviewer);
        }
        by.require_auth();
        let handover = storage::handover(&env).ok_or(Error::NoPendingHandover)?;
        storage::clear_handover(&env);
        HandoverCancelled {
            new_admin: handover.new_admin,
            cancelled_by: by,
        }
        .publish(&env);
        Ok(())
    }

    /// Anyone can complete a handover once the delay is over and no holder is
    /// frozen by an active case.
    pub fn complete_handover(env: Env) -> Result<(), Error> {
        let cfg = load_config(&env);
        let handover = storage::handover(&env).ok_or(Error::NoPendingHandover)?;
        if env.ledger().timestamp() < handover.ready_at {
            return Err(Error::HandoverNotReady);
        }
        if storage::active_count(&env) > 0 {
            return Err(Error::ActiveCasesExist);
        }
        storage::clear_handover(&env);
        HandoverCompleted {
            new_admin: handover.new_admin.clone(),
        }
        .publish(&env);
        StellarAssetClient::new(&env, &cfg.sac).set_admin(&handover.new_admin);
        Ok(())
    }

    // ----------------------------------------------------------------- reads

    pub fn get_config(env: Env) -> Config {
        load_config(&env)
    }

    pub fn get_case(env: Env, case_id: u64) -> Result<Case, Error> {
        storage::extend_instance(&env);
        storage::load_case(&env, case_id)
    }

    /// Every case id ever opened against `holder`, oldest first.
    pub fn cases_for(env: Env, holder: Address) -> Vec<u64> {
        storage::extend_instance(&env);
        storage::holder_cases(&env, &holder)
    }

    pub fn active_case(env: Env, holder: Address) -> Option<u64> {
        storage::extend_instance(&env);
        storage::active_case(&env, &holder)
    }

    pub fn case_count(env: Env) -> u64 {
        storage::extend_instance(&env);
        storage::case_count(&env)
    }

    /// How many holders are frozen by a case right now.
    pub fn active_count(env: Env) -> u32 {
        storage::extend_instance(&env);
        storage::active_count(&env)
    }

    pub fn pending_handover(env: Env) -> Option<AdminHandover> {
        storage::extend_instance(&env);
        storage::handover(&env)
    }

    pub fn version() -> u32 {
        VERSION
    }

    /// Keeps a case and the contract alive longer. Anyone can call it.
    pub fn bump(env: Env, case_id: u64) -> Result<(), Error> {
        storage::extend_instance(&env);
        storage::bump_case(&env, case_id)
    }
}

// ------------------------------------------------------------------ helpers

fn load_config(env: &Env) -> Config {
    storage::extend_instance(env);
    storage::config(env)
}

fn valid_window(secs: u64) -> bool {
    secs > 0 && secs <= MAX_WINDOW_SECS
}

fn is_active(status: Status) -> bool {
    matches!(
        status,
        Status::Open | Status::Answered | Status::Upheld | Status::Rejected
    )
}

fn check_holder(env: &Env, cfg: &Config, holder: &Address) -> Result<(), Error> {
    if *holder == cfg.issuer || *holder == cfg.reviewer || *holder == env.current_contract_address()
    {
        return Err(Error::InvalidHolder);
    }
    Ok(())
}

fn check_statement(statement: &String, required: bool) -> Result<(), Error> {
    if required && statement.is_empty() {
        return Err(Error::StatementRequired);
    }
    if statement.len() > MAX_STATEMENT_BYTES {
        return Err(Error::StatementTooLong);
    }
    Ok(())
}

fn check_amount(env: &Env, cfg: &Config, holder: &Address, amount: i128) -> Result<(), Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    if amount > TokenClient::new(env, &cfg.sac).balance(holder) {
        return Err(Error::AmountTooHigh);
    }
    Ok(())
}

/// Closes an active case: records the outcome first, then takes back (if the
/// outcome says so) and unfreezes. `take` overrides the case amount for an
/// emergency close. Never takes more than the holder's balance.
fn close_case(
    env: &Env,
    cfg: &Config,
    mut case: Case,
    outcome: Status,
    ended_by: EndedBy,
    take: Option<i128>,
) -> Case {
    let taken = if outcome == Status::TakenBack {
        let balance = TokenClient::new(env, &cfg.sac).balance(&case.holder);
        take.unwrap_or(case.amount).min(balance)
    } else {
        0
    };
    case.status = outcome;
    case.ended_by = ended_by;
    case.closed_at = env.ledger().timestamp();
    case.taken = taken;
    storage::save_case(env, &case);
    storage::end_case(env, &case.holder);

    let sac = StellarAssetClient::new(env, &cfg.sac);
    if taken > 0 {
        sac.clawback(&case.holder, &taken);
    }
    sac.set_authorized(&case.holder, &true);
    case
}
