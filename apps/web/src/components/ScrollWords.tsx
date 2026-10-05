"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { useReduceMotion } from "@/lib/use-reduce-motion";

function Word({ word, i, n, progress, accent }: { word: string; i: number; n: number; progress: MotionValue<number>; accent: boolean }) {
  const opacity = useTransform(progress, [i / n, (i + 1) / n], [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className={accent ? "text-pen" : undefined}>
      {word}{" "}
    </motion.span>
  );
}

/**
 * A statement whose words light up one by one as it scrolls through the
 * screen. Words wrapped in *asterisks* are written in ink. Screen readers
 * and reduced motion get the plain sentence.
 */
export function ScrollWords({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReduceMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 40%"] });
  const words = text.split(" ");
  const plain = text.replaceAll("*", "");
  if (reduce) {
    return (
      <p ref={ref} className={className}>
        {words.map((w, i) => (
          <span key={i} className={w.startsWith("*") ? "text-pen" : undefined}>
            {w.replaceAll("*", "")}{" "}
          </span>
        ))}
      </p>
    );
  }
  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{plain}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <Word key={i} word={w.replaceAll("*", "")} i={i} n={words.length} progress={scrollYProgress} accent={w.startsWith("*")} />
        ))}
      </span>
    </p>
  );
}
