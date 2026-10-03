"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useRef, useState } from "react";
import type { Case, Status } from "@/lib/types";
import { caseRows, caseStages } from "@/lib/case-rows";
import { useLang, useT } from "@/i18n/client";
import { CaseForm } from "./CaseForm";
import { TickBox } from "./TickBox";

/**
 * The four steps of a case beside a real case form. As you scroll, an ink
 * line draws down the steps and the form moves to the matching state. On
 * small screens each step shows its stage boxes instead of a sticky form.
 */
export function HowItWorks({ c, asset }: { c: Case; asset: string }) {
  const t = useT();
  const lang = useLang();
  const reduce = useReducedMotion();
  const decided: Status = c.endedBy === "ReviewerUpheld" ? "Upheld" : "Rejected";
  const states: Status[] = ["Open", "Answered", decided, c.status];
  const [active, setActive] = useState(0);
  const list = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: list, offset: ["start 65%", "end 55%"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.max(0, Math.min(3, Math.floor(v * 4))));
  });

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
      <ol ref={list} className="relative space-y-14 py-2 pl-10 lg:py-[12vh]">
        {/* The ink line: a rule that fills with ballpoint as you scroll. */}
        <span aria-hidden className="absolute top-0 bottom-0 left-[11px] w-[2px] bg-rule" />
        <motion.span
          aria-hidden
          className="absolute top-0 bottom-0 left-[11px] w-[2px] bg-pen"
          style={{ scaleY: reduce ? 1 : scrollYProgress, originY: 0 }}
        />
        {t.home.how.map(([title, body], i) => (
          <li key={title} className={`relative transition-opacity duration-300 ${i <= active ? "opacity-100" : "opacity-55"}`}>
            <span
              aria-hidden
              className={`absolute -left-10 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 font-mono text-xs transition-colors duration-300 ${
                i <= active ? "border-pen bg-pen text-pen-ink" : "border-field bg-paper text-muted"
              }`}
            >
              {i + 1}
            </span>
            <h3 className="text-xl">{title}</h3>
            <p className="mt-2 max-w-[46ch] text-muted">{body}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm lg:hidden">
              {(["frozen", "answered", "decided", "closed"] as const).map((k, n) => (
                <TickBox
                  key={k}
                  checked={caseStages(c, states[i])[k]}
                  label={t.words.stages[n]}
                  tone={n === 3 && i === 3 ? (c.status === "Cleared" ? "cleared" : "taken") : "pen"}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="hidden lg:block">
        <div className="sticky top-24">
          <CaseForm
            title={<span className="font-mono">{t.form.case} {c.id}</span>}
            subtitle={`${asset} ${t.form.on} testnet`}
            rows={caseRows(c, asset, t, lang, states[active])}
            status={states[active]}
            stages={caseStages(c, states[active])}
            outcomeLine={active === 3 ? t.words.endedBy[c.endedBy] : null}
          />
          <p className="mt-2 text-sm text-muted">{t.home.howCaption}</p>
        </div>
      </div>
    </div>
  );
}
