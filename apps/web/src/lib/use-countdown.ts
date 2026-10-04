"use client";

import { useEffect, useState } from "react";

/**
 * Seconds left until `target` (unix seconds), ticking once a second. Uses the
 * server's clock (`serverNow`) so a wrong clock on the visitor's device can't
 * make "Settle" appear too early or too late.
 */
export function useCountdown(target: number | null, serverNow: number | null): number | null {
  const [offset] = useState(() => (serverNow ? serverNow - Math.floor(Date.now() / 1000) : 0));
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000) + offset);
  useEffect(() => {
    if (target === null) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000) + offset), 1000);
    return () => clearInterval(id);
  }, [target, offset]);
  return target === null ? null : Math.max(0, target - now);
}

export const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
