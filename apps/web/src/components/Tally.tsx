"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { useLang, useT } from "@/i18n/client";
import { formatCount, formatDay, formatTokens } from "@/lib/format";
import { PenCircle } from "./PenCircle";

export type TallyData = {
  code: string;
  href: string;
  takeBacks: number;
  /** Total taken back, as a decimal string. */
  total: string;
  first: string | null;
  last: string | null;
  /** Take-back transactions that carried a memo, the only on-chain place for a reason. */
  reasons: number;
  scanned: number;
  complete: boolean;
};

const EASE = [0.22, 1, 0.36, 1] as const;

/** One group of five: four strokes and the one across. */
function Group({ marks, index }: { marks: number; index: number }) {
  const reduce = useReduceMotion();
  // Small irregularities so it looks written, not printed. Fixed per position.
  const jitter = [0.6, -0.8, 0.4, -0.3, 0.9, -0.5][index % 6];
  const strokes = [
    "M6 4 L5 40",
    "M14 3 L14.5 41",
    "M22 5 L21 40",
    "M30 4 L30.5 39",
    "M1 30 L36 12",
  ].slice(0, marks);
  return (
    <svg viewBox="0 0 38 44" width="44" height="51" aria-hidden className="overflow-visible" style={{ rotate: `${jitter}deg` }}>
      {strokes.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke="var(--pen)"
          strokeWidth={2.4}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={reduce ? { duration: 0 } : { duration: 0.22, delay: (index * 5 + i) * 0.045, ease: EASE }}
        />
      ))}
    </svg>
  );
}

/**
 * The public record of one issuer's take backs, kept the way an auditor
 * would: a tally mark per take back, then the columns the record leaves
 * empty. Every number comes from the issuer's history on Stellar.
 */
export function Tally({ d }: { d: TallyData }) {
  const t = useT();
  const lang = useLang();
  const groups = Array.from({ length: Math.ceil(d.takeBacks / 5) }, (_, i) => Math.min(5, d.takeBacks - i * 5));
  const count = `${formatCount(d.takeBacks, lang)}${d.complete ? "" : "+"}`;

  return (
    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <div>
        <p className="font-mono text-sm text-muted">{d.code}</p>
        <p className="mt-1 text-[clamp(3.5rem,14vw,6.5rem)] leading-none font-extrabold tracking-[-0.04em] tabular">{count}</p>
        <p className="mt-3 max-w-[40ch] text-lg">{t.tally.headline(formatTokens(d.total, lang), d.code)}</p>
        <p className="mt-4 max-w-[46ch] text-muted">{t.tally.lead}</p>
      </div>

      <figure className="relative rounded-[2px] border border-rule bg-sheet">
        <div className="perforation mx-4 mt-3" aria-hidden />
        <figcaption className="px-4 pt-3 pb-3 sm:px-5">
          <p className="heading-sm text-lg font-bold">{t.tally.sheetTitle}</p>
          <p className="text-sm text-muted">{t.tally.sheetSub}</p>
        </figcaption>
        <div className="mx-4 border-t-2 border-ink sm:mx-5" />
        <dl>
          <div className="border-b border-rule px-4 py-4 sm:px-5">
            <dt className="text-xs text-muted">{t.tally.rowTaken}</dt>
            <dd className="mt-3">
              <span className="sr-only">{count}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-4">
                {groups.map((m, i) => (
                  <Group key={i} marks={m} index={i} />
                ))}
              </span>
            </dd>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-rule px-4 py-4 sm:px-5">
            <dt className="text-sm">{t.tally.rowReasons}</dt>
            <dd className="text-right">
              {d.reasons === 0 ? (
                <PenCircle delay={0.2}>
                  <span className="hand text-2xl">{t.tally.none}</span>
                </PenCircle>
              ) : (
                <span className="font-mono text-pen tabular">{formatCount(d.reasons, lang)}</span>
              )}
            </dd>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 sm:px-5">
            <dt className="text-sm">{t.tally.rowAsked}</dt>
            <dd className="text-right">
              <PenCircle delay={0.4}>
                <span className="hand text-2xl">{t.tally.none}</span>
              </PenCircle>
            </dd>
          </div>
        </dl>
        <p className="border-t border-rule px-4 py-3 text-xs text-muted sm:px-5">
          {d.first && d.last ? `${t.tally.span(formatDay(d.first, lang), formatDay(d.last, lang))} ` : ""}
          {t.tally.scanned(formatCount(d.scanned, lang))}{" "}
          <Link href={d.href} className="text-pen underline decoration-1">
            {t.tally.seeAll}
          </Link>
        </p>
      </figure>
    </div>
  );
}
