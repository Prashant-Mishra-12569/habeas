"use client";

import { useState } from "react";
import type { Case, Status } from "@/lib/types";
import { caseRows, caseStages } from "@/lib/case-rows";
import { formatUtcTime } from "@/lib/format";
import { useLang, useT } from "@/i18n/client";
import { Button } from "./Button";
import { CaseForm } from "./CaseForm";

/** Steps through a real, closed case using its own on-chain timestamps. */
export function CaseReplay({ c, steps, asset }: { c: Case; steps: { status: Status; at: number }[]; asset: string }) {
  const t = useT();
  const lang = useLang();
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_15rem] lg:items-start">
      <CaseForm
        title={<span className="font-mono">{t.form.case} {c.id}</span>}
        subtitle={`${asset} ${t.form.on} testnet`}
        rows={caseRows(c, asset, t, lang, step.status)}
        status={step.status}
        stages={caseStages(c, step.status)}
        outcomeLine={last ? t.words.endedBy[c.endedBy] : null}
      />
      <div>
        <ol className="space-y-1 text-sm">
          {steps.map((s, n) => (
            <li key={s.status}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-current={n === i ? "step" : undefined}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[2px] px-3 text-left ${n === i ? "bg-canary font-semibold" : "hover:bg-[color-mix(in_oklab,var(--canary)_45%,transparent)]"}`}
              >
                <span>
                  {n + 1}. {t.words.status[s.status]}
                </span>
                <span className="font-mono text-xs text-muted tabular">{formatUtcTime(s.at)}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
            {t.form.back}
          </Button>
          <Button disabled={last} onClick={() => setI(i + 1)}>
            {t.form.nextStep}
          </Button>
        </div>
      </div>
    </div>
  );
}
