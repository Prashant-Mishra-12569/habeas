import "server-only";
import { nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";
import { deployment } from "./habeas";
import { NETWORKS } from "./network";
import type { Case } from "./types";

/**
 * Every step of a case with the transaction that made it, read from the
 * Habeas contract's events.
 *
 * The case record says when each step happened, so instead of scanning days
 * of ledgers we estimate the ledger for each step from its timestamp, correct
 * the estimate once against a real ledger's close time, and read a small
 * window. Stellar RPC keeps events for about 7 days; older steps come back
 * without a transaction link and the page says why.
 */

import type { StepKind, Timeline, TimelineStep } from "./timeline-types";

export type { StepKind, Timeline, TimelineStep };

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

export async function caseTimelineWithTx(c: Case): Promise<Timeline> {
  const server = new rpc.Server(NETWORKS.testnet.rpc[0]);
  // getLedgers also reports the window the RPC keeps, with close times.
  const { sequence } = await server.getLatestLedger();
  const window = await server.getLedgers({ startLedger: sequence, pagination: { limit: 1 } });
  const health = { oldestLedger: window.oldestLedger, latestLedger: window.latestLedger };
  const oldestKept = Number(window.oldestLedgerCloseTime);
  const latest = window.latestLedger;
  const latestTime = Number(window.latestLedgerCloseTime);
  const secsPerLedger = (latestTime - oldestKept) / Math.max(1, latest - health.oldestLedger);
  const idTopic = nativeToScVal(BigInt(c.id), { type: "u64" }).toXDR("base64");

  async function ledgerFor(ts: number): Promise<number> {
    let guess = Math.round(latest - (latestTime - ts) / secsPerLedger);
    guess = Math.min(latest, Math.max(health.oldestLedger + 1, guess));
    const page = await server.getLedgers({ startLedger: guess, pagination: { limit: 1 } });
    const at = Number(page.ledgers[0]?.ledgerCloseTime ?? ts);
    return Math.min(latest, Math.max(health.oldestLedger + 1, guess + Math.round((ts - at) / secsPerLedger)));
  }

  async function txFor(kind: StepKind, ts: number): Promise<string | null> {
    if (ts < oldestKept) return null;
    const filters = [{ type: "contract" as const, contractIds: [deployment.habeas], topics: [["*", idTopic, "*"]] }];
    let page = await server.getEvents({ startLedger: Math.max(health.oldestLedger + 1, (await ledgerFor(ts)) - 12), filters, limit: 10 });
    for (let tries = 0; tries < 4; tries++) {
      const hit = page.events.find((e) => scValToNative(e.topic[0]) === EVENT_FOR[kind]);
      if (hit) return hit.txHash;
      if (!page.cursor) break;
      page = await server.getEvents({ cursor: page.cursor, filters, limit: 10 });
    }
    return null;
  }

  const steps = await Promise.all(caseSteps(c).map(async (s) => ({ ...s, tx: await txFor(s.kind, s.at).catch(() => null) })));
  return { steps, oldestKept };
}
