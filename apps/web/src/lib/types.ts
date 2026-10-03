// Case types shared by server and client code.

export type Status = "Open" | "Answered" | "Upheld" | "Rejected" | "Cleared" | "TakenBack";
export type EndedBy =
  | "NotEnded"
  | "Withdrawn"
  | "NoAnswer"
  | "ReviewerUpheld"
  | "ReviewerRejected"
  | "ReviewerSilent"
  | "Emergency";
export type Reason = "Fraud" | "SanctionsOrder" | "SentByMistake" | "CourtOrder" | "Other";

/** A case as stored by the Habeas contract. Times are unix seconds, 0 = not yet. */
export type Case = {
  id: number;
  holder: string;
  /** In whole tokens, as a decimal string (7 decimals on Stellar). */
  amount: string;
  reason: Reason;
  statement: string;
  issuerFile: string;
  status: Status;
  openedAt: number;
  answerBy: number;
  answeredAt: number;
  holderStatement: string;
  holderFile: string | null;
  reviewBy: number;
  decidedAt: number;
  reviewerStatement: string;
  reviewerFile: string | null;
  closedAt: number;
  endedBy: EndedBy;
  taken: string;
};
