// Sorts the scripted testnet run (config/testnet-run.json) into what the
// evidence board shows: the transaction for each stage of each case, the
// setup, and the transfers that were meant to fail on-chain. The run's step
// labels come from scripts/run-demo-cases.mjs; evidence.test.ts checks every
// step lands somewhere.

type Step = { label: string; hash: string };
type Run = { steps: Step[]; cases: Record<string, unknown> };

export type Sorted = {
  /** Per case key (A..E, emergency): [frozen, answered, decided, closed] hashes. */
  stages: Record<string, (string | null)[]>;
  setup: Step[];
  onChainRefusals: Step[];
};

export function evidenceSteps(run: Run): Sorted {
  const stages: Record<string, (string | null)[]> = {};
  for (const key of Object.keys(run.cases)) stages[key] = [null, null, null, null];
  const setup: Step[] = [];
  const onChainRefusals: Step[] = [];

  for (const s of run.steps) {
    if (/^Emergency/i.test(s.label)) {
      stages.emergency[3] = s.hash;
      continue;
    }
    if (/tries to send/i.test(s.label)) {
      onChainRefusals.push(s);
      continue;
    }
    const m = /^Case ([A-E])\b/.exec(s.label);
    if (!m) {
      setup.push(s);
      continue;
    }
    const at = /opened/i.test(s.label)
      ? 0
      : /answers/i.test(s.label)
        ? 1
        : /reviewer (rejects|upholds)/i.test(s.label)
          ? 2
          : /settled|withdrawn/i.test(s.label)
            ? 3
            : -1;
    if (at < 0) setup.push(s);
    else stages[m[1]][at] = s.hash;
  }
  return { stages, setup, onChainRefusals };
}
