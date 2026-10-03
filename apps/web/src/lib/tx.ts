import "server-only";
import {
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
  scValToNative,
  type Transaction,
  type xdr,
} from "@stellar/stellar-sdk";
import { NETWORKS, ReadError, SimulationError } from "./network";

/** Writes go to testnet only. */
export const PASSPHRASE = Networks.TESTNET;
export const server = new rpc.Server(NETWORKS.testnet.rpc[0]);

/** A testnet demo key from the server environment. Never sent to the browser. */
export function envKey(name: "HABEAS_ISSUER_SECRET" | "RELAYER_SECRET"): Keypair {
  const secret = process.env[name];
  if (!secret) throw new ReadError(`The server is missing ${name}. See apps/web/.env.example.`);
  return Keypair.fromSecret(secret);
}

export async function build(sourcePub: string, op: xdr.Operation, timeout = 120): Promise<Transaction> {
  return new TransactionBuilder(await server.getAccount(sourcePub), { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(op)
    .setTimeout(timeout)
    .build();
}

export async function simulate(tx: Transaction) {
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new SimulationError(sim.error);
  return sim;
}

export type Sent = { hash: string; value: unknown };

/** Sends a signed transaction and waits until it is in a ledger. */
export async function send(tx: Transaction): Promise<Sent> {
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    // SDK 17 XDR objects expose `result` as a property; older ones as a method.
    const r = (sent.errorResult as unknown as { result?: { type?: string } | (() => { switch(): { name: string } }) })?.result;
    const code = typeof r === "function" ? r().switch().name : r?.type;
    throw new ReadError(`Stellar rejected the transaction (${code ?? "unknown"}).`);
  }
  const done = await server.pollTransaction(sent.hash, { attempts: 60 });
  if (done.status !== "SUCCESS") throw new ReadError(`The transaction ${sent.hash} ended as ${done.status}.`);
  return { hash: sent.hash, value: done.returnValue ? scValToNative(done.returnValue) : undefined };
}

/** Calls a contract with `source` as the only signer (its own auth is the source account). */
export async function invokeAs(source: Keypair, contractId: string, method: string, args: xdr.ScVal[]): Promise<Sent> {
  let tx = await build(source.publicKey(), new Contract(contractId).call(method, ...args));
  const sim = await simulate(tx);
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(source);
  return send(tx);
}

/** Rebuilds an invoke with explicit auth entries, re-simulates and assembles it. */
export async function withAuth(sourcePub: string, func: xdr.HostFunction, auth: xdr.SorobanAuthorizationEntry[]) {
  let tx = await build(sourcePub, Operation.invokeHostFunction({ func, auth }));
  const sim = await simulate(tx);
  tx = rpc.assembleTransaction(tx, sim).build();
  return tx;
}
