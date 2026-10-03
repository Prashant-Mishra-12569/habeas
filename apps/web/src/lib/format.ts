// Formats shared by every page. Words live in src/i18n/dict.ts.
import type { Lang } from "@/i18n/dict";

const LOCALE: Record<Lang, string> = { en: "en-US", es: "es-CL" };

/** GABC…WXYZ, for places where the full address doesn't fit. */
export function shortAddress(a: string, keep = 4): string {
  return a.length > keep * 2 + 1 ? `${a.slice(0, keep)}…${a.slice(-keep)}` : a;
}

export function shortHash(h: string, keep = 6): string {
  return h.length > keep * 2 + 1 ? `${h.slice(0, keep)}…${h.slice(-keep)}` : h;
}

/** Thousands grouped for the language, decimals kept as given: "24000.0000000" -> "24,000". */
export function formatTokens(amount: string, lang: Lang = "en"): string {
  const [whole, frac = ""] = amount.split(".");
  const trimmed = frac.replace(/0+$/, "");
  const grouped = Number(whole).toLocaleString(LOCALE[lang]);
  const sep = lang === "es" ? "," : ".";
  return trimmed ? `${grouped}${sep}${trimmed}` : grouped;
}

export function formatCount(n: number, lang: Lang = "en"): string {
  return n.toLocaleString(LOCALE[lang]);
}

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
};

const toDate = (input: number | string) => (typeof input === "number" ? new Date(input * 1000) : new Date(input));
const pad = (n: number) => String(n).padStart(2, "0");

/** "Sep 19, 2026" / "19 sept 2026". UTC, so server and client agree. */
export function formatDay(input: number | string, lang: Lang = "en"): string {
  const d = toDate(input);
  const m = MONTHS[lang][d.getUTCMonth()];
  return lang === "es" ? `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}` : `${m} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Sep 19, 2026, 03:08 UTC". */
export function formatUtc(input: number | string, lang: Lang = "en"): string {
  const d = toDate(input);
  return `${formatDay(input, lang)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "14:02:09 UTC", for steps that happen minutes apart. */
export function formatUtcTime(unixSecs: number): string {
  const d = new Date(unixSecs * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

const UNITS: Record<Lang, Record<"d" | "h" | "m" | "s", [string, string]>> = {
  en: { d: ["day", "days"], h: ["hour", "hours"], m: ["minute", "minutes"], s: ["second", "seconds"] },
  es: { d: ["día", "días"], h: ["hora", "horas"], m: ["minuto", "minutos"], s: ["segundo", "segundos"] },
};

/** "15 minutes 30 seconds", "3 days". At most two units. */
export function formatDuration(totalSecs: number, lang: Lang = "en"): string {
  const parts: string[] = [];
  let rest = Math.round(totalSecs);
  for (const [unit, size] of [["d", 86_400], ["h", 3_600], ["m", 60], ["s", 1]] as const) {
    const n = Math.floor(rest / size);
    rest -= n * size;
    if (n && parts.length < 2) parts.push(`${n} ${UNITS[lang][unit][n === 1 ? 0 : 1]}`);
  }
  return parts.join(" ") || `0 ${UNITS[lang].s[1]}`;
}

export type Explorer = "testnet" | "public";
export const txUrl = (hash: string, network: Explorer = "testnet") => `https://stellar.expert/explorer/${network}/tx/${hash}`;
export const accountUrl = (a: string, network: Explorer = "testnet") => `https://stellar.expert/explorer/${network}/account/${a}`;
export const contractUrl = (c: string, network: Explorer = "testnet") => `https://stellar.expert/explorer/${network}/contract/${c}`;
export const explorerFor = (network: "mainnet" | "testnet"): Explorer => (network === "mainnet" ? "public" : "testnet");
