use soroban_sdk::{contracttype, Address, BytesN, String};

/// Why the issuer opened the case. Stored by name, so explorers and events
/// show `Fraud`, not a number; the website translates it.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Reason {
    Fraud,
    SanctionsOrder,
    SentByMistake,
    CourtOrder,
    Other,
}

/// Where a case stands. `Open`, `Answered`, `Upheld` and `Rejected` mean the
/// holder is frozen. `Cleared` and `TakenBack` are final.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    /// Frozen, waiting for the holder's answer.
    Open,
    /// The holder answered, waiting for the reviewer.
    Answered,
    /// The reviewer sided with the issuer; settling takes the tokens back.
    Upheld,
    /// The reviewer sided with the holder; settling unfreezes.
    Rejected,
    /// Closed, the holder keeps the tokens and is unfrozen.
    Cleared,
    /// Closed, the tokens were taken back and the rest is unfrozen.
    TakenBack,
}

/// What closed the case.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EndedBy {
    /// The case is still active.
    NotEnded,
    /// The issuer dropped the case.
    Withdrawn,
    /// The holder didn't answer before the deadline.
    NoAnswer,
    ReviewerUpheld,
    ReviewerRejected,
    /// The reviewer didn't decide in time, so the holder wins by default.
    ReviewerSilent,
    /// Issuer and reviewer acted together without waiting (court order, active theft).
    Emergency,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    /// The asset's Stellar Asset Contract. Habeas must be its admin.
    pub sac: Address,
    /// The key the issuer's staff use to open cases and mint. This should not
    /// be the asset's classic issuer account, which gets locked.
    pub issuer: Address,
    pub reviewer: Address,
    /// Seconds the holder has to answer after a case opens.
    pub answer_window: u64,
    /// Seconds the reviewer has to decide after the holder answers.
    pub review_window: u64,
}

/// A case record. Timestamps are ledger seconds; 0 means "not yet".
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Case {
    pub id: u64,
    pub holder: Address,
    /// The most that can be taken back. The whole balance is frozen while the
    /// case is active.
    pub amount: i128,
    pub reason: Reason,
    /// The issuer's public reason, in their own words.
    pub statement: String,
    /// Fingerprint (SHA-256) of the issuer's file. The file stays off-chain.
    pub issuer_file: BytesN<32>,
    pub status: Status,
    pub opened_at: u64,
    pub answer_by: u64,
    pub answered_at: u64,
    pub holder_statement: String,
    pub holder_file: Option<BytesN<32>>,
    pub review_by: u64,
    pub decided_at: u64,
    pub reviewer_statement: String,
    pub reviewer_file: Option<BytesN<32>>,
    pub closed_at: u64,
    pub ended_by: EndedBy,
    /// What was actually taken back when the case closed.
    pub taken: i128,
}

/// A request to hand the asset's admin role to someone else. It needs the
/// issuer and the reviewer, and only takes effect after a public delay.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminHandover {
    pub new_admin: Address,
    pub ready_at: u64,
}
