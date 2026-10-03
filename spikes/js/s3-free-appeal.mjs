// Spike S3: a holder with no spendable XLM appeals for free.
// The holder signs only the Soroban auth entry; the relayer is the transaction
// source and pays the fee. Secrets come from env vars and are never printed.
//
// Usage: CONTRACT_ID=C... HOLDER_SECRET=... RELAYER_SECRET=... node s3-free-appeal.mjs
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  authorizeEntry,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const passphrase = Networks.TESTNET;

const { CONTRACT_ID, HOLDER_SECRET, RELAYER_SECRET } = process.env;
if (!CONTRACT_ID || !HOLDER_SECRET || !RELAYER_SECRET) {
  throw new Error("Set CONTRACT_ID, HOLDER_SECRET and RELAYER_SECRET");
}

const server = new rpc.Server(RPC_URL);
const holder = Keypair.fromSecret(HOLDER_SECRET);
const relayer = Keypair.fromSecret(RELAYER_SECRET);

async function xlmBalance(pub) {
  const res = await fetch(`${HORIZON_URL}/accounts/${pub}`);
  const acct = await res.json();
  return acct.balances.find((b) => b.asset_type === "native").balance;
}

const holderBefore = await xlmBalance(holder.publicKey());
const relayerBefore = await xlmBalance(relayer.publicKey());

// 1. Build the call with the relayer as source and simulate to get the auth entry.
const call = new Contract(CONTRACT_ID).call("appeal", new Address(holder.publicKey()).toScVal());
const draft = new TransactionBuilder(await server.getAccount(relayer.publicKey()), {
  fee: BASE_FEE,
  networkPassphrase: passphrase,
})
  .addOperation(call)
  .setTimeout(120)
  .build();

const sim = await server.simulateTransaction(draft);
if (rpc.Api.isSimulationError(sim)) throw new Error(`simulation failed: ${sim.error}`);
const entries = sim.result.auth;
console.log(`auth entries to sign: ${entries.length}`);

// 2. The holder signs only the auth entry. This is what Freighter's
//    signAuthEntry does in the browser.
const { sequence } = await server.getLatestLedger();
const signed = await Promise.all(
  entries.map((e) => authorizeEntry(e, holder, sequence + 100, passphrase)),
);

// 3. Rebuild with the signed entry, re-simulate (so resources include the
//    signature check), then the relayer signs the envelope and pays.
const func = draft.operations[0].func;
let tx = new TransactionBuilder(await server.getAccount(relayer.publicKey()), {
  fee: BASE_FEE,
  networkPassphrase: passphrase,
})
  .addOperation(Operation.invokeHostFunction({ func, auth: signed }))
  .setTimeout(120)
  .build();

const sim2 = await server.simulateTransaction(tx);
if (rpc.Api.isSimulationError(sim2)) throw new Error(`re-simulation failed: ${sim2.error}`);
tx = rpc.assembleTransaction(tx, sim2).build();
tx.sign(relayer);

const sent = await server.sendTransaction(tx);
if (sent.status === "ERROR") throw new Error(`send failed: ${JSON.stringify(sent.errorResult)}`);
const done = await server.pollTransaction(sent.hash, { attempts: 30 });
console.log(`status: ${done.status}`);
console.log(`tx: ${sent.hash}`);
if (done.status === "SUCCESS") console.log(`appeal count returned: ${scValToNative(done.returnValue)}`);

console.log(`holder XLM  before ${holderBefore}  after ${await xlmBalance(holder.publicKey())}`);
console.log(`relayer XLM before ${relayerBefore}  after ${await xlmBalance(relayer.publicKey())}`);
