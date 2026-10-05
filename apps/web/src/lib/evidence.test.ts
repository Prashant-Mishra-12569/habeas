import { describe, expect, it } from "vitest";
import run from "@/config/testnet-run.json";
import { evidenceSteps } from "./evidence";

describe("evidence board", () => {
  it("places every scripted step exactly once", () => {
    const s = evidenceSteps(run);
    const placed = Object.values(s.stages).flat().filter(Boolean).length + s.setup.length + s.onChainRefusals.length;
    expect(placed).toBe(run.steps.length);
  });

  it("gives every ending a closing transaction", () => {
    const s = evidenceSteps(run);
    for (const key of Object.keys(run.cases)) expect(s.stages[key][3]).toMatch(/^[0-9a-f]{64}$/);
  });
});
