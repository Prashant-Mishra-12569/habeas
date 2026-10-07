// Habeas contract errors, in the order of contracts/habeas/src/errors.rs.
// Pure: no network, no SDK.

export const HABEAS_ERRORS = [
  null,
  "CaseNotFound",
  "CaseNotActive",
  "AlreadyActiveCase",
  "InvalidAmount",
  "AmountTooHigh",
  "AnswerWindowClosed",
  "ReviewWindowClosed",
  "TooEarlyToSettle",
  "NotAnswered",
  "AlreadyAnswered",
  "AlreadyDecided",
  "InvalidHolder",
  "StatementRequired",
  "StatementTooLong",
  "InvalidWindow",
  "SameIssuerAndReviewer",
  "NoPendingHandover",
  "HandoverNotReady",
  "ActiveCasesExist",
  "NotIssuerOrReviewer",
] as const;

/** What each error means, in the words the site uses. */
const PLAIN: Record<string, string> = {
  CaseNotFound: "There is no case with that number.",
  CaseNotActive: "This case is already closed.",
  AlreadyActiveCase: "This holder already has an open case.",
  InvalidAmount: "The amount must be more than zero.",
  AmountTooHigh: "That's more than the holder's balance.",
  AnswerWindowClosed: "The time to answer has passed.",
  ReviewWindowClosed: "The review window has closed. The holder wins by default; anyone can settle the case.",
  TooEarlyToSettle: "The case can't be settled yet: a deadline hasn't passed or a decision is still missing.",
  NotAnswered: "The holder hasn't answered yet, so there's nothing to decide.",
  AlreadyAnswered: "The holder already answered this case.",
  AlreadyDecided: "This case was already decided.",
  InvalidHolder: "The holder can't be the issuer, the reviewer or Habeas itself.",
  StatementRequired: "A public statement is required.",
  StatementTooLong: "Keep the public statement under 280 bytes; put details in the file.",
  InvalidWindow: "That answer or review window isn't allowed (the cap is 30 days).",
  SameIssuerAndReviewer: "The issuer and the reviewer can't be the same address.",
  NoPendingHandover: "There is no admin handover waiting.",
  HandoverNotReady: "The admin handover isn't ready yet: it has a 7-day public delay.",
  ActiveCasesExist: "The handover can't finish while a case is open.",
  NotIssuerOrReviewer: "Only the issuer or the reviewer can do that.",
};

export type ErrorInfo = { code: number; name: string; meaning: string };

/** Looks up a Habeas error number. Returns null for numbers the contract doesn't define. */
export function habeasError(code: number): ErrorInfo | null {
  const name = Number.isInteger(code) ? HABEAS_ERRORS[code] : undefined;
  return name ? { code, name, meaning: PLAIN[name]! } : null;
}

export type Origin = { contract?: string; code?: number; message?: string };

/**
 * Where an error started. The diagnostic log lists the newest event first, so
 * the last error event is where it began. It names the contract that raised it
 * and, for the asset contract, can carry a readable message.
 */
export function errorOrigin(log: string): Origin {
  const lines = log.split("\n").filter((l) => l.includes("topics:[error, Error(Contract, #"));
  const last = lines.at(-1) ?? "";
  const code = /Error\(Contract, #(\d+)\)/.exec(last)?.[1];
  return {
    contract: /contract:(C[A-Z0-9]{55})/.exec(last)?.[1],
    code: code === undefined ? undefined : Number(code),
    message: /data:\["([^"]+)"/.exec(last)?.[1],
  };
}

export type Refusal =
  | { kind: "habeas"; error: ErrorInfo }
  | { kind: "other-contract"; contract: string; code: number | undefined; message: string | undefined }
  | { kind: "unknown"; summary: string };

/**
 * Explains a refused simulation. A Habeas error name is used only when the
 * diagnostic shows Habeas raised it: the token (SAC) contract it calls has its
 * own numbered errors (for example #13 means a missing trustline there).
 * `direct` is for a plain read of Habeas, where no other contract is called.
 */
export function interpretRefusal(raw: string, habeasContract: string, opts: { direct?: boolean } = {}): Refusal {
  const o = errorOrigin(raw);
  if (o.code !== undefined && (o.contract === habeasContract || (opts.direct && o.contract === undefined))) {
    const error = habeasError(o.code);
    if (error) return { kind: "habeas", error };
  }
  if (o.contract && o.contract !== habeasContract) {
    return { kind: "other-contract", contract: o.contract, code: o.code, message: o.message };
  }
  if (/Error\(Auth, InvalidAction\)|require_auth/.test(raw)) {
    return { kind: "unknown", summary: "This wallet isn't allowed to do that on this Habeas contract." };
  }
  return { kind: "unknown", summary: raw.split("\n")[0] ?? "The contract refused." };
}
