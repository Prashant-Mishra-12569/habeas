"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { Status } from "@/lib/types";
import { STATUS_LINE, STATUS_SHORT } from "@/lib/format";

export type FormRow = {
  label: string;
  /** A filled-in value, written in ballpoint blue. */
  value?: ReactNode;
  /** Addresses, amounts, hashes and case numbers use the mono face. */
  mono?: boolean;
  /** Field the issuer left empty. Shown with a quiet "Not provided" mark. */
  missing?: boolean;
  /** Field not filled in yet at this point of the case. */
  pending?: string;
  wide?: boolean;
};

const EASE = [0.22, 1, 0.36, 1] as const;

/** Background tint of the status field. Copies stay pale; only end states use strong colour. */
const STATUS_STYLE: Record<Status, string> = {
  Open: "bg-pink text-ink",
  Answered: "bg-canary text-ink",
  Upheld: "bg-canary text-ink",
  Rejected: "bg-canary text-ink",
  Cleared: "text-cleared",
  TakenBack: "text-taken",
};

export function CaseForm({
  title,
  subtitle,
  rows,
  status,
  statusNote,
  outcomeLine,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: FormRow[];
  status?: Status;
  /** Replaces the standard status line, e.g. for the USBDC example. */
  statusNote?: ReactNode;
  outcomeLine?: string | null;
}) {
  const reduce = useReducedMotion();
  // Copies re-slide from under the form whenever the status changes.
  const slide = (offset: number, delay: number) =>
    reduce
      ? { initial: false as const, animate: { x: offset, y: offset } }
      : {
          initial: { x: 0, y: 0, opacity: 0.6 },
          animate: { x: offset, y: offset, opacity: 1 },
          transition: { duration: 0.45, delay, ease: EASE },
        };

  return (
    <div className="relative mr-4 mb-4">
      {/* The pink and canary copies underneath. Same record, every party. */}
      <motion.div
        key={`pink-${status}`}
        aria-hidden
        className="absolute inset-0 rounded-[3px] bg-pink border border-rule"
        {...slide(14, 0.08)}
      />
      <motion.div
        key={`canary-${status}`}
        aria-hidden
        className="absolute inset-0 rounded-[3px] bg-canary border border-rule"
        {...slide(7, 0)}
      />

      <section className="relative rounded-[3px] border border-rule bg-paper shadow-[0_1px_0_var(--rule)]">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink px-5 pt-4 pb-3">
          <h3 className="text-lg">{title}</h3>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </header>

        <dl className="grid grid-cols-1 sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`border-b border-rule px-5 py-3 ${row.wide ? "sm:col-span-2" : ""}`}
            >
              <dt className="text-xs text-muted">{row.label}</dt>
              <dd className="mt-1 min-h-6">
                {row.missing ? (
                  <span className="inline-block rounded-[2px] bg-pink px-1.5 text-sm text-ink">Not provided</span>
                ) : row.pending ? (
                  <span className="text-sm text-muted">{row.pending}</span>
                ) : (
                  <span className={`text-pen break-words ${row.mono ? "font-mono text-[0.95em]" : ""}`}>
                    {row.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {(status || statusNote) && (
          <footer className="px-5 py-4" aria-live="polite">
            <p className="text-xs text-muted">Status</p>
            {status ? (
              <motion.div
                key={status}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <p className="mt-1">
                  <span className={`inline-block rounded-[2px] px-1.5 text-lg font-bold ${STATUS_STYLE[status]}`}>
                    {STATUS_SHORT[status]}
                  </span>
                </p>
                <p className="mt-1 text-sm">{STATUS_LINE[status]}</p>
                {outcomeLine && <p className="text-sm text-muted">{outcomeLine}</p>}
              </motion.div>
            ) : (
              <div className="mt-1">{statusNote}</div>
            )}
          </footer>
        )}
      </section>
    </div>
  );
}
