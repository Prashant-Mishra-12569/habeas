// Small helpers for calling the Habeas contract on testnet from Node.
// Keys come from the Stellar CLI key store and never leave this process.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  authorizeEntry,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

export const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
export const PASSPHRASE = Networks.TESTNET;
export const server = new rpc.Server(RPC_URL);
// Any funded testnet account works as the source for read-only simulation.
const READ_ACCOUNT = "GAXJZQQE6XWVP5HVJ6LPVS5IC37CYGQ2J5LTUYLKT5KZE6YJFIJ7LRE5";
export const txLink = (hash) => `https://stellar.expert/explorer/testnet/tx/${hash}`;

const WINDOWS_CLI = "C:\\Program Files (x86)\\Stellar CLI\\stellar.exe";
const STELLAR = process.env.STELLAR ?? (existsSync(WINDOWS_CLI) ? WINDOWS_CLI : "stellar");

/** Loads a named key from the Stellar CLI key store. */
export function key(name) {
  const secret = execFileSync(STELLAR, ["keys", "secret", name], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  return Keypair.fromSecret(secret);
}

/** Builders for contract arguments. */
export const sc = {
  address: (a) => new Address(a).toScVal(),
  u64: (n) => nativeToScVal(BigInt(n), { type: "u64" }),
  i128: (n) => nativeToScVal(BigInt(n), { type: "i128" }),
  string: (s) => nativeToScVal(s, { type: "string" }),
  bool: (b) => nativeToScVal(b),
  bytes: (buf) => xdr.ScVal.scvBytes(buf),
  none: () => xdr.ScVal.scvVoid(),
  /** A unit enum variant such as Reason::Fraud. */
  variant: (name) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name)]),
};

/** Error names, in the order of contracts/habeas/src/errors.rs. */
const ERRORS = [
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
];

export class ContractError extends Error {
  constructor(method, code, raw) {
    super(`${method} refused: ${ERRORS[code] ?? `error #${code}`}`);
    this.code = code;
    this.errorName = ERRORS[code];
    this.raw = raw;
  }
}

// The diagnostic log lists the newest event first, so the last error event
// is where the error started. It names the contract that raised it and, for
// the asset contract, carries a readable message.
function origin(log) {
  const lines = log.split("\n").filter((l) => l.includes("topics:[error, Error(Contract, #"));
  const last = lines.at(-1) ?? "";
  return {
    contract: /contract:(C[A-Z0-9]{55})/.exec(last)?.[1],
    code: Number(/Error\(Contract, #(\d+)\)/.exec(last)?.[1]),
    message: /data:\["([^"]+)"/.exec(last)?.[1],
  };
}

function simulationError(method, sim, contractId) {
  const o = origin(sim.error);
  // Only use Habeas error names for errors Habeas raised itself. The asset
  // contract it calls has its own numbered errors.
  if (o.contract === contractId && o.code) return new ContractError(method, o.code, sim.error);
  if (o.contract) {
    return new Error(`${method} refused by ${o.contract}: ${o.message ?? `error #${o.code}`}`);
  }
  return new Error(`${method} simulation failed: ${sim.error.split("\n")[0]}`);
}

async function build(sourcePub, operation) {
  return new TransactionBuilder(await server.getAccount(sourcePub), {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(120)
    .build();
}

/** True when an auth entry must be signed by an address other than the source. */
const needsSignature = (entry) => entry.credentials.type !== "sorobanCredentialsSourceAccount";
/** The G... or C... address an auth entry belongs to. */
const signerOf = (entry) => {
  const c = entry.credentials;
  const addr = (c.addressV2 ?? c.address).address;
  return typeof addr === "string" ? addr : Address.fromScAddress(addr).toString();
};

/**
 * Calls a contract method. `source` signs the envelope and pays the fee. Any
 * other address the call needs signs only its auth entry, which is how the
 * free appeal works: the holder signs, the relayer pays.
 */
export async function invoke(contractId, method, args, { source, signers = [] }) {
  let tx = await build(source.publicKey(), new Contract(contractId).call(method, ...args));
  let sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw simulationError(method, sim, contractId);

  const entries = sim.result?.auth ?? [];
  if (entries.some(needsSignature)) {
    const { sequence } = await server.getLatestLedger();
    const signed = await Promise.all(
      entries.map((entry) => {
        if (!needsSignature(entry)) return entry;
        const who = signerOf(entry);
        const signer = signers.find((k) => k.publicKey() === who);
        if (!signer) throw new Error(`${method}: needs a signature from ${who}`);
        return authorizeEntry(entry, signer, sequence + 100, PASSPHRASE);
      }),
    );
    const func = tx.operations[0].func;
    tx = await build(source.publicKey(), Operation.invokeHostFunction({ func, auth: signed }));
    sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw simulationError(method, sim, contractId);
  }

  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(source);
  return submit(tx, method);
}

/** Sends a signed transaction and waits for the result. */
export async function submit(tx, label) {
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`${label}: rejected (${sent.errorResult?.result().switch().name})`);
  }
  const done = await server.pollTransaction(sent.hash, { attempts: 60 });
  const value = done.returnValue ? scValToNative(done.returnValue) : undefined;
  return { hash: sent.hash, status: done.status, value, ledger: done.ledger };
}

/** Read-only call through simulation. Costs nothing. */
export async function read(contractId, method, args = []) {
  // Simulation needs a source account that exists; the sequence is ignored.
  const source = new Account(process.env.READ_ACCOUNT ?? READ_ACCOUNT, "0");
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw simulationError(method, sim, contractId);
  return scValToNative(sim.result.retval);
}

/** Simulates a call and returns the contract error it would hit, if any. */
export async function wouldFail(contractId, method, args, sourcePub) {
  const tx = await build(sourcePub, new Contract(contractId).call(method, ...args));
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationError(sim)) return null;
  return simulationError(method, sim, contractId);
}
