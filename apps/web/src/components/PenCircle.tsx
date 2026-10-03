"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";

/**
 * Circles its content in ballpoint, the way an auditor marks a missing field.
 * The loop is revealed by a sliding clip (transform only), not by animating
 * the stroke.
 */
export function PenCircle({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  const id = `circle${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className="relative inline-block px-1">
      {children}
      <svg
        aria-hidden
        viewBox="0 0 120 44"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -inset-x-2 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] overflow-visible"
      >
        <clipPath id={id}>
          <motion.rect
            x="-10"
            y="-10"
            width="140"
            height="64"
            style={{ originX: 0 }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
          />
        </clipPath>
        <path
          d="M14 9 C 40 1, 96 2, 112 12 C 121 19, 116 35, 88 40 C 58 45, 18 42, 7 31 C 0 23, 6 13, 26 7"
          fill="none"
          stroke="var(--pen)"
          strokeWidth="1.8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          clipPath={`url(#${id})`}
        />
      </svg>
    </span>
  );
}
