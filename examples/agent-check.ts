// An agent pays Habeas $0.001 (testnet USDC, over x402) to check a Stellar
// token, then proves the answer came from Habeas by checking its signature.
//
//   cd examples && npm install
//   AGENT_SECRET=S... node agent-check.ts USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E
//
// AGENT_SECRET is a testnet account holding a little testnet USDC
// (scripts/setup-x402.mjs makes one). Instead of AGENT_SECRET you can name a
// Stellar CLI key with AGENT_KEY=habeas-agent. Needs Node 22.18 or newer.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Keypair } from "@stellar/stellar-sdk";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const BASE = process.env.HABEAS_URL ?? "https://habeas-stellar.vercel.app";
// Published at /api/v1/key. Pin it: a signature from any other key means nothing.
const HABEAS_SIGNER = "GAJ2MWWEY5VAMG3GW72Z36647UVIYWZKOZDBF5BUTZM2JNTOZWUJHZ4J";
const asset = process.argv[2] ?? "USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E";
const network = process.argv[3] ?? "mainnet"; // which network the token lives on; payment is always testnet

const secret =
  process.env.AGENT_SECRET ??
  execFileSync(process.env.STELLAR ?? "stellar", ["keys", "secret", process.env.AGENT_KEY ?? "habeas-agent"], { encoding: "utf8" }).trim();
const signer = createEd25519Signer(secret, "stellar:testnet");
const pay = wrapFetchWithPayment(fetch, new x402Client().register("stellar:testnet", new ExactStellarScheme(signer)));

const res = await pay(`${BASE}/api/v1/check/${encodeURIComponent(asset)}?network=${network}`);
const body = await res.json();
if (!res.ok) throw new Error(`Habeas answered ${res.status}: ${body.error ?? JSON.stringify(body)}`);

const receipt = res.headers.get("PAYMENT-RESPONSE");
if (receipt) console.log("paid, testnet tx:", decodePaymentResponseHeader(receipt).transaction);

// Same rule the server uses: keys sorted at every level, no spaces.
const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`
      : JSON.stringify(v);

const { attestation, ...signed } = body;
const digest = createHash("sha256").update(attestation.prefix + canonical(signed)).digest();
const valid =
  attestation.signer === HABEAS_SIGNER &&
  Keypair.fromPublicKey(HABEAS_SIGNER).verify(digest, Buffer.from(attestation.signature, "base64"));
if (!valid) throw new Error("The signature does not match Habeas's key. Don't trust this answer.");

const r = signed.result;
console.log(`signature checked: signed by ${attestation.signer} at ${signed.signedAt}`);
console.log(`${r.code}: ${r.verdict}`);
const taken = `${r.history.takeBacks.length}${r.history.complete ? "" : " or more"}`;
console.log(`  can freeze: ${r.flags.revocable}, can take back: ${r.flags.clawbackEnabled}, take backs found: ${taken}`);
