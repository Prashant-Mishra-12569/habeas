// The issuer and reviewer pages through the website's API, with our demo keys
// standing in for their wallets: the issuer opens a case, the holder answers
// for free, the reviewer upholds, the case settles as Taken back. Also checks
// that the submit endpoint refuses anything but Habeas case actions.
//
// Usage: node scripts/test-wallet-roles.mjs [baseUrl]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Asset, Contract, Networks, Operation, TransactionBuilder, nativeToScVal, Address } from "@stellar/stellar-sdk";
import { key, server } from "./lib/stellar.mjs";

const base = process.argv[2] ?? "http://localhost:3000";
const dep = JSON.parse(readFileSync(new URL("../deployments/testnet.json", import.meta.url), "utf8"));
const issuer = key("habeas-issuer");
const reviewer = key("habeas-reviewer");
const holder = key("habeas-holder-d");
const link = (h) => `https://stellar.expert/explorer/testnet/tx/${h}`;

async function post(path, body, expectError = false) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok && !expectError) throw new Error(`${path}: ${json.error}`);
  return { ok: res.ok, ...json };
}

// Wallet-signed: build on the server, sign here, submit through the server.
async function asWallet(kp, body) {
  const { xdr } = await post("/api/tx/build", { ...body, source: kp.publicKey() });
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  tx.sign(kp);
  return post("/api/tx/submit", { signedXdr: tx.toXDR() });
}

const fileHash = createHash("sha256").update(readFileSync(new URL("demo-files/issuer-fraud-report.txt", import.meta.url))).digest("hex");
// Resume a case an earlier run left open, if any.
const state = await post("/api/demo/state", { address: holder.publicKey() });
let caseId = state.activeCase;
if (caseId && state.caseStatus !== "Answered") {
  await post("/api/case/settle", { caseId }, true);
  caseId = null;
}
if (!caseId) {
  const opened = await asWallet(issuer, {
    method: "open_case",
    holder: holder.publicKey(),
    amount: 120,
    reason: "Fraud",
    statement: "Opened from the issuer page test.",
    fileHash,
  });
  caseId = opened.value;
  console.log(`1. issuer opened case ${caseId}: ${link(opened.hash)}`);
  const prepared = await post("/api/answer/prepare", { caseId, statement: "Not mine to explain." });
  const signature = Buffer.from(holder.sign(createHash("sha256").update(Buffer.from(prepared.preimage, "base64")).digest())).toString("base64");
  const answered = await post("/api/answer/submit", { caseId, statement: "Not mine to explain.", entry: prepared.entry, signature, validUntil: prepared.validUntil });
  console.log(`2. holder answered for free: ${link(answered.hash)}`);
} else {
  console.log(`1-2. resuming answered case ${caseId}`);
}

const wrong = await post("/api/tx/build", { method: "decide", caseId, uphold: true, statement: "Not the reviewer.", source: issuer.publicKey() }, true);
console.log(`   issuer trying to decide: ${wrong.ok ? "ALLOWED (bad)" : `refused: ${wrong.error}`}`);
if (wrong.ok) process.exit(1);

const decided = await asWallet(reviewer, { method: "decide", caseId, uphold: true, statement: "The card owner's report holds up." });
console.log(`3. reviewer upheld: ${link(decided.hash)}`);

const settled = await post("/api/case/settle", { caseId });
console.log(`4. settled: ${settled.outcome} ${link(settled.hash)}`);
if (settled.outcome !== "TakenBack") process.exit(1);

// The submit endpoint must refuse anything else.
const account = await server.getAccount(issuer.publicKey());
const payment = new TransactionBuilder(account, { fee: "100", networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({ destination: holder.publicKey(), asset: Asset.native(), amount: "1" }))
  .setTimeout(60)
  .build();
payment.sign(issuer);
const p = await post("/api/tx/submit", { signedXdr: payment.toXDR() }, true);
console.log(`   a plain payment: ${p.ok ? "SUBMITTED (bad)" : `refused: ${p.error}`}`);
const mint = new TransactionBuilder(await server.getAccount(issuer.publicKey()), { fee: "100", networkPassphrase: Networks.TESTNET })
  .addOperation(new Contract(dep.habeas).call("mint", new Address(issuer.publicKey()).toScVal(), nativeToScVal(1n, { type: "i128" })))
  .setTimeout(60)
  .build();
mint.sign(issuer);
const m = await post("/api/tx/submit", { signedXdr: mint.toXDR() }, true);
console.log(`   a Habeas mint: ${m.ok ? "SUBMITTED (bad)" : `refused: ${m.error}`}`);
if (p.ok || m.ok) process.exit(1);

const mine = await post("/api/cases/for", { address: holder.publicKey() });
console.log(`   /api/cases/for holder D: ${mine.cases.map((c) => `#${c.id} ${c.status}`).join(", ")}`);
