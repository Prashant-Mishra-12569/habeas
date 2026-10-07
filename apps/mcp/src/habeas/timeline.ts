// Every step of a case with the transaction that made it, read from the Habeas
// contract's events. Same approach as apps/web/src/lib/timeline.ts: estimate
// the ledger for each step from its timestamp, then read a small window.
// Stellar RPC keeps events for about 7 days; older steps come back without a
// transaction.
import { nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";
import { withRpc } from "../lib/rpc.ts";
import { deployment } from "./deployment.ts";
import type { Case } from "./types.ts";

export type StepKind = "opened" | "answered" | "decided" | "settled" | "withdrawn" | "emergency";
export type TimelineStep = { kind: StepKind; at: number; atIso: string; tx: string | null };

const EVENT_FOR: Record<StepKind, string> = {
  opened: "case_opened",
  answered: "case_appealed",
  decided: "case_decided",
  settled: "case_settled",
  withdrawn: "case_withdrawn",
  emergency: "emergency_take_back",
};

/** The steps a case went through, from its own record. */
export function caseSteps(c: Case): { kind: StepKind; at: number }[] {
  // An emergency take back on a holder without a case opens and closes at once.
  if (c.endedBy === "Emergency" && c.answeredAt === 0 && c.openedAt === c.closedAt) {
    return [{ kind: "emergency", at: c.closedAt }];
  }
  const steps: { kind: StepKind; at: number }[] = [{ kind: "opened", at: c.openedAt }];
  if (c.answeredAt) steps.push({ kind: "answered", at: c.answeredAt });
  if (c.decidedAt && (c.endedBy === "ReviewerUpheld" || c.endedBy === "ReviewerRejected" || c.status === "Upheld" || c.status === "Rejected")) {
    steps.push({ kind: "decided", at: c.decidedAt });
  }
  if (c.closedAt) {
    const kind: StepKind = c.endedBy === "Withdrawn" ? "withdrawn" : c.endedBy === "Emergency" ? "emergency" : "settled";
    steps.push({ kind, at: c.closedAt });
  }
  return steps;
}

export async function caseTimeline(c: Case): Promise<{ steps: TimelineStep[]; eventsKeptSince: string | null; note: string }> {
  const base = caseSteps(c);
  try {
    const { steps, oldestKept } = await withRpc("testnet", async (server) => {
      const { sequence } = await server.getLatestLedger();
      // getLedgers also reports the window the RPC keeps, with close times.
      const window = await server.getLedgers({ startLedger: sequence, pagination: { limit: 1 } });
      const oldestLedger = window.oldestLedger;
      const oldestKept = Number(window.oldestLedgerCloseTime);
      const latest = window.latestLedger;
      const latestTime = Number(window.latestLedgerCloseTime);
      const secsPerLedger = (latestTime - oldestKept) / Math.max(1, latest - oldestLedger);
      const idTopic = nativeToScVal(BigInt(c.id), { type: "u64" }).toXDR("base64");

      async function ledgerFor(ts: number): Promise<number> {
        let guess = Math.round(latest - (latestTime - ts) / secsPerLedger);
        guess = Math.min(latest, Math.max(oldestLedger + 1, guess));
        const page = await server.getLedgers({ startLedger: guess, pagination: { limit: 1 } });
        const at = Number(page.ledgers[0]?.ledgerCloseTime ?? ts);
        return Math.min(latest, Math.max(oldestLedger + 1, guess + Math.round((ts - at) / secsPerLedger)));
      }

      async function txFor(kind: StepKind, ts: number): Promise<string | null> {
        if (ts < oldestKept) return null;
        const filters = [{ type: "contract" as const, contractIds: [deployment().habeas], topics: [["*", idTopic, "*"]] }];
        let page = await server.getEvents({ startLedger: Math.max(oldestLedger + 1, (await ledgerFor(ts)) - 12), filters, limit: 10 });
        for (let tries = 0; tries < 4; tries++) {
          const hit = page.events.find((e) => scValToNative(e.topic[0]!) === EVENT_FOR[kind]);
          if (hit) return hit.txHash;
          if (!page.cursor) break;
          page = await server.getEvents({ cursor: page.cursor, filters, limit: 10 });
        }
        return null;
      }

      const steps = await Promise.all(base.map(async (s) => ({ ...s, tx: await txFor(s.kind, s.at).catch(() => null) })));
      return { steps, oldestKept };
    });
    return {
      steps: steps.map((s) => ({ ...s, atIso: new Date(s.at * 1000).toISOString() })),
      eventsKeptSince: new Date(oldestKept * 1000).toISOString(),
      note: "Steps older than eventsKeptSince have no transaction hash because Stellar RPC only keeps about 7 days of events. The times come from the case record itself.",
    };
  } catch {
    // The record alone is still the truth; the transaction links are a bonus.
    return {
      steps: base.map((s) => ({ ...s, atIso: new Date(s.at * 1000).toISOString(), tx: null })),
      eventsKeptSince: null,
      note: "Couldn't look up transactions right now. The steps and times come from the case record itself.",
    };
  }
}
