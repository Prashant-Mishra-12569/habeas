"use client";

import { motion } from "motion/react";
import { instant, useReduceMotion } from "@/lib/use-reduce-motion";
import type { ReactNode } from "react";
import type { AssetCheck, ScanOp } from "@/lib/asset-check-types";
import { accountUrl, contractUrl, explorerFor, formatCount, formatDay, formatDuration, formatTokens, shortAddress, shortHash, txUrl } from "@/lib/format";
import { useLang, useT } from "@/i18n/client";
import { TickBox } from "./TickBox";

const EASE = [0.22, 1, 0.36, 1] as const;
const MAX_LISTED = 5;

const VERDICT_BAR: Record<string, string> = {
  protected: "border-cleared",
  "used-without-process": "border-taken",
  "not-used": "border-pen",
  "not-used-partial": "border-pen",
  "no-powers": "border-field",
};

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-mono text-pen underline decoration-1">
      {children}
    </a>
  );
}

/** The asset check, written as answers on a form, one line at a time. */
export function AnswerSheet({ r }: { r: AssetCheck }) {
  const t = useT();
  const lang = useLang();
  const reduce = useReduceMotion();
  const ex = explorerFor(r.network);
  const partial = !r.history.complete;
  const verdictKey = r.verdict === "not-used" && partial ? "not-used-partial" : r.verdict;
  const yesNo = (yes: boolean, delay: number) => (
    <span className="flex gap-5">
      <TickBox checked={yes} label={t.words.yes} delay={delay} />
      <TickBox checked={!yes} label={t.words.no} delay={delay} />
    </span>
  );
  const opList = (ops: ScanOp[]) => (
    <ul className="mt-2 divide-y divide-rule text-sm">
      {ops.slice(0, MAX_LISTED).map((o) => (
        <li key={o.op} className="py-1.5">
          <p className="flex flex-wrap justify-between gap-x-3">
            <span>{formatDay(o.at, lang)}</span>
            {o.amount && (
              <span className="font-mono tabular">
                {formatTokens(o.amount, lang)} {r.code}
              </span>
            )}
          </p>
          <p className="flex flex-wrap justify-between gap-x-3 text-muted">
            <span className="font-mono">{o.holder ? shortAddress(o.holder) : ""}</span>
            <Ext href={txUrl(o.tx, ex)}>{shortHash(o.tx, 5)}</Ext>
          </p>
        </li>
      ))}
      {ops.length > MAX_LISTED && <li className="text-muted">{t.check.a.more(ops.length - MAX_LISTED)}</li>}
    </ul>
  );

  const h = r.habeas;
  const takeBacks = r.history.takeBacks;
  const freezes = r.history.freezes;

  const rows: { q: string; a: ReactNode }[] = [
    { q: t.check.q.freeze, a: yesNo(r.flags.revocable, 0.1) },
    { q: t.check.q.takeBack, a: yesNo(r.flags.clawbackEnabled, 0.15) },
    {
      q: t.check.q.hasTaken,
      a: (
        <>
          {takeBacks.length ? (
            <p className="font-semibold">{t.check.a.times(takeBacks.length)}</p>
          ) : (
            <p>{partial ? t.check.a.noneRecent : t.check.a.none}</p>
          )}
          {takeBacks.length > 0 && opList(takeBacks)}
          {h && <p className="mt-1 text-sm">{t.check.a.habeasCases(h.caseCount, h.takenBackCount)}</p>}
        </>
      ),
    },
    {
      q: t.check.q.hasFrozen,
      a: (
        <>
          {freezes.length ? <p className="font-semibold">{t.check.a.times(freezes.length)}</p> : <p>{partial ? t.check.a.noneRecent : t.check.a.none}</p>}
          {freezes.length > 0 && opList(freezes)}
        </>
      ),
    },
    {
      q: t.check.q.reason,
      a: h ? (
        <p>{t.check.a.reasonHabeas}</p>
      ) : r.reasons.length ? (
        <>
          <p>{t.check.a.reasonMemo}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {r.reasons.map((m) => (
              <li key={m.tx}>
                “{m.memo}” <Ext href={txUrl(m.tx, ex)}>{shortHash(m.tx, 5)}</Ext>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>{t.check.a.reasonNone}</p>
      ),
    },
    {
      q: t.check.q.process,
      a: h ? (
        <>
          {yesNo(true, 0.2)}
          <p className="mt-2 text-sm">{t.check.a.processHabeas(formatDuration(h.answerWindowSecs, lang), formatDuration(h.reviewWindowSecs, lang))}</p>
        </>
      ) : (
        <>
          {yesNo(false, 0.2)}
          <p className="mt-2 text-sm">{t.check.a.processNone}</p>
        </>
      ),
    },
    {
      q: t.check.q.admin,
      a: (() => {
        const adm = r.admin;
        switch (adm.kind) {
          case "none":
            return <p>{t.check.a.adminNone}</p>;
          case "issuer":
            return <p>{t.check.a.adminIssuer}</p>;
          case "account":
            return (
              <p>
                {t.check.a.adminAccount} <Ext href={accountUrl(adm.address!, ex)}>{shortAddress(adm.address!, 6)}</Ext>
              </p>
            );
          case "habeas":
            return (
              <p>
                {t.check.a.adminHabeas} <Ext href={contractUrl(adm.address!, ex)}>{shortAddress(adm.address!, 6)}</Ext>
              </p>
            );
          case "contract":
            return (
              <>
                <p>{t.check.a.adminContract}</p>
                <p className="mt-2 text-sm">
                  <Ext href={contractUrl(adm.address!, ex)}>{shortAddress(adm.address!, 6)}</Ext>
                  {adm.wasmHash && <span className="ml-2 font-mono text-xs text-muted">wasm {shortHash(adm.wasmHash, 6)}</span>}
                </p>
                <p className="mt-1 text-sm text-muted">{t.check.a.adminContractNote}</p>
              </>
            );
        }
      })(),
    },
    {
      q: t.check.q.backDoor,
      a: h ? (
        <>
          {yesNo(h.backDoor.closed, 0.25)}
          <p className="mt-2 text-sm">{t.check.a.backDoorMode[h.backDoor.mode]}</p>
        </>
      ) : (
        <p className="text-muted">{t.check.a.backDoorNa}</p>
      ),
    },
  ];

  // Four facts a visitor wants first, before the full sheet.
  const facts: { label: string; value: string; tone?: string }[] = [
    { label: t.check.q.freeze, value: r.flags.revocable ? t.words.yes : t.words.no, tone: r.flags.revocable ? "text-ink" : "text-cleared" },
    { label: t.check.q.takeBack, value: r.flags.clawbackEnabled ? t.words.yes : t.words.no, tone: r.flags.clawbackEnabled ? "text-ink" : "text-cleared" },
    { label: t.check.q.hasTaken, value: takeBacks.length ? `${formatCount(takeBacks.length, lang)}${partial ? "+" : ""}` : t.words.no, tone: takeBacks.length ? "text-taken" : "text-ink" },
    { label: t.check.q.reason, value: h ? t.words.yes : r.reasons.length ? formatCount(r.reasons.length, lang) : t.words.no, tone: h ? "text-cleared" : r.reasons.length ? "text-ink" : "text-taken" },
  ];

  return (
    <article className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      {/* Summary: sticks beside the sheet on desktop. */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <p className="text-sm text-muted">
          {t.check.issuedBy}{" "}
          <Ext href={accountUrl(r.issuer, ex)}>{r.homeDomain ?? shortAddress(r.issuer, 6)}</Ext>
          <span className="ml-2 rounded-[2px] border border-rule px-2 py-0.5 text-xs">{r.network === "mainnet" ? t.check.mainnet : t.check.testnet}</span>
        </p>
        <h1 translate="no" className="mt-2 font-mono text-[clamp(2.75rem,10vw,4.75rem)] leading-none font-medium tracking-[-0.04em] break-all">
          {r.code}
        </h1>
        {r.holders !== null && <p className="mt-2 text-sm text-muted">{t.check.holders(formatCount(r.holders, lang))}</p>}

        <motion.div
          key={`verdict-${reduce}`}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? instant : { duration: 0.5, delay: 0.15, ease: EASE }}
          className={`mt-7 border-l-[6px] pl-4 sm:pl-5 ${VERDICT_BAR[verdictKey]}`}
        >
          <p className="text-[clamp(1.6rem,4.5vw,2.25rem)] leading-[1.08] font-extrabold tracking-[-0.025em]">
            {t.check.verdict[verdictKey as keyof typeof t.check.verdict]}
          </p>
          <p className="mt-2 max-w-[52ch] text-muted">{t.check.verdictLine[verdictKey as keyof typeof t.check.verdictLine]}</p>
        </motion.div>

        <dl className="mt-8 grid grid-cols-2 border-t-2 border-ink">
          {facts.map((f, i) => (
            <div key={f.label} className={`flex flex-col-reverse justify-end border-b border-rule py-4 pr-3 ${i % 2 ? "border-l pl-4" : ""}`}>
              <dt className="mt-1 text-xs leading-snug text-muted">{f.label}</dt>
              <dd className={`text-2xl font-extrabold tracking-tight tabular ${f.tone ?? ""}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      <p className="mt-5 max-w-[60ch] text-xs text-muted">
        {t.check.how(formatCount(r.history.scanned, lang), r.history.complete, r.history.oldestScanned ? formatDay(r.history.oldestScanned, lang) : "")}{" "}
        {t.check.checkedAt} {new Date(r.checkedAt).toISOString().slice(11, 16)} UTC.
      </p>
      </div>

      {/* The full answer sheet. */}
      <div className="min-w-0">
      <div className="relative mr-4 mb-4">
        <div aria-hidden className="absolute inset-0 translate-x-[14px] translate-y-[14px] rounded-[2px] bg-pink" />
        <div aria-hidden className="absolute inset-0 translate-x-[7px] translate-y-[7px] rounded-[2px] bg-canary" />
        <dl className="relative rounded-[2px] border border-rule bg-sheet">
          <div className="perforation mx-4 mt-3" aria-hidden />
          {rows.map((row, i) => (
            <motion.div
              // Keyed on `reduce` too: when the browser reports "Reduce motion" right
              // after hydration, the row remounts in its final state instead of
              // fading in late.
              key={`${row.q}-${reduce}`}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? instant : { duration: 0.35, delay: 0.08 * i, ease: EASE }}
              className="grid gap-2 border-b border-rule px-4 py-4 last:border-b-0 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8"
            >
              <dt className="font-semibold">{row.q}</dt>
              <dd>{row.a}</dd>
            </motion.div>
          ))}
        </dl>
      </div>

      </div>
    </article>
  );
}
