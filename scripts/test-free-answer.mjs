// End-to-end check of the free answer through the website's API, with a
// script playing the wallet. It signs the preimage exactly as Freighter's
// signAuthEntry does (ed25519 over sha256 of the preimage XDR, returned as
// base64), so a later failure with Freighter is about Freighter, not us.
//
// Usage: node scripts/test-free-answer.mjs [baseUrl] [holderKeyName]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { key, read, sc } from "./lib/stellar.mjs";

const base = process.argv[2] ?? "http://localhost:3000";
const holder = key(process.argv[3] ?? "habeas-holder-b");
const dep = JSON.parse(readFileSync(new URL("../deployments/testnet.json", import.meta.url), "utf8"));

async function post(path, body) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.error}`);
  return json;
}

const address = holder.publicKey();
console.log(`holder ${address}`);
const state = await post("/api/demo/state", { address });
console.log(`state: trustline=${state.hasTrustline} balance=${state.balance} activeCase=${state.activeCase}`);

const caseId = state.activeCase ?? (await post("/api/demo/start", { address })).caseId;
console.log(`case ${caseId} is open; the holder is frozen`);

const statement = "Test answer signed like a wallet would. The card is mine.";
const prepared = await post("/api/answer/prepare", { caseId, statement });
console.log(`prepared: validUntil=${prepared.validUntil}, preimage ${prepared.preimage.length} chars`);

// What Freighter does with the preimage it is given.
const payload = createHash("sha256").update(Buffer.from(prepared.preimage, "base64")).digest();
const signature = Buffer.from(holder.sign(payload)).toString("base64");

const { hash } = await post("/api/answer/submit", { caseId, statement, entry: prepared.entry, signature, validUntil: prepared.validUntil });
console.log(`answered for free: https://stellar.expert/explorer/testnet/tx/${hash}`);

const c = await read(dep.habeas, "get_case", [sc.u64(caseId)]);
console.log(`case ${caseId} status: ${c.status[0]}, holder statement: "${c.holder_statement}"`);
if (c.status[0] !== "Answered") process.exit(1);
