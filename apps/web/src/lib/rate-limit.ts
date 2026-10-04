import "server-only";
import { ReadError } from "./network";

/**
 * Best-effort limits for the demo endpoints, which spend the relayer's and
 * the demo issuer's testnet XLM. Counters live in memory, so on serverless
 * each instance counts on its own; the contract adds a hard limit of its own
 * (one open case per holder).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function limit(key: string, max: number, windowSecs: number, message: string) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSecs * 1000 });
    return;
  }
  if (b.count >= max) {
    const mins = Math.ceil((b.resetAt - now) / 60_000);
    throw new ReadError(`${message} Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
  b.count++;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
