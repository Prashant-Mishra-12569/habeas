// Runs real cases against the Habeas contract in deployments/testnet.json and
// covers every ending: cleared after an appeal, taken back after an appeal,
// no answer, reviewer silent (holder wins by default), withdrawn, emergency.
// Writes every transaction to deployments/testnet-run.json.
//
// Usage: node scripts/run-demo-cases.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Asset, BASE_FEE, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { PASSPHRASE, invoke, key, read, sc, server, submit, txLink, wouldFail } from "./lib/stellar.mjs";

const root = new URL("../", import.meta.url);
const dep = JSON.parse(readFileSync(new URL("deployments/testnet.json", root), "utf8"));
const H = dep.habeas;
const UNIT = 10_000_000n; // 7 decimals

const k = {
  issuer: key("habeas-issuer"),
  reviewer: key("habeas-reviewer"),
  relayer: key("hb-relayer"),
  a: key("habeas-holder-a"),
  b: key("habeas-holder-b"),
  c: key("habeas-holder-c"),
  d: key("habeas-holder-d"),
};

/** SHA-256 of a file in scripts/demo-files: the "fingerprint of the file". */
function fingerprint(name) {
  const bytes = readFileSync(new URL(`scripts/demo-files/${name}`, root));
  return createHash("sha256").update(bytes).digest();
}

const steps = [];
async function step(label, promise) {
  const r = await promise;
  steps.push({ label, hash: r.hash });
  console.log(`${label}\n   ${txLink(r.hash)}`);
  return r;
}
const refusals = [];
async function expectRefusal(label, method, args, source, expected) {
  const err = await wouldFail(H, method, args, source.publicKey());
  if (err?.errorName !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${err ? err.message : "success"}`);
  }
  refusals.push({ label, error: expected });
  console.log(`${label}\n   refused as expected: ${expected}`);
}

const asIssuer = { source: k.issuer };
const openCase = (holder, amount, reason, statement, file) =>
  invoke(
    H,
    "open_case",
    [sc.address(holder.publicKey()), sc.i128(amount * UNIT), sc.variant(reason), sc.string(statement), sc.bytes(fingerprint(file))],
    asIssuer,
  );
// Free appeal: the holder signs only the auth entry, the relayer pays the fee.
const appeal = (holder, id, statement, file) =>
  invoke(H, "appeal", [sc.u64(id), sc.string(statement), file ? sc.bytes(fingerprint(file)) : sc.none()], {
    source: k.relayer,
    signers: [holder],
  });
const decide = (id, uphold, statement) =>
  invoke(H, "decide", [sc.u64(id), sc.bool(uphold), sc.string(statement), sc.bytes(fingerprint("reviewer-notes.txt"))], {
    source: k.reviewer,
  });
const settle = (id) => invoke(H, "settle", [sc.u64(id)], { source: k.relayer });
const getCase = (id) => read(H, "get_case", [sc.u64(id)]);
const balance = async (holder) => BigInt(await read(dep.sac, "balance", [sc.address(holder.publicKey())]));

async function waitUntil(unixSecs, why) {
  const ms = unixSecs * 1000 - Date.now() + 15_000; // margin for ledger close time
  if (ms > 0) {
    console.log(`   waiting ${Math.ceil(ms / 1000)}s ${why}`);
    await new Promise((r) => setTimeout(r, ms));
  }
}

// ---------------------------------------------------------------------------

console.log(`Habeas ${H} on testnet\n`);

for (const h of ["a", "b", "c", "d"]) {
  await step(`Issuer mints 1,000 DEMOUSD to holder ${h.toUpperCase()}`, invoke(H, "mint", [sc.address(k[h].publicKey()), sc.i128(1000n * UNIT)], asIssuer));
}

// Cases that need the clock go first so their windows run during the rest.
const caseB = (await step("Case B opened: sent by mistake, 250 DEMOUSD (holder B will not answer)",
  openCase(k.b, 250n, "SentByMistake", "Our payout system sent this payment twice.", "issuer-duplicate-payout.txt"))).value;
const caseC = (await step("Case C opened: suspected fraud, 300 DEMOUSD",
  openCase(k.c, 300n, "Fraud", "Funding payment reported stolen by the card owner.", "issuer-fraud-report.txt"))).value;
await step("Case C: holder C answers for free (relayer pays); the reviewer will stay silent",
  appeal(k.c, caseC, "I bought these tokens with my own card.", null));

// Case A: answered, reviewer rejects the claim, cleared.
const caseA = (await step("Case A opened: suspected fraud, 400 DEMOUSD",
  openCase(k.a, 400n, "Fraud", "Funding payment reported stolen by the card owner.", "issuer-fraud-report.txt"))).value;

// A frozen holder really can't move tokens: a classic payment back to the
// asset issuer fails on-chain with src_not_authorized.
{
  const asset = new Asset("DEMOUSD", dep.asset_issuer);
  const tx = new TransactionBuilder(await server.getAccount(k.a.publicKey()), { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(Operation.payment({ destination: dep.asset_issuer, asset, amount: "1" }))
    .setTimeout(60)
    .build();
  tx.sign(k.a);
  const r = await submit(tx, "frozen payment");
  if (r.status !== "FAILED") throw new Error(`frozen holder's payment did not fail: ${r.status}`);
  steps.push({ label: "Holder A tries to send 1 DEMOUSD while frozen: fails on-chain", hash: r.hash });
  console.log(`Holder A tries to send 1 DEMOUSD while frozen: fails on-chain\n   ${txLink(r.hash)}`);
}

await expectRefusal("Reviewer tries to decide case A before holder A answers", "decide",
  [sc.u64(caseA), sc.bool(true), sc.string("x"), sc.none()], k.reviewer, "NotAnswered");
await expectRefusal("Anyone tries to settle case A while holder A can still answer", "settle",
  [sc.u64(caseA)], k.relayer, "TooEarlyToSettle");
await expectRefusal("Issuer tries to open a second case against holder A", "open_case",
  [sc.address(k.a.publicKey()), sc.i128(1n), sc.variant("Other"), sc.string("again"), sc.bytes(fingerprint("issuer-fraud-report.txt"))],
  k.issuer, "AlreadyActiveCase");

await step("Case A: holder A answers for free (relayer pays)",
  appeal(k.a, caseA, "The card is mine. Bank statement attached.", "holder-a-answer.txt"));
await step("Case A: reviewer rejects the issuer's claim",
  decide(caseA, false, "The holder's bank statement shows the card is theirs."));
await step("Case A settled by the relayer: Cleared, holder A unfrozen", settle(caseA));

// Case D: answered, reviewer upholds, taken back.
const caseD = (await step("Case D opened: suspected fraud, 500 DEMOUSD",
  openCase(k.d, 500n, "Fraud", "Funding payment reported stolen by the card owner.", "issuer-fraud-report.txt"))).value;
await step("Case D: holder D answers for free (relayer pays)",
  appeal(k.d, caseD, "I don't know where the money came from.", null));
await step("Case D: reviewer upholds the issuer's claim",
  decide(caseD, true, "The card owner's report is confirmed; the holder gave no evidence."));
await step("Case D settled by the relayer: Taken back, 500 DEMOUSD", settle(caseD));

// Case E: withdrawn by the issuer.
const caseE = (await step("Case E opened against holder A: other, 100 DEMOUSD",
  openCase(k.a, 100n, "Other", "Checking an unusual transfer pattern.", "issuer-fraud-report.txt"))).value;
await step("Case E withdrawn by the issuer: holder A unfrozen", invoke(H, "withdraw", [sc.u64(caseE)], asIssuer));

// Emergency: issuer and reviewer both sign.
const emergency = await step("Emergency take back from holder D: court order, 50 DEMOUSD (issuer and reviewer both sign)",
  invoke(H, "emergency_take_back",
    [sc.address(k.d.publicKey()), sc.i128(50n * UNIT), sc.variant("CourtOrder"), sc.string("Court order 2026-CV-114 (demo)."), sc.bytes(fingerprint("court-order-demo.txt"))],
    { source: k.issuer, signers: [k.reviewer] }));

// Timeouts.
const b = await getCase(caseB);
await waitUntil(Number(b.answer_by), `for case B's answer window to close`);
await step("Case B settled by the relayer: no answer, Taken back 250 DEMOUSD", settle(caseB));
const c = await getCase(caseC);
await waitUntil(Number(c.review_by), `for case C's review window to close`);
await step("Case C settled by the relayer: reviewer silent, Cleared (holder wins by default)", settle(caseC));

// ---------------------------------------------------------------------------

const ids = { A: caseA, B: caseB, C: caseC, D: caseD, E: caseE, emergency: emergency.value };
const cases = {};
console.log("\nFinal state read back from the contract:");
for (const [name, id] of Object.entries(ids)) {
  const cs = await getCase(id);
  cases[name] = { id: Number(id), status: cs.status[0], ended_by: cs.ended_by[0], taken: (BigInt(cs.taken) / UNIT).toString() };
  console.log(`   case ${name} (#${id}): ${cs.status[0]}, ended by ${cs.ended_by[0]}, taken ${cases[name].taken}`);
}
const balances = {};
for (const h of ["a", "b", "c", "d"]) {
  balances[h] = ((await balance(k[h])) / UNIT).toString();
}
console.log(`   balances: ${JSON.stringify(balances)}`);
console.log(`   active cases: ${await read(H, "active_count")}, total cases: ${await read(H, "case_count")}`);

writeFileSync(
  new URL("deployments/testnet-run.json", root),
  JSON.stringify({ habeas: H, ran_at: new Date().toISOString(), steps, refusals, cases, balances }, null, 2) + "\n",
);
console.log("\nWrote deployments/testnet-run.json");
