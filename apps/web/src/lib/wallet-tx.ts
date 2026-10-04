import "server-only";
import { Address, Contract, StrKey, TransactionBuilder, nativeToScVal, rpc, xdr, type Transaction } from "@stellar/stellar-sdk";
import { deployment, getCase } from "./habeas";
import { ReadError, SimulationError } from "./network";
import { PASSPHRASE, build, send, simulate } from "./tx";
import type { Case, Reason } from "./types";

/**
 * Transactions the issuer and the reviewer sign with their own wallets. They
 * are the transaction source, so they sign everything and pay their own fee.
 * The server only builds the call and, on submit, accepts nothing but a single
 * call to the Habeas contract.
 */

const REASONS: Reason[] = ["Fraud", "SanctionsOrder", "SentByMistake", "CourtOrder", "Other"];
const SUBMITTABLE = new Set(["open_case", "decide", "withdraw"]);
const UNIT = 10_000_000;

const ERRORS: Record<number, string> = {
  2: "This case is already closed.",
  3: "This holder already has an open case.",
  4: "The amount must be more than zero.",
  5: "That's more than the holder's balance.",
  7: "The review window has closed. The holder wins by default; anyone can settle the case.",
  9: "The holder hasn't answered yet, so there's nothing to decide.",
  11: "This case was already decided.",
  12: "The holder can't be the issuer, the reviewer or Habeas itself.",
  13: "A public reason is required.",
  14: "Keep the public reason under 280 characters; put details in the file.",
};

function explain(e: unknown): never {
  if (e instanceof SimulationError) {
    if (/Error\(Auth, InvalidAction\)|require_auth/.test(e.raw)) {
      throw new ReadError("This wallet isn't allowed to do that on this Habeas contract.");
    }
    const code = Number(/Error\(Contract, #(\d+)\)/.exec(e.raw)?.[1]);
    if (ERRORS[code]) throw new ReadError(ERRORS[code]);
    throw new ReadError(`The contract refused: ${e.message}`);
  }
  throw e;
}

function checkAccount(a: unknown, what: string): string {
  if (typeof a !== "string" || !StrKey.isValidEd25519PublicKey(a)) throw new ReadError(`${what} must be a Stellar account address (G…).`);
  return a;
}

function checkStatement(s: unknown, required: boolean): string {
  const text = typeof s === "string" ? s.trim() : "";
  if (required && !text) throw new ReadError("A public reason is required.");
  if (new TextEncoder().encode(text).length > 280) throw new ReadError("Keep the public reason under 280 characters; put details in the file.");
  return text;
}

function hash32(h: unknown, what: string): Buffer {
  if (typeof h !== "string" || !/^[0-9a-f]{64}$/.test(h)) throw new ReadError(`${what} must be a SHA-256 fingerprint.`);
  return Buffer.from(h, "hex");
}

const u64 = (n: number) => nativeToScVal(BigInt(n), { type: "u64" });

/** Builds, simulates and returns an unsigned transaction for the wallet to sign. */
export async function buildCall(body: Record<string, unknown>): Promise<{ xdr: string }> {
  const source = checkAccount(body.source, "The signing wallet");
  const habeas = new Contract(deployment.habeas);
  let op: xdr.Operation;
  switch (body.method) {
    case "open_case": {
      const holder = checkAccount(body.holder, "The holder");
      const amount = Number(body.amount);
      if (!(amount > 0) || !Number.isFinite(amount)) throw new ReadError("The amount must be more than zero.");
      const reason = body.reason as Reason;
      if (!REASONS.includes(reason)) throw new ReadError("Pick a reason.");
      op = habeas.call(
        "open_case",
        new Address(holder).toScVal(),
        nativeToScVal(BigInt(Math.round(amount * UNIT)), { type: "i128" }),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(reason)]),
        nativeToScVal(checkStatement(body.statement, true), { type: "string" }),
        xdr.ScVal.scvBytes(hash32(body.fileHash, "The file")),
      );
      break;
    }
    case "decide": {
      const caseId = Number(body.caseId);
      op = habeas.call(
        "decide",
        u64(caseId),
        nativeToScVal(Boolean(body.uphold)),
        nativeToScVal(checkStatement(body.statement, true), { type: "string" }),
        body.fileHash ? xdr.ScVal.scvBytes(hash32(body.fileHash, "The file")) : xdr.ScVal.scvVoid(),
      );
      break;
    }
    case "withdraw":
      op = habeas.call("withdraw", u64(Number(body.caseId)));
      break;
    default:
      throw new ReadError("That action isn't available.");
  }
  try {
    const tx = await build(source, op, 300);
    const sim = await simulate(tx);
    // Simulation only records who must sign. If the call needs anyone other
    // than this wallet (say, the reviewer for a decision), it would fail on
    // submit, so say so now.
    const others = (sim.result?.auth ?? []).filter((e) => e.credentials.type !== "sorobanCredentialsSourceAccount");
    if (others.length) {
      const config = await import("./habeas").then((m) => m.getConfig());
      const role = body.method === "decide" ? "the reviewer" : "the issuer";
      throw new ReadError(`Only ${role} of this Habeas contract can do this. On this demo that's ${role === "the reviewer" ? config.reviewer : config.issuer}.`);
    }
    return { xdr: rpc.assembleTransaction(tx, sim).build().toXDR() };
  } catch (e) {
    if (e instanceof ReadError) throw e;
    if (e instanceof Error && /not found|404/i.test(e.message)) throw new ReadError("This wallet's account doesn't exist on testnet yet. Fund it first.");
    explain(e);
  }
}

/** Submits a wallet-signed Habeas call. Anything else is refused. */
export async function submitCall(signedXdr: unknown): Promise<{ hash: string; value: unknown }> {
  if (typeof signedXdr !== "string") throw new ReadError("Missing the signed transaction.");
  let tx: Transaction;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE) as Transaction;
  } catch {
    throw new ReadError("That isn't a Stellar transaction.");
  }
  // SDK 17 decodes XDR into plain objects: func.invokeContract.{contractAddress, functionName}.
  const op = tx.operations[0] as unknown as { type: string; func?: { invokeContract?: { contractAddress: xdr.ScAddress; functionName: unknown } } };
  const call = op?.func?.invokeContract;
  const ok =
    tx.operations.length === 1 &&
    op.type === "invokeHostFunction" &&
    call !== undefined &&
    Address.fromScAddress(call.contractAddress).toString() === deployment.habeas &&
    SUBMITTABLE.has(String(call.functionName));
  if (!ok) throw new ReadError("Only Habeas case actions can be sent through this page.");
  const sent = await send(tx);
  return { hash: sent.hash, value: typeof sent.value === "bigint" ? Number(sent.value) : sent.value };
}

/** Cases the reviewer should look at: answered and waiting, or decided and ready to close. */
export async function reviewQueue(max = 40): Promise<Case[]> {
  const { caseCount } = await import("./habeas");
  const count = await caseCount();
  const ids = Array.from({ length: Math.min(count, max) }, (_, i) => count - i);
  const cases = await Promise.all(ids.map((id) => getCase(id).catch(() => null)));
  return cases.filter((c): c is Case => c !== null && (c.status === "Answered" || c.status === "Upheld" || c.status === "Rejected"));
}

/** Every case ever opened against `holder`, newest first. */
export async function casesFor(holder: string): Promise<Case[]> {
  checkAccount(holder, "The address");
  const { holderCaseIds } = await import("./habeas");
  const ids = (await holderCaseIds(holder)).slice(-30).reverse();
  return Promise.all(ids.map((id) => getCase(id)));
}
