"use client";

import type { Timeline } from "@/lib/timeline-types";
import type { Case } from "@/lib/types";
import { formatUtc, shortHash, txUrl } from "@/lib/format";
import { useLang, useT } from "@/i18n/client";

/** Every step of a case, each with the transaction that made it. */
export function CaseTimeline({ c, timeline }: { c: Case; timeline: Timeline }) {
  const t = useT();
  const lang = useLang();
  const missing = timeline.steps.some((s) => !s.tx);
  const label = (kind: Timeline["steps"][number]["kind"]) => {
    if (kind === "settled") return `${t.timeline.settled} ${t.words.status[c.status]}.`;
    return t.timeline[kind];
  };
  return (
    <section aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="text-xl">
        {t.timeline.title}
      </h2>
      <ol className="relative mt-4 space-y-5 pl-7">
        <span aria-hidden className="absolute top-1 bottom-1 left-[7px] w-[2px] bg-rule" />
        {timeline.steps.map((s) => (
          <li key={s.kind} className="relative">
            <span aria-hidden className="absolute -left-7 top-1.5 h-4 w-4 rounded-full border-2 border-pen bg-paper" />
            <p className="font-semibold">{label(s.kind)}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
              <span>{formatUtc(s.at, lang)}</span>
              {s.tx ? (
                <a href={txUrl(s.tx)} target="_blank" rel="noreferrer" className="inline-block font-mono text-pen underline">
                  {shortHash(s.tx, 5)}
                </a>
              ) : (
                <span>{t.timeline.noTx}</span>
              )}
            </p>
          </li>
        ))}
      </ol>
      {missing && <p className="mt-3 text-xs text-muted">{t.timeline.noTxNote}</p>}
    </section>
  );
}
