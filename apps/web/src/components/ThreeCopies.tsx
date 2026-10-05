"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { useT } from "@/i18n/client";

export type CopyFacts = { caseId: number; reason: string; amount: string; answerBy: string; status: string };

const TONES = ["bg-pink", "bg-sheet", "bg-canary"] as const;

function Copy({ party, facts, tone, stamp }: { party: string; facts: CopyFacts; tone: string; stamp: string }) {
  const t = useT();
  return (
    <div className={`w-[17.5rem] rounded-[2px] border border-rule ${tone} p-4 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.35)] xl:w-[19rem]`}>
      <div className="perforation -mt-1 mb-3" aria-hidden />
      <p className="hand -rotate-2 text-xl">{party}</p>
      <div className="mt-2 border-t-2 border-ink" />
      <dl className="text-sm">
        {[
          [t.form.case, `#${facts.caseId}`],
          [t.form.reason, facts.reason],
          [t.form.amountAtStake, facts.amount],
          [t.form.answerBy, facts.answerBy],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-rule py-2">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-mono text-pen tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm font-semibold">{stamp}</p>
    </div>
  );
}

function Fanned({ i, progress, children }: { i: number; progress: MotionValue<number>; children: React.ReactNode }) {
  const side = i - 1; // -1, 0, 1
  const x = useTransform(progress, [0.08, 0.5], [side * 10, side * 330]);
  const y = useTransform(progress, [0.08, 0.5], [i * 10, side === 0 ? -14 : 8]);
  const rotate = useTransform(progress, [0.08, 0.5], [side * 2, side * 4]);
  return (
    <motion.div style={{ x, y, rotate, zIndex: side === 0 ? 3 : 2 - i }} className="absolute">
      {children}
    </motion.div>
  );
}

/**
 * The solution in one picture: a case is a form set, and every party gets a
 * copy. On wide screens the set sits still while you scroll and the three
 * copies slide apart to the issuer, the holder and the reviewer. On phones
 * the copies are simply laid out one after another.
 */
export function ThreeCopies({ facts }: { facts: CopyFacts }) {
  const t = useT();
  const c = t.copies;
  const reduce = useReduceMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const lineScale = useTransform(scrollYProgress, [0.5, 0.72], [0, 1]);
  const captionOpacity = useTransform(scrollYProgress, [0.55, 0.75], [0, 1]);
  const parties = [c.issuer, c.holder, c.reviewer];

  return (
    <>
      {/* Wide screens: a pinned stage. */}
      <div ref={ref} className="relative hidden h-[240vh] lg:block">
        <div className="sticky top-0 flex h-screen flex-col items-center justify-center">
          <div className="relative flex h-[23rem] w-full items-center justify-center">
            {parties.map((p, i) =>
              reduce ? null : (
                <Fanned key={p} i={i} progress={scrollYProgress}>
                  <Copy party={p} facts={facts} tone={TONES[i]} stamp={facts.status} />
                </Fanned>
              ),
            )}
            {reduce && (
              <div className="flex gap-6">
                {parties.map((p, i) => (
                  <Copy key={p} party={p} facts={facts} tone={TONES[i]} stamp={facts.status} />
                ))}
              </div>
            )}
          </div>
          <motion.div aria-hidden style={{ scaleX: reduce ? 1 : lineScale }} className="mt-10 h-[2px] w-[min(62rem,90%)] origin-left bg-pen" />
          <motion.p style={{ opacity: reduce ? 1 : captionOpacity }} className="mt-5 max-w-[46ch] text-center text-lg">
            {c.caption}
          </motion.p>
        </div>
      </div>

      {/* Phones and tablets: the three copies in a row you can swipe. */}
      <div className="lg:hidden">
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:-mx-8 sm:px-8">
          {parties.map((p, i) => (
            <motion.div
              key={p}
              className="snap-center"
              initial={reduce ? false : { opacity: 0, y: 16, rotate: (i - 1) * 2 }}
              whileInView={{ opacity: 1, y: 0, rotate: (i - 1) * 1.2 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <Copy party={p} facts={facts} tone={TONES[i]} stamp={facts.status} />
            </motion.div>
          ))}
        </div>
        <div className="mt-4 h-[2px] w-full bg-pen" aria-hidden />
        <p className="mt-4 max-w-[46ch] text-lg">{c.caption}</p>
      </div>
    </>
  );
}
