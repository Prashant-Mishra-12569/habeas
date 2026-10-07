import { config } from "../config.ts";
import { toJson } from "./json.ts";

// Logs go to stderr. On the stdio transport stdout is the protocol itself, so
// a single log line there would corrupt the stream.
type Level = "debug" | "info" | "warn" | "error";
const rank: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function write(level: Level, a: unknown, b?: string) {
  if (rank[level] < rank[config.LOG_LEVEL]) return;
  const fields = typeof a === "string" ? {} : (a as Record<string, unknown>);
  const msg = typeof a === "string" ? a : b;
  process.stderr.write(`${toJson({ level, time: new Date().toISOString(), msg, ...fields }, 0)}\n`);
}

export const logger = {
  debug: (a: unknown, b?: string) => write("debug", a, b),
  info: (a: unknown, b?: string) => write("info", a, b),
  warn: (a: unknown, b?: string) => write("warn", a, b),
  error: (a: unknown, b?: string) => write("error", a, b),
};
