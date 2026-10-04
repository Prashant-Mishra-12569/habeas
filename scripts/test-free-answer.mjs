// End-to-end check of a whole demo case through the website's API, with a
// script playing the holder's wallet: start a case, answer for free (signed
// exactly as Freighter's signAuthEntry does), the demo reviewer decides, the
// relayer settles, and the timeline shows every transaction.
//
// Usage: node scripts/test-free-answer.mjs [baseUrl] [holderKeyName]
import { createHash } from "node:crypto";
import { key } from "./lib/stellar.mjs";

const base = process.argv[2] ?? "http://localhost:3000";
const holder = key(process.argv[3] ?? "habeas-holder-c");
const link = (h) => `https://stellar.expert/explorer/testnet/tx/${h}`;

async function post(path, body) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.error}`);
  return json;
}

const address = holder.publicKey();
console.log(`holder ${address}`);
const state = await post("/api/demo/state", { address });
if (state.activeCase && state.caseStatus !== "Open") {
  console.log(`closing earlier case ${state.activeCase} first`);
  await post("/api/case/settle", { caseId: state.activeCase }).catch((e) => console.log(`  ${e.message}`));
}
const fresh = await post("/api/demo/state", { address });
const caseId = fresh.activeCase ?? (await post("/api/demo/start", { address })).caseId;
console.log(`1. case ${caseId} open, holder frozen`);

const statement = "Test answer signed like a wallet would. The card is mine.";
const prepared = await post("/api/answer/prepare", { caseId, statement });
// What Freighter does with the preimage it is given.
const payload = createHash("sha256").update(Buffer.from(prepared.preimage, "base64")).digest();
const signature = Buffer.from(holder.sign(payload)).toString("base64");
const answered = await post("/api/answer/submit", { caseId, statement, entry: prepared.entry, signature, validUntil: prepared.validUntil });
console.log(`2. answered for free: ${link(answered.hash)}`);

const decided = await post("/api/demo/review", { caseId });
console.log(`3. reviewer rejected the claim: ${link(decided.hash)}`);

const settled = await post("/api/case/settle", { caseId });
console.log(`4. settled by the relayer, outcome ${settled.outcome}: ${link(settled.hash)}`);

const { case: c, timeline } = await post("/api/case/state", { caseId });
console.log(`case ${caseId}: ${c.status}, ended by ${c.endedBy}`);
for (const s of timeline.steps) console.log(`   ${s.kind.padEnd(9)} ${s.tx ? s.tx.slice(0, 8) : "no tx"}`);
const ok = c.status === "Cleared" && timeline.steps.length === 4 && timeline.steps.every((s) => s.tx);
if (!ok) process.exit(1);
