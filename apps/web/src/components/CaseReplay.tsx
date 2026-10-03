"use client";

import { useState } from "react";
import type { Case, Status } from "@/lib/types";
import { caseRows } from "@/lib/case-rows";
import { ENDED_BY_LINE, STATUS_SHORT, formatUtcTime } from "@/lib/format";
import { Button } from "./Button";
import { CaseForm } from "./CaseForm";

/** Steps through a real, closed case using its own on-chain timestamps. */
export function CaseReplay({
  c,
  steps,
  asset,
  network,
}: {
  c: Case;
  steps: { status: Status; at: number }[];
  asset: string;
  network: string;
}) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-start">
      <CaseForm
        title={<span className="font-mono">Case {c.id}</span>}
        subtitle={`${asset} on ${network}`}
        rows={caseRows(c, asset, step.status)}
        status={step.status}
        outcomeLine={last ? ENDED_BY_LINE[c.endedBy] : null}
      />
      <div>
        <ol className="space-y-1 text-sm">
          {steps.map((s, n) => (
            <li key={s.status}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-current={n === i ? "step" : undefined}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[3px] px-3 text-left ${n === i ? "bg-canary font-semibold" : "hover:bg-[color-mix(in_oklab,var(--canary)_50%,transparent)]"}`}
              >
                <span>{n + 1}. {STATUS_SHORT[s.status]}</span>
                <span className="font-mono text-xs text-muted">{formatUtcTime(s.at)}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
            Back
          </Button>
          <Button disabled={last} onClick={() => setI(i + 1)}>
            Next step
          </Button>
        </div>
      </div>
    </div>
  );
}
