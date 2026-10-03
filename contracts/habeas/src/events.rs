//! Events the website and the Telegram alerts read. Each event's first topic
//! is its name in snake_case, e.g. `case_opened`.
use crate::types::{EndedBy, Reason, Status};
use soroban_sdk::{contractevent, Address};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CaseOpened {
    #[topic]
    pub case_id: u64,
    #[topic]
    pub holder: Address,
    pub amount: i128,
    pub reason: Reason,
    pub answer_by: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CaseAppealed {
    #[topic]
    pub case_id: u64,
    #[topic]
    pub holder: Address,
    pub review_by: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CaseDecided {
    #[topic]
    pub case_id: u64,
    #[topic]
    pub holder: Address,
    pub upheld: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CaseSettled {
    #[topic]
    pub case_id: u64,
    #[topic]
    pub holder: Address,
    pub outcome: Status,
    pub ended_by: EndedBy,
    pub taken: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CaseWithdrawn {
    #[topic]
    pub case_id: u64,
    #[topic]
    pub holder: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyTakeBack {
    #[topic]
    pub case_id: u64,
    #[topic]
    pub holder: Address,
    pub taken: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HolderApproved {
    #[topic]
    pub holder: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReviewerChanged {
    pub old_reviewer: Address,
    pub new_reviewer: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HandoverProposed {
    pub new_admin: Address,
    pub ready_at: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HandoverCancelled {
    pub new_admin: Address,
    pub cancelled_by: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HandoverCompleted {
    pub new_admin: Address,
}
