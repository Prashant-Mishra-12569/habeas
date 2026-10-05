"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { instant, useReduceMotion } from "@/lib/use-reduce-motion";

export type TxLink = { hash: string; url: string } | null;

export type MatrixRow = {
  key: string;
  title: string;
  /** e.g. "Case 3" with a link to its page. */
  caseId?: number;
  outcome: "Cleared" | "TakenBack";
  stages: [TxLink, TxLink, TxLink, TxLink];
};

export type ListRow = { label: string; note?: string; link?: TxLink; value?: string; href?: string; mono?: boolean };

export type Panel = {
  id: string;
  tab: string;
  /** Short figure shown on the tab: a count or a hash. */
  figure: string;
  claim: string;
  lead?: string;
  matrix?: MatrixRow[];
  lists?: { title?: string; rows: ListRow[] }[];
  footer?: { label: string; href: string };
};

const EASE = [0.22, 1, 0.36, 1] as const;

function TxTick({ link, label }: { link: TxLink; label: string }) {
  const t = useT();
  if (!link) {
    return (
      <span className="flex h-11 w-11 items-center justify-center text-muted" title={t.evidence.board.notThisWay}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path d="M5 9h8" stroke="var(--field)" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        <span className="sr-only">
          {label}: {t.evidence.board.notThisWay}
        </span>
      </span>
    );
  }
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      title={`${label} · ${link.hash.slice(0, 8)}…`}
      className="group flex h-11 w-11 items-center justify-center rounded-[2px] hover:bg-[color-mix(in_oklab,var(--pen)_10%,transparent)]"
    >
      <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden className="overflow-visible">
        <rect x="1" y="1" width="16" height="16" rx="1.5" fill="none" stroke="var(--field)" strokeWidth="1.25" />
        <path d="M3.2 9.6 L7.1 13.4 L16.8 1.8" fill="none" stroke="var(--pen)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">
        {label}: {t.evidence.board.openTx} {link.hash.slice(0, 8)}
      </span>
    </a>
  );
}

function Matrix({ rows }: { rows: MatrixRow[] }) {
  const t = useT();
  const b = t.evidence.board;
  const grid = "sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_repeat(4,3.75rem)] sm:items-center sm:gap-x-1";
  return (
    <div>
      {/* Column names on wider screens; phones label every tick instead. */}
      <div className={`hidden border-b-2 border-ink pb-2 text-xs text-muted ${grid}`}>
        <span>{b.ending}</span>
        <span>{b.outcome}</span>
        {t.words.stages.map((s) => (
          <span key={s} className="text-center">
            {s}
          </span>
        ))}
      </div>
      <ul className="border-t-2 border-ink sm:border-t-0">
        {rows.map((r) => (
          <li key={r.key} className={`border-b border-rule py-3 sm:py-1.5 ${grid}`}>
            <span className="flex min-w-0 items-baseline justify-between gap-3 pr-2 sm:block">
              <span className="min-w-0">
                <span className="block text-sm leading-snug font-medium">{r.title}</span>
                {r.caseId !== undefined && (
                  <Link href={`/case/${r.caseId}`} className="mt-0.5 inline-block font-mono text-xs text-pen underline decoration-1">
                    #{r.caseId}
                  </Link>
                )}
              </span>
              <span className={`shrink-0 text-xs font-semibold sm:hidden ${r.outcome === "Cleared" ? "text-cleared" : "text-taken"}`}>
                {t.words.status[r.outcome]}
              </span>
            </span>
            <span className={`hidden text-sm font-semibold sm:block ${r.outcome === "Cleared" ? "text-cleared" : "text-taken"}`}>
              {t.words.status[r.outcome]}
            </span>
            <span className="mt-1 grid grid-cols-4 sm:contents">
              {r.stages.map((s, i) => (
                <span key={i} className="flex flex-col items-center sm:block sm:justify-self-center">
                  <TxTick link={s} label={t.words.stages[i]} />
                  <span aria-hidden className="-mt-1.5 text-[0.65rem] text-muted sm:hidden">
                    {t.words.stages[i]}
                  </span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{b.tapHint}</p>
    </div>
  );
}

function List({ title, rows }: { title?: string; rows: ListRow[] }) {
  return (
    <div>
      {title && <h3 className="mb-1 text-sm font-semibold text-muted">{title}</h3>}
      <ol className="border-t border-rule">
        {rows.map((r, i) => (
          <li key={`${r.label}-${i}`} className="flex items-start justify-between gap-4 border-b border-rule py-2.5 text-sm">
            <span className="min-w-0">
              {r.label}
              {r.note && <span className="block text-xs text-muted">{r.note}</span>}
            </span>
            {r.link ? (
              <a href={r.link.url} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-pen underline decoration-1">
                {r.link.hash.slice(0, 6)}…
              </a>
            ) : r.value ? (
              r.href ? (
                <a href={r.href} target="_blank" rel="noreferrer" title={r.value} className="min-w-0 shrink truncate font-mono text-pen underline decoration-1 sm:max-w-[22ch]">
                  {r.value}
                </a>
              ) : (
                <span className={`min-w-0 shrink truncate sm:max-w-[22ch] ${r.mono ? "font-mono" : ""}`} title={r.value}>
                  {r.value}
                </span>
              )
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Every claim on the site as one board: a tab per claim, each opening a
 * compact panel with the transactions behind it. Desktop: tabs on the left.
 * Phones: a swipeable row of tabs on top. The open tab follows the URL hash,
 * so a link can point straight at one claim.
 */
export function EvidenceBoard({ panels }: { panels: Panel[] }) {
  const reduce = useReduceMotion();
  const [active, setActive] = useState(panels[0].id);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (panels.some((p) => p.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [panels]);

  const choose = (id: string) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  };
  const panel = panels.find((p) => p.id === active) ?? panels[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
      {/* Tabs: a swipeable row on phones, a column on desktop. */}
      <div role="tablist" aria-label="Evidence" aria-orientation="vertical" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0">
        {panels.map((p) => {
          const on = p.id === panel.id;
          return (
            <button
              key={p.id}
              role="tab"
              id={`tab-${p.id}`}
              aria-selected={on}
              aria-controls={`panel-${p.id}`}
              onClick={() => choose(p.id)}
              className={`group flex min-h-11 shrink-0 snap-start items-center justify-between gap-3 rounded-[2px] border px-3 py-2 text-left text-sm transition-colors duration-200 lg:rounded-none lg:border-0 lg:border-b lg:border-rule lg:px-0 lg:py-3 ${
                on ? "border-ink bg-ink text-paper lg:bg-transparent lg:text-ink" : "border-rule text-muted hover:text-ink"
              }`}
            >
              <span className={`whitespace-nowrap ${on ? "font-semibold" : ""}`}>
                <span aria-hidden className={`mr-2 hidden lg:inline-block ${on ? "text-pen" : "text-transparent"}`}>
                  ●
                </span>
                {p.tab}
              </span>
              <span className={`font-mono text-xs tabular ${on ? "lg:text-pen" : ""}`}>{p.figure}</span>
            </button>
          );
        })}
      </div>

      <div className="relative min-h-[24rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={panel.id}
            role="tabpanel"
            id={`panel-${panel.id}`}
            aria-labelledby={`tab-${panel.id}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={reduce ? instant : { duration: 0.25, ease: EASE }}
            className="rounded-[2px] border border-rule bg-sheet p-4 sm:p-6"
          >
            <div className="perforation -mt-1 mb-4" aria-hidden />
            <p className="text-lg leading-snug font-bold">{panel.claim}</p>
            {panel.lead && <p className="mt-1 max-w-[64ch] text-sm text-muted">{panel.lead}</p>}
            <div className="mt-5 space-y-6">
              {panel.matrix && <Matrix rows={panel.matrix} />}
              {panel.lists?.map((l, i) => (
                <List key={i} title={l.title} rows={l.rows} />
              ))}
            </div>
            {panel.footer && (
              <Link href={panel.footer.href} className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-pen underline decoration-2 underline-offset-4">
                {panel.footer.label}
              </Link>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}
