import "server-only";
import { nativeToScVal, type xdr } from "@stellar/stellar-sdk";
import { ReadError, SimulationError, simulateRead } from "./network";
import deployment from "@/config/testnet.json";
import type { Case, EndedBy, Reason, Status } from "./types";

export type { Case, EndedBy, Reason, Status };

export { deployment, ReadError };

const STROOPS = 10_000_000n;
export function formatAmount(stroops: bigint): string {
  const whole = stroops / STROOPS;
  const frac = (stroops % STROOPS).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

const hex = (b: Buffer | Uint8Array | undefined | null) => (b ? Buffer.from(b).toString("hex") : null);

/** Read-only call to the testnet Habeas contract. Free, no signature. */
async function read(method: string, args: xdr.ScVal[] = []): Promise<unknown> {
  try {
    return await simulateRead("testnet", deployment.habeas, method, args, deployment.relayer);
  } catch (e) {
    if (e instanceof SimulationError) {
      if (e.raw.includes("Error(Contract, #1)")) throw new ReadError("No case with that number.");
      throw new ReadError(`The contract refused the read: ${e.message}`);
    }
    throw e;
  }
}

type RawCase = Record<string, unknown> & {
  status: [Status];
  reason: [Reason];
  ended_by: [EndedBy];
};

export async function getCase(id: number): Promise<Case> {
  const c = (await read("get_case", [nativeToScVal(BigInt(id), { type: "u64" })])) as RawCase;
  return {
    id: Number(c.id),
    holder: c.holder as string,
    amount: formatAmount(c.amount as bigint),
    reason: c.reason[0],
    statement: c.statement as string,
    issuerFile: hex(c.issuer_file as Buffer)!,
    status: c.status[0],
    openedAt: Number(c.opened_at),
    answerBy: Number(c.answer_by),
    answeredAt: Number(c.answered_at),
    holderStatement: c.holder_statement as string,
    holderFile: hex(c.holder_file as Buffer | undefined),
    reviewBy: Number(c.review_by),
    decidedAt: Number(c.decided_at),
    reviewerStatement: c.reviewer_statement as string,
    reviewerFile: hex(c.reviewer_file as Buffer | undefined),
    closedAt: Number(c.closed_at),
    endedBy: c.ended_by[0],
    taken: formatAmount(c.taken as bigint),
  };
}

export async function caseCount(): Promise<number> {
  return Number(await read("case_count"));
}

/**
 * How a case looked at each step of its life, rebuilt from its own on-chain
 * timestamps. Used to show a real case moving through its states.
 */
export function caseTimeline(c: Case): { status: Status; at: number }[] {
  const steps: { status: Status; at: number }[] = [{ status: "Open", at: c.openedAt }];
  if (c.answeredAt) steps.push({ status: "Answered", at: c.answeredAt });
  if (c.endedBy === "ReviewerUpheld") steps.push({ status: "Upheld", at: c.decidedAt });
  if (c.endedBy === "ReviewerRejected") steps.push({ status: "Rejected", at: c.decidedAt });
  if (c.status === "Cleared" || c.status === "TakenBack") steps.push({ status: c.status, at: c.closedAt });
  return steps;
}
