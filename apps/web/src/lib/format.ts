// Words and formats shared by every page. Keep wording in line with the
// "Words on screen" list in CLAUDE.md.
import type { EndedBy, Reason, Status } from "./types";

/** GABC…WXYZ, for places where the full address doesn't fit. */
export function shortAddress(a: string, keep = 4): string {
  return a.length > keep * 2 + 1 ? `${a.slice(0, keep)}…${a.slice(-keep)}` : a;
}

export function shortHash(h: string, keep = 6): string {
  return h.length > keep * 2 + 1 ? `${h.slice(0, keep)}…${h.slice(-keep)}` : h;
}

/** Group thousands, keep up to 7 decimals as given: "24000.0000000" -> "24,000". */
export function formatTokens(amount: string): string {
  const [whole, frac = ""] = amount.split(".");
  const grouped = Number(whole).toLocaleString("en-US");
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 19, 2026, 03:08 UTC". UTC on purpose: the same on server and client. */
export function formatUtc(input: number | string): string {
  const d = typeof input === "number" ? new Date(input * 1000) : new Date(input);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/** "14:02:09 UTC", for steps that happen minutes apart. */
export function formatUtcTime(unixSecs: number): string {
  const d = new Date(unixSecs * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}

/** "15 minutes 30 seconds". */
export function formatDuration(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = Math.round(totalSecs % 60);
  const parts = [];
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return parts.join(" ") || "0 seconds";
}

export const REASON_LABEL: Record<Reason, string> = {
  Fraud: "Suspected fraud",
  SanctionsOrder: "Sanctions order",
  SentByMistake: "Sent by mistake",
  CourtOrder: "Court order",
  Other: "Other",
};

/** What a status means for the holder, in one line. */
export const STATUS_LINE: Record<Status, string> = {
  Open: "Waiting for the holder's answer. Their tokens can't move until the case closes.",
  Answered: "Still frozen. Waiting for the reviewer to decide.",
  Upheld: "The reviewer sided with the issuer. Anyone can settle now.",
  Rejected: "The reviewer sided with the holder. Anyone can settle now.",
  Cleared: "The holder keeps the tokens and is unfrozen.",
  TakenBack: "The case amount was taken back. The rest of the balance is unfrozen.",
};

export const STATUS_SHORT: Record<Status, string> = {
  Open: "Frozen",
  Answered: "Answered",
  Upheld: "Upheld",
  Rejected: "Rejected",
  Cleared: "Cleared",
  TakenBack: "Taken back",
};

export const ENDED_BY_LINE: Record<EndedBy, string | null> = {
  NotEnded: null,
  Withdrawn: "The issuer withdrew the case.",
  NoAnswer: "No answer came before the deadline.",
  ReviewerUpheld: "The reviewer sided with the issuer.",
  ReviewerRejected: "The reviewer sided with the holder.",
  ReviewerSilent: "The reviewer didn't decide in time, so the holder wins by default.",
  Emergency: "Issuer and reviewer acted together in an emergency.",
};

export const txUrl = (hash: string, network: "testnet" | "public" = "testnet") =>
  `https://stellar.expert/explorer/${network}/tx/${hash}`;
export const accountUrl = (a: string, network: "testnet" | "public" = "testnet") =>
  `https://stellar.expert/explorer/${network}/account/${a}`;
export const contractUrl = (c: string, network: "testnet" | "public" = "testnet") =>
  `https://stellar.expert/explorer/${network}/contract/${c}`;
