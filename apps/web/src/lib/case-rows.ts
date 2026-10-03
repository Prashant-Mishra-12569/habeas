import type { FormRow } from "@/components/CaseForm";
import type { Case, Status } from "./types";
import { REASON_LABEL, formatTokens, formatUtc, shortAddress, shortHash } from "./format";

const ORDER: Status[] = ["Open", "Answered", "Upheld", "Rejected", "Cleared", "TakenBack"];
const reached = (now: Status, step: Status) => ORDER.indexOf(now) >= ORDER.indexOf(step);

/**
 * The form rows for a case as it looked when its status was `at`. Fields
 * that weren't filled in yet at that moment say so.
 */
export function caseRows(c: Case, asset: string, at: Status = c.status): FormRow[] {
  const answered = c.answeredAt > 0 && reached(at, "Answered");
  const decided = c.decidedAt > 0 && (at === "Upheld" || at === "Rejected" || at === "Cleared" || at === "TakenBack");
  const closed = at === "Cleared" || at === "TakenBack";
  return [
    { label: "Holder", value: shortAddress(c.holder, 6), mono: true },
    { label: "Amount at stake", value: `${formatTokens(c.amount)} ${asset}`, mono: true },
    { label: "Reason", value: REASON_LABEL[c.reason] },
    { label: "Opened", value: formatUtc(c.openedAt) },
    { label: "Public reason", value: `“${c.statement}”`, wide: true },
    { label: "Fingerprint of the file", value: shortHash(c.issuerFile, 8), mono: true },
    { label: "Answer by", value: formatUtc(c.answerBy) },
    answered
      ? { label: "Holder's answer", value: c.holderStatement ? `“${c.holderStatement}”` : "Answered, no statement", wide: true }
      : { label: "Holder's answer", pending: c.answeredAt === 0 && closed ? "No answer" : "Not answered yet", wide: true },
    decided && c.reviewerStatement
      ? { label: "Reviewer's decision", value: `“${c.reviewerStatement}”`, wide: true }
      : { label: "Reviewer's decision", pending: closed ? "No decision" : "Waiting", wide: true },
    ...(closed && at === "TakenBack" ? [{ label: "Taken back", value: `${formatTokens(c.taken)} ${asset}`, mono: true }] : []),
  ];
}
