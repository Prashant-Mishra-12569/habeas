// Reads Habeas contract events from Stellar RPC and turns them into plain
// objects. Every event's topics are [name, case id, holder].
import { rpc, scValToNative } from "@stellar/stellar-sdk";

type Base = { id: string; ledger: number; tx: string; at: string; caseId: number; holder: string };

export type CaseEvent =
  | (Base & { kind: "case_opened"; amount: bigint; reason: string; answerBy: number })
  | (Base & { kind: "case_appealed"; reviewBy: number })
  | (Base & { kind: "case_decided"; upheld: boolean })
  | (Base & { kind: "case_settled"; outcome: string; endedBy: string; taken: bigint })
  | (Base & { kind: "case_withdrawn" })
  | (Base & { kind: "emergency_take_back"; taken: bigint });

/** Enums come back from the contract as ["Name"]. */
const variant = (v: unknown) => (Array.isArray(v) ? String(v[0]) : String(v));

export function decodeEvent(e: rpc.Api.EventResponse): CaseEvent | null {
  const [name, id, holder] = e.topic.map((t) => scValToNative(t));
  if (typeof name !== "string" || id === undefined || typeof holder !== "string") return null;
  const data = (scValToNative(e.value) ?? {}) as Record<string, unknown>;
  const base: Base = { id: e.id, ledger: e.ledger, tx: e.txHash, at: e.ledgerClosedAt, caseId: Number(id), holder };
  switch (name) {
    case "case_opened":
      return { ...base, kind: name, amount: BigInt(data.amount as bigint), reason: variant(data.reason), answerBy: Number(data.answer_by) };
    case "case_appealed":
      return { ...base, kind: name, reviewBy: Number(data.review_by) };
    case "case_decided":
      return { ...base, kind: name, upheld: Boolean(data.upheld) };
    case "case_settled":
      return { ...base, kind: name, outcome: variant(data.outcome), endedBy: variant(data.ended_by), taken: BigInt(data.taken as bigint) };
    case "case_withdrawn":
      return { ...base, kind: name };
    case "emergency_take_back":
      return { ...base, kind: name, taken: BigInt(data.taken as bigint) };
    default:
      return null;
  }
}

/** The ledger a getEvents cursor points at (cursors are TOIDs: ledger << 32 | ...). */
export const cursorLedger = (cursor: string) => Number(BigInt(cursor.split("-")[0]) >> 32n);

/**
 * Case events after `from`, oldest first, and the cursor to continue from.
 * RPC scans a bounded window per request, so this keeps asking until it
 * reaches the latest ledger. With no cursor it starts at `startLedger`.
 */
export async function eventsSince(
  server: rpc.Server,
  contractId: string,
  from: { cursor: string } | { startLedger: number },
): Promise<{ events: CaseEvent[]; cursor: string }> {
  const filters = [{ type: "contract" as const, contractIds: [contractId] }];
  const events: CaseEvent[] = [];
  let page = await server.getEvents("cursor" in from ? { cursor: from.cursor, filters, limit: 100 } : { startLedger: from.startLedger, filters, limit: 100 });
  for (let i = 0; ; i++) {
    for (const e of page.events) {
      const ev = decodeEvent(e);
      if (ev) events.push(ev);
    }
    const caughtUp = page.events.length < 100 && cursorLedger(page.cursor) >= page.latestLedger - 1;
    if (caughtUp || i >= 50) return { events, cursor: page.cursor };
    page = await server.getEvents({ cursor: page.cursor, filters, limit: 100 });
  }
}
