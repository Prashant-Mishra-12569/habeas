"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * True when the visitor asked for less motion.
 *
 * Unlike motion's useReducedMotion, this returns false while React hydrates
 * (the server can't know the setting) and switches right after. Components
 * therefore render the same markup on server and client, so visitors with
 * "Reduce motion" on (common on iPhones) don't get a hydration error.
 */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Transition that finishes at once when motion is reduced. */
export const instant = { duration: 0, delay: 0 } as const;
