"use client";

import { useEffect, useState } from "react";

/**
 * Contract deadlines run on ledger time, and a transaction lands in the next
 * ledger (~5 s on testnet). Countdowns add this margin so "Settle" only shows
 * once the chain will accept it.
 */
export const LEDGER_MARGIN_SECS = 7;

/**
 * Seconds left until `target` (unix seconds), ticking once a second. The
 * first render uses `serverNow`, so server and browser render the same text;
 * after that it follows the browser's clock.
 */
export function useCountdown(target: number | null, serverNow: number | null): number | null {
  const [now, setNow] = useState<number | null>(serverNow);
  useEffect(() => {
    if (target === null) return;
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  if (target === null) return null;
  const current = now ?? serverNow ?? target;
  return Math.max(0, target + LEDGER_MARGIN_SECS - current);
}

export const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
