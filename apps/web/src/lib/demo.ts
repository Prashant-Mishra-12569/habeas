import "server-only";
import { Address, Asset, Operation, StrKey, TransactionBuilder, nativeToScVal, xdr, type Transaction } from "@stellar/stellar-sdk";
import { deployment } from "./habeas";
import { ReadError, SimulationError, horizon } from "./network";
import { PASSPHRASE, envKey, invokeAs, send, server } from "./tx";

/**
 * The demo issuer's side of Try it live: give a visitor test DEMOUSD and
 * open a real case against them. Testnet only.
 */

const [CODE, ISSUER] = deployment.asset.split(":");
const DEMOUSD = new Asset(CODE, ISSUER);
const UNIT = 10_000_000n;
const GRANT = 1000n * UNIT;
const CASE_AMOUNT = 400n * UNIT;
/** SHA-256 of scripts/demo-files/issuer-fraud-report.txt, a public demo file. */
const DEMO_FILE = "4d21f27c6f316b5e400a22ed5374a50a1347d5b891a3bc1754d82a59fdf0a7f1";
const DEMO_STATEMENT = "Demo case: a card payment that funded this account was reported stolen.";

export type AccountState = {
  address: string;
  exists: boolean;
  xlm: string | null;
  hasTrustline: boolean;
  balance: string | null;
  frozen: boolean;
};

function checkAddress(address: string) {
  if (!StrKey.isValidEd25519PublicKey(address)) throw new ReadError("That isn't a Stellar account address (G…).");
}

export async function accountState(address: string): Promise<AccountState> {
  checkAddress(address);
  try {
    const a = await horizon<{ balances: { asset_type: string; asset_code?: string; asset_issuer?: string; balance: string; is_authorized?: boolean }[] }>(
      "testnet",
      `/accounts/${address}`,
      0,
    );
    const native = a.balances.find((b) => b.asset_type === "native");
    const line = a.balances.find((b) => b.asset_code === CODE && b.asset_issuer === ISSUER);
    return {
      address,
      exists: true,
      xlm: native?.balance ?? null,
      hasTrustline: Boolean(line),
      balance: line?.balance ?? null,
      frozen: line ? line.is_authorized === false : false,
    };
  } catch (e) {
    if (e instanceof ReadError && /no record/.test(e.message)) {
      return { address, exists: false, xlm: null, hasTrustline: false, balance: null, frozen: false };
    }
    throw e;
  }
}

/** An unsigned transaction that adds DEMOUSD to the visitor's account, for their wallet to sign. */
export async function trustlineTx(address: string): Promise<string> {
  checkAddress(address);
  const tx = new TransactionBuilder(await server.getAccount(address), { fee: "1000", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: DEMOUSD }))
    .setTimeout(300)
    .build();
  return tx.toXDR();
}

/**
 * Submits a wallet-signed trustline transaction. Only that exact shape is
 * accepted: one change_trust to DEMOUSD from the signer's own account. The
 * server is not a general relay.
 */
export async function submitTrustline(signedXdr: string): Promise<{ hash: string }> {
  let tx: Transaction;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE) as Transaction;
  } catch {
    throw new ReadError("That isn't a Stellar transaction.");
  }
  const op = tx.operations[0];
  const ok =
    tx.operations.length === 1 &&
    op.type === "changeTrust" &&
    "line" in op &&
    op.line instanceof Asset &&
    op.line.equals(DEMOUSD) &&
    (op.source === undefined || op.source === tx.source);
  if (!ok) throw new ReadError("Only a DEMOUSD trustline can be sent through this page.");
  return { hash: (await send(tx)).hash };
}

/** Gives the visitor 1,000 DEMOUSD if they have less, then opens a demo case against them. */
export async function startDemoCase(address: string): Promise<{ caseId: number; mintTx: string | null; openTx: string }> {
  const state = await accountState(address);
  if (!state.hasTrustline) throw new ReadError("Add DEMOUSD to your account first.");
  if (state.frozen) throw new ReadError("This account is already frozen by a case. Answer or settle that one first.");
  const issuer = envKey("HABEAS_ISSUER_SECRET");
  const holder = new Address(address).toScVal();

  let mintTx: string | null = null;
  const have = BigInt(Math.round(Number(state.balance ?? "0") * 1e7));
  if (have < GRANT) {
    mintTx = (await invokeAs(issuer, deployment.habeas, "mint", [holder, nativeToScVal(GRANT - have, { type: "i128" })])).hash;
  }
  try {
    const opened = await invokeAs(issuer, deployment.habeas, "open_case", [
      holder,
      nativeToScVal(CASE_AMOUNT, { type: "i128" }),
      xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Fraud")]),
      nativeToScVal(DEMO_STATEMENT, { type: "string" }),
      xdr.ScVal.scvBytes(Buffer.from(DEMO_FILE, "hex")),
    ]);
    return { caseId: Number(opened.value), mintTx, openTx: opened.hash };
  } catch (e) {
    if (e instanceof SimulationError && e.raw.includes("Error(Contract, #3)")) {
      throw new ReadError("This account already has an open case. Answer or settle it first.");
    }
    throw e;
  }
}

/** What the demo reviewer writes. Its decision is public, like everyone's. */
const REVIEW_STATEMENT = "Demo reviewer: the holder answered and the issuer's file doesn't prove the claim. The claim is rejected.";

/**
 * The demo reviewer decides an answered demo case. In Try it live the
 * reviewer sides with the holder, so visitors see the full process end with
 * their tokens unfrozen; the "no answer" ending shows the other outcome.
 */
export async function reviewDemoCase(caseId: number): Promise<{ hash: string }> {
  if (!Number.isInteger(caseId) || caseId < 1) throw new ReadError("That isn't a case number.");
  const reviewer = envKey("HABEAS_REVIEWER_SECRET");
  try {
    const r = await invokeAs(reviewer, deployment.habeas, "decide", [
      nativeToScVal(BigInt(caseId), { type: "u64" }),
      nativeToScVal(false),
      nativeToScVal(REVIEW_STATEMENT, { type: "string" }),
      xdr.ScVal.scvVoid(),
    ]);
    return { hash: r.hash };
  } catch (e) {
    if (e instanceof SimulationError) {
      if (e.raw.includes("Error(Contract, #9)")) throw new ReadError("The holder hasn't answered yet, so there's nothing to decide.");
      if (e.raw.includes("Error(Contract, #11)")) throw new ReadError("The reviewer already decided this case.");
      if (e.raw.includes("Error(Contract, #7)")) throw new ReadError("The review window has closed. The holder wins by default; settle the case.");
      if (e.raw.includes("Error(Contract, #2)")) throw new ReadError("This case is already closed.");
    }
    throw e;
  }
}

/**
 * Gives a new testnet account its XLM: Friendbot first, and if Friendbot is
 * slow or rate-limited, the relayer creates the account with a little XLM.
 */
export async function fundAccount(address: string): Promise<{ funded: boolean; by: "exists" | "friendbot" | "relayer" }> {
  checkAddress(address);
  if ((await accountState(address)).exists) return { funded: true, by: "exists" };
  try {
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) return { funded: true, by: "friendbot" };
  } catch {
    // fall through to the relayer
  }
  const relayer = envKey("RELAYER_SECRET");
  const tx = new TransactionBuilder(await server.getAccount(relayer.publicKey()), { fee: "1000", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.createAccount({ destination: address, startingBalance: "5" }))
    .setTimeout(60)
    .build();
  tx.sign(relayer);
  await send(tx);
  return { funded: true, by: "relayer" };
}
