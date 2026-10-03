//! Storage layout and TTL handling. Every persistent entry read or written is
//! extended, so a case can't expire while anyone still needs it.
use crate::errors::Error;
use crate::types::{AdminHandover, Case, Config};
use soroban_sdk::{contracttype, Address, Env, Vec};

const DAY_IN_LEDGERS: u32 = 17_280;
/// Entries are kept alive for about 90 days after each touch. Windows are
/// capped at 30 days each, so a case always outlives its deadlines.
pub(crate) const EXTEND_TO: u32 = 90 * DAY_IN_LEDGERS;
pub(crate) const THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
pub(crate) enum DataKey {
    Config,
    CaseCount,
    ActiveCount,
    Handover,
    Case(u64),
    /// The holder's active case id, if any.
    Active(Address),
    /// Every case id ever opened against the holder.
    HolderCases(Address),
}

pub(crate) fn extend_instance(env: &Env) {
    env.storage().instance().extend_ttl(THRESHOLD, EXTEND_TO);
}

fn extend(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, THRESHOLD, EXTEND_TO);
}

pub(crate) fn config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

pub(crate) fn set_config(env: &Env, config: &Config) {
    env.storage().instance().set(&DataKey::Config, config);
}

pub(crate) fn case_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::CaseCount)
        .unwrap_or(0)
}

/// Case ids start at 1.
pub(crate) fn next_case_id(env: &Env) -> u64 {
    let id = case_count(env) + 1;
    env.storage().instance().set(&DataKey::CaseCount, &id);
    id
}

pub(crate) fn active_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::ActiveCount)
        .unwrap_or(0)
}

fn set_active_count(env: &Env, n: u32) {
    env.storage().instance().set(&DataKey::ActiveCount, &n);
}

pub(crate) fn handover(env: &Env) -> Option<AdminHandover> {
    env.storage().instance().get(&DataKey::Handover)
}

pub(crate) fn set_handover(env: &Env, handover: &AdminHandover) {
    env.storage().instance().set(&DataKey::Handover, handover);
}

pub(crate) fn clear_handover(env: &Env) {
    env.storage().instance().remove(&DataKey::Handover);
}

pub(crate) fn load_case(env: &Env, id: u64) -> Result<Case, Error> {
    let key = DataKey::Case(id);
    let case: Case = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::CaseNotFound)?;
    extend(env, &key);
    Ok(case)
}

pub(crate) fn save_case(env: &Env, case: &Case) {
    let key = DataKey::Case(case.id);
    env.storage().persistent().set(&key, case);
    extend(env, &key);
}

pub(crate) fn active_case(env: &Env, holder: &Address) -> Option<u64> {
    let key = DataKey::Active(holder.clone());
    let id = env.storage().persistent().get(&key);
    if id.is_some() {
        extend(env, &key);
    }
    id
}

/// Marks a new case as the holder's active one and adds it to their history.
pub(crate) fn start_case(env: &Env, holder: &Address, id: u64) {
    let active = DataKey::Active(holder.clone());
    env.storage().persistent().set(&active, &id);
    extend(env, &active);
    push_history(env, holder, id);
    set_active_count(env, active_count(env) + 1);
}

/// Called when a case that was active closes.
pub(crate) fn end_case(env: &Env, holder: &Address) {
    env.storage()
        .persistent()
        .remove(&DataKey::Active(holder.clone()));
    set_active_count(env, active_count(env).saturating_sub(1));
}

/// Adds a case id to the holder's history. Emergency take-backs that open
/// and close in one call only get this, never an active entry.
pub(crate) fn push_history(env: &Env, holder: &Address, id: u64) {
    let key = DataKey::HolderCases(holder.clone());
    let mut ids: Vec<u64> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));
    ids.push_back(id);
    env.storage().persistent().set(&key, &ids);
    extend(env, &key);
}

pub(crate) fn holder_cases(env: &Env, holder: &Address) -> Vec<u64> {
    let key = DataKey::HolderCases(holder.clone());
    match env.storage().persistent().get(&key) {
        Some(ids) => {
            extend(env, &key);
            ids
        }
        None => Vec::new(env),
    }
}

/// Extends a case and its holder's entries. Anyone may call it.
pub(crate) fn bump_case(env: &Env, id: u64) -> Result<(), Error> {
    let case = load_case(env, id)?;
    active_case(env, &case.holder);
    holder_cases(env, &case.holder);
    Ok(())
}
