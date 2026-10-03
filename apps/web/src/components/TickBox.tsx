"use client";

import { motion } from "motion/react";
import { instant, useReduceMotion } from "@/lib/use-reduce-motion";
import { useId } from "react";

/**
 * A form tick box, ticked in ballpoint. The tick appears with a quick wipe
 * (a transform on a clip rect), like a pen stroke.
 */
export function TickBox({
  checked,
  label,
  tone = "pen",
  delay = 0,
}: {
  checked: boolean;
  label: string;
  tone?: "pen" | "cleared" | "taken";
  delay?: number;
}) {
  const reduce = useReduceMotion();
  const color = tone === "cleared" ? "var(--cleared)" : tone === "taken" ? "var(--taken)" : "var(--pen)";
  const id = `tick${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className={`inline-flex items-center gap-2 ${checked ? "text-ink" : "text-muted"}`}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0 overflow-visible">
        <rect x="1" y="1" width="16" height="16" rx="1.5" fill="none" stroke="var(--field)" strokeWidth="1.25" />
        {checked && (
          <>
            <clipPath id={id}>
              <motion.rect
                x="-2"
                y="-6"
                width="26"
                height="30"
                style={{ originX: 0 }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={reduce ? instant : { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
              />
            </clipPath>
            <path
              d="M3.2 9.6 L7.1 13.4 L16.8 1.8"
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              clipPath={`url(#${id})`}
            />
          </>
        )}
      </svg>
      <span className={checked ? "font-semibold" : ""}>{label}</span>
      <span className="sr-only">{checked ? "(ticked)" : "(not ticked)"}</span>
    </span>
  );
}
