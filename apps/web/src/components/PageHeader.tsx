"use client";

import { motion } from "motion/react";
import { instant, useReduceMotion } from "@/lib/use-reduce-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The top of every inner page: a big title with a ballpoint stroke drawn
 * under it, the lead, and a short note written in the margin.
 */
export function PageHeader({ title, lead, note, kicker }: { title: string; lead?: string; note?: string; kicker?: string }) {
  const reduce = useReduceMotion();
  return (
    <header className="relative">
      {kicker && <p className="mb-2 font-mono text-sm text-muted">{kicker}</p>}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="relative text-[clamp(2.5rem,8.5vw,4.6rem)] leading-[1.02] tracking-[-0.035em]">
          {title}
          <svg aria-hidden viewBox="0 0 300 14" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-[min(100%,22rem)] overflow-visible">
            <motion.path
              d="M2 9 C 60 3, 120 12, 180 6 S 270 4, 298 8"
              fill="none"
              stroke="var(--pen)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={reduce ? instant : { duration: 0.9, delay: 0.2, ease: EASE }}
            />
          </svg>
        </h1>
        {note && (
          <motion.p
            aria-hidden
            className="hand mb-2 -rotate-3 text-[1.35rem] sm:text-2xl"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? instant : { duration: 0.5, delay: 0.9, ease: EASE }}
          >
            {note}
          </motion.p>
        )}
      </div>
      {lead && <p className="mt-6 max-w-[60ch] text-muted sm:text-lg sm:leading-relaxed">{lead}</p>}
    </header>
  );
}
