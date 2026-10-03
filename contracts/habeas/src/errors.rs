use soroban_sdk::contracterror;

/// Every way a call can be refused. Wrong signers are refused by the network's
/// own auth check before any of these are reached.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    CaseNotFound = 1,
    /// The case is already closed.
    CaseNotActive = 2,
    /// The holder already has an open case.
    AlreadyActiveCase = 3,
    /// Amounts must be above zero.
    InvalidAmount = 4,
    /// More than the holder's balance.
    AmountTooHigh = 5,
    AnswerWindowClosed = 6,
    ReviewWindowClosed = 7,
    /// The deadline that lets anyone settle hasn't passed yet.
    TooEarlyToSettle = 8,
    /// The reviewer can only decide after the holder answers.
    NotAnswered = 9,
    AlreadyAnswered = 10,
    AlreadyDecided = 11,
    /// The holder can't be the issuer, the reviewer or Habeas itself.
    InvalidHolder = 12,
    StatementRequired = 13,
    StatementTooLong = 14,
    /// Windows must be between 1 second and 30 days.
    InvalidWindow = 15,
    SameIssuerAndReviewer = 16,
    NoPendingHandover = 17,
    HandoverNotReady = 18,
    /// The admin role can't move while any holder is frozen by a case.
    ActiveCasesExist = 19,
    /// Only the issuer or the reviewer can cancel a handover.
    NotIssuerOrReviewer = 20,
}
