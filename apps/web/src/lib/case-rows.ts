import type { FormRow, Stages } from "@/components/CaseForm";
import type { Dict, Lang } from "@/i18n/dict";
import type { Case, Status } from "./types";
import { formatTokens, formatUtc, shortAddress, shortHash } from "./format";

const ORDER: Status[] = ["Open", "Answered", "Upheld", "Rejected", "Cleared", "TakenBack"];
const reached = (now: Status, step: Status) => ORDER.indexOf(now) >= ORDER.indexOf(step);
const isDecided = (s: Status) => s === "Upheld" || s === "Rejected";
const isClosed = (s: Status) => s === "Cleared" || s === "TakenBack";

/**
 * The form rows for a case as it looked when its status was `at`. Fields
 * that weren't filled in yet at that moment say so.
 */
export function caseRows(c: Case, asset: string, t: Dict, lang: Lang, at: Status = c.status): FormRow[] {
  const answered = c.answeredAt > 0 && reached(at, "Answered");
  const decided = c.decidedAt > 0 && (isDecided(at) || isClosed(at));
  const closed = isClosed(at);
  const f = t.form;
  return [
    { label: f.holder, value: shortAddress(c.holder, 6), mono: true },
    { label: f.amountAtStake, value: `${formatTokens(c.amount, lang)} ${asset}`, mono: true },
    { label: f.reason, value: t.words.reason[c.reason] },
    { label: f.opened, value: formatUtc(c.openedAt, lang) },
    { label: f.publicReason, value: `“${c.statement}”`, wide: true },
    { label: f.fingerprint, value: shortHash(c.issuerFile, 8), mono: true },
    { label: f.answerBy, value: formatUtc(c.answerBy, lang) },
    answered
      ? { label: f.holdersAnswer, value: c.holderStatement ? `“${c.holderStatement}”` : f.answeredNoStatement, wide: true }
      : { label: f.holdersAnswer, pending: c.answeredAt === 0 && closed ? f.noAnswer : f.notAnsweredYet, wide: true },
    decided && c.reviewerStatement
      ? { label: f.reviewersDecision, value: `“${c.reviewerStatement}”`, wide: true }
      : { label: f.reviewersDecision, pending: closed ? f.noDecision : f.waiting, wide: true },
    ...(at === "TakenBack" ? [{ label: f.takenBack, value: `${formatTokens(c.taken, lang)} ${asset}`, mono: true }] : []),
  ];
}

/** Which stages a case had been through when its status was `at`. */
export function caseStages(c: Case, at: Status = c.status): Stages {
  return {
    frozen: true,
    answered: c.answeredAt > 0 && reached(at, "Answered"),
    decided: c.decidedAt > 0 && (isDecided(at) || (isClosed(at) && c.endedBy !== "Withdrawn" && c.endedBy !== "NoAnswer" && c.endedBy !== "ReviewerSilent")),
    closed: isClosed(at),
  };
}
