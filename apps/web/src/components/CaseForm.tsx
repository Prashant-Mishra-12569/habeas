"use client";

import { motion } from "motion/react";
import { instant, useReduceMotion } from "@/lib/use-reduce-motion";
import { useNarrow } from "@/lib/use-narrow";
import type { ReactNode } from "react";
import type { Status } from "@/lib/types";
import { useT } from "@/i18n/client";
import { TickBox } from "./TickBox";

export type FormRow = {
  label: string;
  /** A filled-in value, written in ballpoint. */
  value?: ReactNode;
  /** Addresses, amounts, hashes and case numbers use the mono face. */
  mono?: boolean;
  /** Not filled in yet at this point of the case. */
  pending?: string;
  wide?: boolean;
};

/** Which of the four stages a case has been through. */
export type Stages = { frozen: boolean; answered: boolean; decided: boolean; closed: boolean };

const EASE = [0.22, 1, 0.36, 1] as const;

export function CaseForm({
  title,
  subtitle,
  rows,
  status,
  stages,
  statusNote,
  outcomeLine,
  fan = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: FormRow[];
  status?: Status;
  stages?: Stages;
  /** Replaces the status block, e.g. for the mainnet example. */
  statusNote?: ReactNode;
  outcomeLine?: string | null;
  /** Fan the copies out like a fresh form set (the hero). */
  fan?: boolean;
}) {
  const t = useT();
  const reduce = useReduceMotion();
  const narrow = useNarrow();
  // The copies slide out from under the form again whenever the status changes.
  // Fanned (hero): they swing out from the bottom-left corner like a fresh set.
  const slide = (step: 1 | 2, delay: number) => {
    const to = fan ? { x: step * (narrow ? 6 : 12), y: step * (narrow ? 5 : 6), rotate: step * (narrow ? 0.9 : 1.8) } : { x: step * 7, y: step * 7, rotate: 0 };
    return reduce
      ? { initial: false as const, animate: to, transition: instant }
      : {
          initial: { x: 0, y: 0, rotate: 0 },
          animate: to,
          transition: { duration: fan ? 0.9 : 0.45, delay: fan ? 0.15 + delay * 2 : delay, ease: EASE },
        };
  };
  const closed = status === "Cleared" || status === "TakenBack";

  return (
    <div className={`relative ${fan ? "mr-5 mb-6 sm:mr-8 sm:mb-8" : "mr-4 mb-4"}`}>
      <motion.div
        key={`pink-${status}-${reduce}`}
        aria-hidden
        className="absolute inset-0 origin-bottom-left rounded-[2px] bg-pink shadow-[0_1px_0_rgb(0_0_0/0.04)]"
        {...slide(2, 0.08)}
      />
      <motion.div
        key={`canary-${status}-${reduce}`}
        aria-hidden
        className="absolute inset-0 origin-bottom-left rounded-[2px] bg-canary shadow-[0_1px_0_rgb(0_0_0/0.04)]"
        {...slide(1, 0)}
      />

      <section className="@container relative rounded-[2px] border border-rule bg-sheet shadow-[0_1px_2px_rgb(31_34_41/0.06),0_12px_32px_-12px_rgb(31_34_41/0.18)] carbon:shadow-[0_16px_40px_-16px_rgb(0_0_0/0.7)]">
        <div className="perforation mx-4 mt-3" aria-hidden />
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-3 @sm:px-5">
          <h2 className="heading-sm text-lg">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </header>
        <div className="mx-4 border-t-2 border-ink @sm:mx-5" />

        <dl className="grid grid-cols-1 @lg:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className={`border-b border-rule px-4 py-3 @sm:px-5 ${row.wide ? "@lg:col-span-2" : ""}`}>
              <dt className="text-xs text-muted">{row.label}</dt>
              <dd className="mt-1 min-h-6">
                {row.pending ? (
                  <span className="text-sm text-muted">{row.pending}</span>
                ) : (
                  <span className={`break-words text-pen ${row.mono ? "font-mono text-[0.94em] tabular" : ""}`}>{row.value}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {(status || statusNote) && (
          <footer className="px-4 py-4 @sm:px-5" aria-live="polite">
            <p className="text-xs text-muted">{t.words.status_}</p>
            {status && stages ? (
              <div className="mt-2">
                <div className="grid max-w-xs grid-cols-2 gap-x-5 gap-y-2 text-sm @lg:flex @lg:max-w-none @lg:flex-wrap">
                  <TickBox checked={stages.frozen} label={t.words.stages[0]} />
                  <TickBox checked={stages.answered} label={t.words.stages[1]} delay={0.05} />
                  <TickBox checked={stages.decided} label={t.words.stages[2]} delay={0.1} />
                  <TickBox
                    checked={stages.closed}
                    label={t.words.stages[3]}
                    tone={status === "Cleared" ? "cleared" : status === "TakenBack" ? "taken" : "pen"}
                    delay={0.15}
                  />
                </div>
                <motion.div
                  key={`${status}-${reduce}`}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduce ? instant : { duration: 0.3, ease: EASE }}
                  className="mt-3"
                >
                  {closed && (
                    <p className={`text-xl font-extrabold tracking-tight ${status === "Cleared" ? "text-cleared" : "text-taken"}`}>
                      {t.words.status[status]}
                    </p>
                  )}
                  <p className="text-sm">{t.words.statusLine[status]}</p>
                  {outcomeLine && <p className="text-sm text-muted">{outcomeLine}</p>}
                </motion.div>
              </div>
            ) : (
              <div className="mt-1">{statusNote}</div>
            )}
          </footer>
        )}
      </section>
    </div>
  );
}
