"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useReduceMotion } from "@/lib/use-reduce-motion";

/**
 * The hero's form set, held a little apart from the page: as you scroll past
 * it, it drifts up more slowly than the text and tips back, like a sheet
 * lifted off the desk. Transform only.
 */
export function HeroStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReduceMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 30%", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [0, 9]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);
  return (
    <div ref={ref} className="[perspective:1400px]">
      <motion.div style={reduce ? undefined : { y, rotateX, scale, transformOrigin: "50% 100%" }}>{children}</motion.div>
    </div>
  );
}
