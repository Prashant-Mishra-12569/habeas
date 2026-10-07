// Turns a case record into plain language and the next possible steps, from
// the lifecycle in docs/SPEC-cases.md. Pure and deterministic: no model, no
// network. Words follow the site's list: freeze, take back (clawback),
// reviewer, Cleared / Taken back.
import type { Case, EndedBy, Reason } from "./types.ts";

const REASON_TEXT: Record<Reason, string> = {
  Fraud: "fraud",
  SanctionsOrder: "a sanctions order",
  SentByMistake: "tokens sent by mistake",
  CourtOrder: "a court order",
  Other: "another reason",
};

export type Explanation = {
  caseId: number;
  stage: Case["status"];
  closed: boolean;
  /** While a case is active, the holder's whole balance of this token is frozen. */
  holderFrozen: boolean;
  summary: string;
  whatHappened: string[];
  nextSteps: string[];
  deadlines: {
    answerBy: string;
    answerSecondsLeft: number | null;
    reviewBy: string | null;
    reviewSecondsLeft: number | null;
  };
  canSettleNow: boolean;
  settleWouldResultIn: "Cleared" | "Taken back" | null;
  note: string;
};

const iso = (t: number) => new Date(t * 1000).toISOString();
const left = (deadline: number, now: number) => Math.max(0, deadline - now);

function ending(by: EndedBy, taken: string, asset: string): string {
  switch (by) {
    case "Withdrawn":
      return "The issuer withdrew the case. The holder keeps all tokens and is unfrozen.";
    case "NoAnswer":
      return `The holder didn't answer before the deadline, so ${taken} ${asset} was taken back. The rest was unfrozen.`;
    case "ReviewerUpheld":
      return `The reviewer sided with the issuer, so ${taken} ${asset} was taken back. The rest was unfrozen.`;
    case "ReviewerRejected":
      return "The reviewer sided with the holder. The holder keeps all tokens and is unfrozen.";
    case "ReviewerSilent":
      return "The reviewer didn't decide before the deadline, so the holder won by default and is unfrozen.";
    case "Emergency":
      return `An emergency take back, signed by the issuer and the reviewer together: ${taken} ${asset} was taken back. The rest was unfrozen.`;
    case "NotEnded":
      return "The case hasn't ended.";
  }
}

export function explainCase(c: Case, now: number, ctx: { asset?: string } = {}): Explanation {
  const asset = ctx.asset ?? "tokens";
  const closed = c.status === "Cleared" || c.status === "TakenBack";

  const whatHappened: string[] = [
    `${iso(c.openedAt)}: the issuer opened the case against ${c.holder} for ${c.amount} ${asset}, reason: ${REASON_TEXT[c.reason]}. The holder was frozen. Public statement: "${c.statement}"`,
  ];
  if (c.answeredAt) {
    whatHappened.push(`${iso(c.answeredAt)}: the holder answered${c.holderStatement ? `. Statement: "${c.holderStatement}"` : "."}`);
  }
  if (c.decidedAt && (c.status === "Upheld" || c.status === "Rejected" || c.endedBy === "ReviewerUpheld" || c.endedBy === "ReviewerRejected")) {
    const side = c.status === "Upheld" || c.endedBy === "ReviewerUpheld" ? "the issuer" : "the holder";
    whatHappened.push(`${iso(c.decidedAt)}: the reviewer sided with ${side}${c.reviewerStatement ? `. Statement: "${c.reviewerStatement}"` : "."}`);
  }
  if (closed) whatHappened.push(`${iso(c.closedAt)}: ${ending(c.endedBy, c.taken, asset)}`);

  const answerOpen = c.status === "Open" && now <= c.answerBy;
  const answerOver = c.status === "Open" && now > c.answerBy;
  const reviewOpen = c.status === "Answered" && now <= c.reviewBy;
  const reviewOver = c.status === "Answered" && now > c.reviewBy;

  let summary: string;
  let nextSteps: string[];
  let settleWouldResultIn: Explanation["settleWouldResultIn"] = null;

  if (closed) {
    summary = `Case ${c.id} is closed: ${c.status === "Cleared" ? "Cleared" : "Taken back"}. ${ending(c.endedBy, c.taken, asset)}`;
    nextSteps = ["Nothing more can happen on this case. The record stays public on Stellar."];
  } else if (answerOpen) {
    summary = `Case ${c.id} is open. The holder's ${asset} are frozen. They can answer for free until ${iso(c.answerBy)}.`;
    nextSteps = [
      `The holder can answer until ${iso(c.answerBy)}. Answering is free: Habeas pays the network fee.`,
      "The issuer can withdraw the case at any time. The holder then keeps everything.",
      "The issuer and the reviewer together can close it as an emergency take back (clawback), with a reason on record.",
      `If nobody answers by ${iso(c.answerBy)}, anyone can settle the case after that. The result is Taken back.`,
    ];
  } else if (answerOver) {
    settleWouldResultIn = "Taken back";
    summary = `Case ${c.id} is open and the time to answer has passed without an answer. Anyone can settle it now: up to ${c.amount} ${asset} would be taken back (clawback) and the rest unfrozen.`;
    nextSteps = [
      "Anyone can settle the case now. The result is Taken back.",
      "The issuer can still withdraw the case before it is settled.",
    ];
  } else if (reviewOpen) {
    summary = `Case ${c.id} is answered and waiting for the reviewer, who can decide until ${iso(c.reviewBy)}. The holder's ${asset} stay frozen meanwhile.`;
    nextSteps = [
      `The reviewer can decide until ${iso(c.reviewBy)}, with a public statement.`,
      `If the reviewer doesn't decide by ${iso(c.reviewBy)}, anyone can settle the case after that and the holder wins by default (Cleared).`,
      "The issuer can still withdraw the case.",
    ];
  } else if (reviewOver) {
    settleWouldResultIn = "Cleared";
    summary = `Case ${c.id} is answered and the reviewer didn't decide in time. The holder wins by default: anyone can settle it now and the holder is unfrozen.`;
    nextSteps = [
      "Anyone can settle the case now. The result is Cleared.",
      "The issuer can still withdraw the case before it is settled.",
    ];
  } else if (c.status === "Upheld") {
    settleWouldResultIn = "Taken back";
    summary = `Case ${c.id}: the reviewer sided with the issuer. Anyone can settle it now: up to ${c.amount} ${asset} is taken back (clawback) and the rest unfrozen.`;
    nextSteps = ["Anyone can settle the case now. The result is Taken back."];
  } else {
    settleWouldResultIn = "Cleared";
    summary = `Case ${c.id}: the reviewer sided with the holder. Anyone can settle it now and the holder is unfrozen, keeping everything.`;
    nextSteps = ["Anyone can settle the case now. The result is Cleared."];
  }

  return {
    caseId: c.id,
    stage: c.status,
    closed,
    holderFrozen: !closed,
    summary,
    whatHappened,
    nextSteps,
    deadlines: {
      answerBy: iso(c.answerBy),
      answerSecondsLeft: c.status === "Open" ? left(c.answerBy, now) : null,
      reviewBy: c.reviewBy ? iso(c.reviewBy) : null,
      reviewSecondsLeft: c.status === "Answered" ? left(c.reviewBy, now) : null,
    },
    canSettleNow: settleWouldResultIn !== null,
    settleWouldResultIn,
    note: "Deadlines run on ledger time, so settling in the first seconds after one can still be refused. While a case is open, the holder's whole balance of this token is frozen; only up to the case amount can be taken back.",
  };
}
