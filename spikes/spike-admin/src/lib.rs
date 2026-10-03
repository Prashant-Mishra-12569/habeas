//! Throwaway contract for the Phase 1 spikes. It only proves that a contract
//! set as a SAC admin can freeze, unfreeze, take back and mint, and that a
//! holder can authorize a call while someone else pays the fee.
#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, token::StellarAssetClient, Address, Env};

#[contracttype]
enum Key {
    Sac,
    Operator,
    Appeals(Address),
}

#[contractevent]
pub struct Appealed {
    #[topic]
    pub holder: Address,
    pub count: u32,
}

#[contract]
pub struct SpikeAdmin;

#[contractimpl]
impl SpikeAdmin {
    pub fn __constructor(env: Env, sac: Address, operator: Address) {
        env.storage().instance().set(&Key::Sac, &sac);
        env.storage().instance().set(&Key::Operator, &operator);
    }

    fn sac(env: &Env) -> StellarAssetClient<'_> {
        let operator: Address = env.storage().instance().get(&Key::Operator).unwrap();
        operator.require_auth();
        let sac: Address = env.storage().instance().get(&Key::Sac).unwrap();
        StellarAssetClient::new(env, &sac)
    }

    pub fn freeze(env: Env, holder: Address) {
        Self::sac(&env).set_authorized(&holder, &false);
    }

    pub fn unfreeze(env: Env, holder: Address) {
        Self::sac(&env).set_authorized(&holder, &true);
    }

    pub fn take_back(env: Env, holder: Address, amount: i128) {
        Self::sac(&env).clawback(&holder, &amount);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        Self::sac(&env).mint(&to, &amount);
    }

    /// Needs only the holder's signature, so a relayer can submit and pay.
    pub fn appeal(env: Env, holder: Address) -> u32 {
        holder.require_auth();
        let key = Key::Appeals(holder.clone());
        let count: u32 = env.storage().persistent().get(&key).unwrap_or(0) + 1;
        env.storage().persistent().set(&key, &count);
        Appealed { holder, count }.publish(&env);
        count
    }
}
