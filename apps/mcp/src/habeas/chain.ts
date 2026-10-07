// Read-only calls to the Habeas contract on testnet, through simulation.
// Reads use only patterns the website and the alerts bot already ship on SDK 17.
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { ErrorCode, McpToolError } from "../lib/errors.ts";
import { SimulationError, simulateRead } from "../lib/rpc.ts";
import { deployment } from "./deployment.ts";
import { interpretRefusal } from "./errors.ts";
import type { Case, EndedBy, Reason, Status } from "./types.ts";

const NETWORK = "testnet" as const;
const UNIT = 10_000_000n; // 7 decimals

/** Enums come back from the contract as ["Name"]. */
const variant = (v: unknown) => (Array.isArray(v) ? String(v[0]) : String(v));
const hex = (b: unknown) => Buffer.from(b as Uint8Array).toString("hex");

/** Stroops to whole tokens, as a decimal string without trailing zeros. */
export function formatAmount(raw: bigint): string {
  const whole = raw / UNIT;
  const frac = (raw % UNIT).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

async function read(method: string, args: Parameters<typeof simulateRead>[3] = []): Promise<unknown> {
  const d = deployment();
  try {
    return await simulateRead(NETWORK, d.habeas, method, args);
  } catch (e) {
    if (!(e instanceof SimulationError)) throw e;
    const r = interpretRefusal(e.raw, d.habeas, { direct: true });
    if (r.kind === "habeas") {
      const code = r.error.name === "CaseNotFound" ? ErrorCode.NOT_FOUND : ErrorCode.HABEAS_REFUSED;
      throw new McpToolError(r.error.meaning, code, { habeasError: r.error.name, errorNumber: r.error.code, method });
    }
    throw new McpToolError(`The contract refused ${method}: ${r.kind === "unknown" ? r.summary : (r.message ?? `error #${r.code}`)}`, ErrorCode.CONTRACT_INVOCATION_FAILED, { method });
  }
}

const u64 = (n: number) => nativeToScVal(BigInt(n), { type: "u64" });

export async function getCase(id: number): Promise<Case> {
  const c = (await read("get_case", [u64(id)])) as Record<string, unknown>;
  return {
    id: Number(c.id),
    holder: String(c.holder),
    amount: formatAmount(c.amount as bigint),
    reason: variant(c.reason) as Reason,
    statement: String(c.statement ?? ""),
    issuerFile: hex(c.issuer_file),
    status: variant(c.status) as Status,
    openedAt: Number(c.opened_at),
    answerBy: Number(c.answer_by),
    answeredAt: Number(c.answered_at ?? 0),
    holderStatement: String(c.holder_statement ?? ""),
    holderFile: c.holder_file ? hex(c.holder_file) : null,
    reviewBy: Number(c.review_by ?? 0),
    decidedAt: Number(c.decided_at ?? 0),
    reviewerStatement: String(c.reviewer_statement ?? ""),
    reviewerFile: c.reviewer_file ? hex(c.reviewer_file) : null,
    closedAt: Number(c.closed_at ?? 0),
    endedBy: variant(c.ended_by) as EndedBy,
    taken: formatAmount((c.taken ?? 0n) as bigint),
  };
}

/** The holder's open case, if any. */
export async function activeCaseFor(holder: string): Promise<number | null> {
  const id = await read("active_case", [new Address(holder).toScVal()]);
  return id === undefined || id === null ? null : Number(id);
}

/** Case ids opened against a holder, oldest first. */
export async function holderCaseIds(holder: string): Promise<number[]> {
  const ids = (await read("cases_for", [new Address(holder).toScVal()])) as bigint[];
  return ids.map(Number);
}

export async function getConfig(): Promise<{ issuer: string; reviewer: string; answerWindow: number; reviewWindow: number }> {
  const c = (await read("get_config")) as { issuer: string; reviewer: string; answer_window: bigint; review_window: bigint };
  return { issuer: c.issuer, reviewer: c.reviewer, answerWindow: Number(c.answer_window), reviewWindow: Number(c.review_window) };
}

export async function caseCount(): Promise<number> {
  return Number(await read("case_count"));
}
