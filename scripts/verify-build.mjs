// Checks that a deployed contract was built by GitHub Actions from its
// source repository, using the same steps as Stellar Lab's "Verified Build"
// badge (stellar/laboratory src/helpers/getBuildVerification.ts):
//   1. fetch the wasm from the network and hash it
//   2. read `source_repo` (github:owner/repo) from the wasm's contract metadata
//   3. fetch GitHub's build attestation for that hash
//   4. require the attested digest and source repository to match
//
// Usage: node scripts/verify-build.mjs [contractId] [testnet|mainnet]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { rpc } from "@stellar/stellar-sdk";

const dep = JSON.parse(readFileSync(new URL("../deployments/testnet.json", import.meta.url), "utf8"));
const contractId = process.argv[2] ?? dep.habeas;
const network = process.argv[3] ?? "testnet";
const server = new rpc.Server(network === "mainnet" ? "https://mainnet.sorobanrpc.com" : "https://soroban-testnet.stellar.org");

const wasm = await server.getContractWasmByContractId(contractId);
const hash = createHash("sha256").update(wasm).digest("hex");
console.log(`contract     ${contractId} (${network})`);
console.log(`wasm sha256  ${hash}`);

let repo = null;
const mod = await WebAssembly.compile(new Uint8Array(wasm));
for (const section of WebAssembly.Module.customSections(mod, "contractmetav0")) {
  const text = new TextDecoder().decode(new Uint8Array(section));
  repo ??= /github:([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/.exec(text)?.[1] ?? null;
}
if (!repo) {
  console.log("NOT VERIFIED: the wasm has no source_repo metadata");
  process.exit(1);
}
console.log(`source repo  github.com/${repo}`);

const res = await fetch(`https://api.github.com/repos/${repo}/attestations/sha256:${hash}`);
if (res.status !== 200) {
  console.log(`NOT VERIFIED: GitHub has no attestation for this hash (HTTP ${res.status})`);
  process.exit(1);
}
const body = await res.json();
const statement = JSON.parse(Buffer.from(body.attestations[0].bundle.dsseEnvelope.payload, "base64").toString());
const digestOk = statement.subject?.[0]?.digest?.sha256 === hash;
const source = statement.predicate?.buildDefinition?.resolvedDependencies?.[0]?.uri ?? "";
const repoOk = source.includes(repo);
console.log(`built from   ${source}`);
console.log(`workflow     ${statement.predicate?.runDetails?.builder?.id ?? "unknown"}`);
console.log(digestOk && repoOk ? "VERIFIED: GitHub Actions built this exact wasm from this repository" : "NOT VERIFIED: attestation doesn't match");
process.exit(digestOk && repoOk ? 0 : 1);
