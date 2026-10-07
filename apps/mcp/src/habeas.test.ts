// Logic tests for the pure parts: error table, refusal reading, lifecycle
// wording, statement limits and canonical JSON. They run on constructed
// inputs, because they test rules, not chain data. Chain data is covered by
// live.test.ts, which reads real testnet cases.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ATTEST_PREFIX, canonicalJson } from "./habeas/canonical.ts";
import { HABEAS_ERRORS, errorOrigin, habeasError, interpretRefusal } from "./habeas/errors.ts";
import { explainCase } from "./habeas/explain.ts";
import { checkStatement, normalizeFingerprint } from "./habeas/statement.ts";
import type { Case } from "./habeas/types.ts";

const HABEAS = "C" + "A".repeat(55);
const SAC = "C" + "B".repeat(55);

const base: Case = {
  id: 7,
  holder: "G" + "H".repeat(55),
  amount: "100",
  reason: "Fraud",
  statement: "Duplicate payout.",
  issuerFile: "00".repeat(32),
  status: "Open",
  openedAt: 1_000,
  answerBy: 1_180,
  answeredAt: 0,
  holderStatement: "",
  holderFile: null,
  reviewBy: 0,
  decidedAt: 0,
  reviewerStatement: "",
  reviewerFile: null,
  closedAt: 0,
  endedBy: "NotEnded",
  taken: "0",
};

test("error table matches the contract's twenty errors", () => {
  assert.equal(HABEAS_ERRORS.length, 21);
  assert.equal(habeasError(1)?.name, "CaseNotFound");
  assert.equal(habeasError(20)?.name, "NotIssuerOrReviewer");
  assert.equal(habeasError(0), null);
  assert.equal(habeasError(21), null);
  for (let i = 1; i <= 20; i++) assert.ok(habeasError(i)!.meaning.length > 10, `error ${i} has a plain meaning`);
});

const log = (contract: string, code: number, data = "") =>
  `diagnostic_event: contract:${contract}, topics:[error, Error(Contract, #${code})], data:[${data}]`;

test("a Habeas error name is used only when Habeas raised it", () => {
  // Newest event first, so the last line is where the error started.
  const raw = [log(HABEAS, 3), log(SAC, 13, '"trustline entry is missing for account"')].join("\n");
  const r = interpretRefusal(raw, HABEAS);
  assert.equal(r.kind, "other-contract");
  const own = interpretRefusal(log(HABEAS, 13), HABEAS);
  assert.equal(own.kind, "habeas");
  if (own.kind === "habeas") assert.equal(own.error.name, "StatementRequired");
});

test("the token contract's #13 is not mistaken for a Habeas error", () => {
  const r = interpretRefusal(log(SAC, 13, '"trustline entry is missing for account"'), HABEAS);
  assert.equal(r.kind, "other-contract");
  if (r.kind === "other-contract") {
    assert.equal(r.contract, SAC);
    assert.match(r.message ?? "", /trustline/);
  }
});

test("a direct read with no origin line can still name the Habeas error", () => {
  const raw = "HostError: Error(Contract, #1)\n(no diagnostic events)";
  assert.equal(interpretRefusal(raw, HABEAS).kind, "unknown");
  const direct = interpretRefusal(`topics:[error, Error(Contract, #1)]`, HABEAS, { direct: true });
  assert.equal(direct.kind, "habeas");
  assert.deepEqual(errorOrigin("nothing here"), { contract: undefined, code: undefined, message: undefined });
});

test("lifecycle: open, before and after the answer deadline", () => {
  const before = explainCase(base, 1_100, { asset: "DEMOUSD" });
  assert.equal(before.stage, "Open");
  assert.equal(before.canSettleNow, false);
  assert.equal(before.deadlines.answerSecondsLeft, 80);
  assert.match(before.summary, /answer for free/);
  const after = explainCase(base, 1_181);
  assert.equal(after.canSettleNow, true);
  assert.equal(after.settleWouldResultIn, "Taken back");
  // Deadlines are inclusive: at exactly answer_by the holder can still answer.
  assert.equal(explainCase(base, 1_180).canSettleNow, false);
});

test("lifecycle: answered, reviewer silent means the holder wins by default", () => {
  const answered: Case = { ...base, status: "Answered", answeredAt: 1_050, reviewBy: 1_170, holderStatement: "It was a refund." };
  assert.equal(explainCase(answered, 1_100).canSettleNow, false);
  assert.equal(explainCase(answered, 1_170).canSettleNow, false);
  const late = explainCase(answered, 1_171);
  assert.equal(late.settleWouldResultIn, "Cleared");
  assert.match(late.summary, /holder wins by default/);
});

test("lifecycle: decided cases can be settled right away", () => {
  const upheld = explainCase({ ...base, status: "Upheld", answeredAt: 1_050, reviewBy: 1_170, decidedAt: 1_100, reviewerStatement: "Evidence matches." }, 1_101);
  assert.equal(upheld.settleWouldResultIn, "Taken back");
  const rejected = explainCase({ ...base, status: "Rejected", answeredAt: 1_050, reviewBy: 1_170, decidedAt: 1_100, reviewerStatement: "No evidence." }, 1_101);
  assert.equal(rejected.settleWouldResultIn, "Cleared");
});

test("lifecycle: every ending reads correctly once closed", () => {
  const closed = (endedBy: Case["endedBy"], status: Case["status"], taken = "0"): Case => ({ ...base, status, endedBy, taken, closedAt: 2_000 });
  const t = (e: Case["endedBy"], s: Case["status"], taken?: string) => explainCase(closed(e, s, taken), 3_000, { asset: "DEMOUSD" });
  assert.match(t("NoAnswer", "TakenBack", "100").summary, /Taken back/);
  assert.match(t("NoAnswer", "TakenBack", "100").summary, /didn't answer/);
  assert.match(t("ReviewerUpheld", "TakenBack", "40").summary, /sided with the issuer.*40 DEMOUSD/);
  assert.match(t("ReviewerRejected", "Cleared").summary, /sided with the holder/);
  assert.match(t("ReviewerSilent", "Cleared").summary, /won by default/);
  assert.match(t("Withdrawn", "Cleared").summary, /withdrew/);
  assert.match(t("Emergency", "TakenBack", "5").summary, /issuer and the reviewer together/);
  for (const e of [t("NoAnswer", "TakenBack", "1"), t("Withdrawn", "Cleared")]) {
    assert.equal(e.closed, true);
    assert.equal(e.holderFrozen, false);
    assert.equal(e.canSettleNow, false);
  }
});

test("statements are limited to 280 bytes, not characters", () => {
  assert.equal(checkStatement("x".repeat(280)).ok, true);
  assert.equal(checkStatement("x".repeat(281)).over, 1);
  // 100 of these are 300 bytes in UTF-8 but only 100 characters.
  assert.equal(checkStatement("é".repeat(100)).bytes, 200);
  assert.equal(checkStatement("€".repeat(100)).ok, false);
  assert.equal(checkStatement("   ").ok, false);
});

test("fingerprints are 64 hex characters", () => {
  assert.equal(normalizeFingerprint("AB".repeat(32)), "ab".repeat(32));
  assert.equal(normalizeFingerprint("0x" + "ab".repeat(32)), "ab".repeat(32));
  assert.equal(normalizeFingerprint("abc"), null);
});

test("canonical JSON sorts keys, drops undefined and matches the site's rule", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: undefined }], c: "x" } }), '{"a":{"c":"x","d":[2,{"z":1}]},"b":1}');
  assert.equal(ATTEST_PREFIX, "habeas-check-v1:");
});
