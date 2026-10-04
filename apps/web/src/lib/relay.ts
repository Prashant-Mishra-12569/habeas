import "server-only";
import { Contract, authorizeEntry, buildAuthorizationEntryPreimage, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { deployment, getCase } from "./habeas";
import { ReadError, SimulationError } from "./network";
import { rpc } from "@stellar/stellar-sdk";
import { PASSPHRASE, build, envKey, send, server, simulate, withAuth } from "./tx";

/**
 * The free answer. The holder signs only their authorization for
 * `appeal(case_id, statement, file)`; the relayer builds the transaction,
 * pays the fee and submits it. The relayer only ever builds `appeal` calls on
 * the Habeas contract from the request's fields, so a signature for anything
 * else simply fails the network's auth check.
 */

const MAX_STATEMENT_BYTES = 280;
/** Ledgers the holder's signature stays valid (about 5 minutes). */
const SIGNATURE_LEDGERS = 60;

export type AnswerInput = { caseId: number; statement: string; fileHash: string | null };
export type PreparedAnswer = { entry: string; preimage: string; validUntil: number; holder: string };

function validate(input: AnswerInput) {
  if (!Number.isInteger(input.caseId) || input.caseId < 1) throw new ReadError("That isn't a case number.");
  if (new TextEncoder().encode(input.statement).length > MAX_STATEMENT_BYTES) {
    throw new ReadError(`Your answer is too long. Keep it under ${MAX_STATEMENT_BYTES} characters; put details in a file.`);
  }
  if (input.fileHash !== null && !/^[0-9a-f]{64}$/.test(input.fileHash)) throw new ReadError("The file fingerprint isn't valid.");
}

function appealCall({ caseId, statement, fileHash }: AnswerInput) {
  return new Contract(deployment.habeas).call(
    "appeal",
    nativeToScVal(BigInt(caseId), { type: "u64" }),
    nativeToScVal(statement, { type: "string" }),
    fileHash ? xdr.ScVal.scvBytes(Buffer.from(fileHash, "hex")) : xdr.ScVal.scvVoid(),
  );
}

/** Contract errors an answer can hit, said plainly. */
function explain(e: unknown): never {
  if (e instanceof SimulationError) {
    if (e.raw.includes("Error(Contract, #6)")) throw new ReadError("The answer window has closed. The case can now be settled.");
    if (e.raw.includes("Error(Contract, #10)")) throw new ReadError("This case already has an answer.");
    if (e.raw.includes("Error(Contract, #2)")) throw new ReadError("This case is already closed.");
    if (e.raw.includes("Error(Contract, #1)")) throw new ReadError("There's no case with that number.");
    throw new ReadError(`The contract refused the answer: ${e.message}`);
  }
  throw e;
}

export async function prepareAnswer(input: AnswerInput): Promise<PreparedAnswer> {
  validate(input);
  const c = await getCase(input.caseId);
  if (c.status !== "Open") throw new ReadError("This case isn't waiting for an answer.");

  const relayer = envKey("RELAYER_SECRET");
  let sim;
  try {
    sim = await simulate(await build(relayer.publicKey(), appealCall(input)));
  } catch (e) {
    explain(e);
  }
  const entry = (sim.result?.auth ?? []).find((e) => e.credentials.type !== "sorobanCredentialsSourceAccount");
  if (!entry) throw new ReadError("The network didn't ask for the holder's signature. Nothing to sign.");

  const { sequence } = await server.getLatestLedger();
  const validUntil = sequence + SIGNATURE_LEDGERS;
  const preimage = buildAuthorizationEntryPreimage(entry, validUntil, PASSPHRASE);
  return { entry: entry.toXDR("base64"), preimage: preimage.toXDR("base64"), validUntil, holder: c.holder };
}

export async function submitAnswer(
  input: AnswerInput & { entry: string; signature: string; validUntil: number; signerAddress?: string },
): Promise<{ hash: string }> {
  validate(input);
  const relayer = envKey("RELAYER_SECRET");
  const unsigned = xdr.SorobanAuthorizationEntry.fromXDR(input.entry, "base64");
  const signature = Buffer.from(input.signature, "base64");
  if (signature.length !== 64) throw new ReadError("The wallet returned something that isn't a signature.");

  // Attach the wallet's signature to the entry. The SDK checks it against the
  // holder's key before we spend anything.
  let signed: xdr.SorobanAuthorizationEntry;
  try {
    signed = await authorizeEntry(
      unsigned,
      async () => (input.signerAddress ? { signature, publicKey: input.signerAddress } : signature),
      input.validUntil,
      PASSPHRASE,
    );
  } catch (e) {
    throw new ReadError(`The signature doesn't match this answer (${(e as Error).message}).`);
  }

  let tx;
  try {
    const func = (await build(relayer.publicKey(), appealCall(input))).operations[0] as unknown as { func: xdr.HostFunction };
    tx = await withAuth(relayer.publicKey(), func.func, [signed]);
  } catch (e) {
    explain(e);
  }
  tx.sign(relayer);
  return { hash: (await send(tx)).hash };
}

/**
 * Closes a case that can close: reviewer decided, answer window over with no
 * answer, or reviewer silent past the review window. Anyone may settle; the
 * relayer pays so nobody needs XLM to do it.
 */
export async function settleCase(caseId: number): Promise<{ hash: string; outcome: string }> {
  if (!Number.isInteger(caseId) || caseId < 1) throw new ReadError("That isn't a case number.");
  const relayer = envKey("RELAYER_SECRET");
  const call = new Contract(deployment.habeas).call("settle", nativeToScVal(BigInt(caseId), { type: "u64" }));
  let tx;
  try {
    tx = await build(relayer.publicKey(), call);
    const sim = await simulate(tx);
    tx = rpc.assembleTransaction(tx, sim).build();
  } catch (e) {
    if (e instanceof SimulationError && e.raw.includes("Error(Contract, #8)")) {
      const c = await getCase(caseId);
      const until = c.status === "Answered" ? c.reviewBy : c.answerBy;
      const secs = Math.max(1, until - Math.floor(Date.now() / 1000));
      throw new ReadError(`This case can't close yet. It can be settled in about ${Math.ceil(secs / 60)} min, once the ${c.status === "Answered" ? "review" : "answer"} window ends.`);
    }
    if (e instanceof SimulationError && e.raw.includes("Error(Contract, #2)")) throw new ReadError("This case is already closed.");
    explain(e);
  }
  tx.sign(relayer);
  const sent = await send(tx);
  return { hash: sent.hash, outcome: Array.isArray(sent.value) ? String(sent.value[0]) : String(sent.value) };
}
