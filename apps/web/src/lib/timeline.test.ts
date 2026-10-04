// Case timelines read from real testnet events. Expected hashes come from the
// recorded runs in deployments/. Stellar RPC keeps events for about 7 days, so
// a step older than that must come back with no transaction, not a wrong one.
import { describe, expect, it } from "vitest";
import run from "@/config/testnet-run.json";
import wallet from "@/config/testnet-freighter.json";
import { getCase } from "./habeas";
import { caseSteps, caseTimelineWithTx } from "./timeline";

const hashOf = (steps: { label: string; hash: string }[], start: string) => steps.find((s) => s.label.startsWith(start))!.hash;

describe("caseSteps", () => {
  it("lists the steps a closed, answered and decided case went through", async () => {
    const c = await getCase(run.cases.A.id);
    expect(caseSteps(c).map((s) => s.kind)).toEqual(["opened", "answered", "decided", "settled"]);
  });

  it("treats a holder who never answered as opened then settled", async () => {
    const c = await getCase(run.cases.B.id);
    expect(caseSteps(c).map((s) => s.kind)).toEqual(["opened", "settled"]);
  });

  it("shows an emergency on a holder without a case as one step", async () => {
    const c = await getCase(run.cases.emergency.id);
    expect(caseSteps(c).map((s) => s.kind)).toEqual(["emergency"]);
  });
});

describe("caseTimelineWithTx", () => {
  it("finds the transaction for every step of case A (answered, rejected, cleared)", async () => {
    const c = await getCase(run.cases.A.id);
    const { steps, oldestKept } = await caseTimelineWithTx(c);
    const expected = [
      hashOf(run.steps, "Case A opened"),
      hashOf(run.steps, "Case A: holder A answers"),
      hashOf(run.steps, "Case A: reviewer rejects"),
      hashOf(run.steps, "Case A settled"),
    ];
    steps.forEach((s, i) => expect(s.tx).toBe(s.at >= oldestKept ? expected[i] : null));
  });

  it("finds the Freighter answer on case 8", async () => {
    const c = await getCase(wallet.case_id);
    const { steps, oldestKept } = await caseTimelineWithTx(c);
    const opened = steps.find((s) => s.kind === "opened")!;
    const answered = steps.find((s) => s.kind === "answered")!;
    expect(opened.tx).toBe(opened.at >= oldestKept ? wallet.steps[2].hash : null);
    expect(answered.tx).toBe(answered.at >= oldestKept ? wallet.steps[3].hash : null);
  });
});
