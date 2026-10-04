// Sets up the testnet accounts for the paid agent check (x402):
//   habeas-treasury  receives payments; needs a USDC trustline
//   habeas-attest    signs every paid answer; its public key is published
//   habeas-agent     an example buyer; gets a few testnet USDC from the
//                    testnet exchange (XLM -> USDC), no faucet form needed
// Keys stay in the Stellar CLI key store. Prints only public addresses.
//
// Usage: node scripts/setup-x402.mjs
import { execFileSync } from "node:child_process";
import { Asset, BASE_FEE, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { key, server, submit, txLink } from "./lib/stellar.mjs";

const STELLAR = process.env.STELLAR ?? "C:\\Program Files (x86)\\Stellar CLI\\stellar.exe";
// Circle's testnet USDC (its asset contract is CBIELTK6...DAMA, per Stellar's x402 docs).
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const HORIZON = "https://horizon-testnet.stellar.org";

function ensureKey(name) {
  try {
    execFileSync(STELLAR, ["keys", "address", name], { stdio: "ignore" });
  } catch {
    execFileSync(STELLAR, ["keys", "generate", name, "--fund", "--network", "testnet"], { stdio: "ignore" });
  }
  return key(name);
}

async function balances(pub) {
  const a = await (await fetch(`${HORIZON}/accounts/${pub}`)).json();
  return a.balances;
}

async function run(kp, ops, label) {
  let b = new TransactionBuilder(await server.getAccount(kp.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET });
  for (const op of ops) b = b.addOperation(op);
  const tx = b.setTimeout(60).build();
  tx.sign(kp);
  const r = await submit(tx, label);
  if (r.status !== "SUCCESS") throw new Error(`${label}: ${r.status}`);
  console.log(`   ${label}: ${txLink(r.hash)}`);
}

const hasUsdc = (bals) => bals.some((b) => b.asset_code === "USDC" && b.asset_issuer === USDC.issuer);

const treasury = ensureKey("habeas-treasury");
const attest = ensureKey("habeas-attest");
const agent = ensureKey("habeas-agent");
console.log(`treasury ${treasury.publicKey()}`);
console.log(`attest   ${attest.publicKey()}`);
console.log(`agent    ${agent.publicKey()}`);

for (const [kp, name] of [[treasury, "treasury"], [agent, "agent"]]) {
  if (!hasUsdc(await balances(kp.publicKey()))) await run(kp, [Operation.changeTrust({ asset: USDC })], `${name} USDC trustline`);
}

const agentUsdc = Number((await balances(agent.publicKey())).find((b) => b.asset_code === "USDC")?.balance ?? 0);
if (agentUsdc < 2) {
  await run(
    agent,
    [Operation.pathPaymentStrictReceive({ sendAsset: Asset.native(), sendMax: "20", destination: agent.publicKey(), destAsset: USDC, destAmount: "5", path: [] })],
    "agent buys 5 testnet USDC with XLM",
  );
}
const after = (await balances(agent.publicKey())).find((b) => b.asset_code === "USDC");
console.log(`agent USDC balance: ${after.balance}`);
