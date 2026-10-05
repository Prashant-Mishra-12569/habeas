"use client";

import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

/**
 * Smooth wheel scrolling on desktop. Touch screens keep their own native
 * scrolling (no syncTouch), and Lenis turns itself off for visitors who ask
 * for reduced motion. Scroll-linked animations still read window scroll.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.085,
        smoothWheel: true,
        syncTouch: false,
        anchors: { offset: -24 },
        stopInertiaOnNavigate: true,
        respectReducedMotion: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
