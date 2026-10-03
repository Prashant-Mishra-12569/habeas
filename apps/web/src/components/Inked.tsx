"use client";

import { motion } from "motion/react";
import { useReduceMotion } from "@/lib/use-reduce-motion";

/**
 * Text that appears letter by letter, like someone filling in a form.
 * Opacity only. Screen readers get the whole text at once.
 */
export function Inked({ text, delay = 0, perChar = 0.022 }: { text: string; delay?: number; perChar?: number }) {
  const reduce = useReduceMotion();
  if (reduce) return <>{text}</>;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {Array.from(text).map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + i * perChar, duration: 0.06 }}
          >
            {ch}
          </motion.span>
        ))}
      </span>
    </>
  );
}

/** Fades a block in after `delay` seconds. */
export function Appear({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReduceMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.span
      className="inline-block"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  );
}
