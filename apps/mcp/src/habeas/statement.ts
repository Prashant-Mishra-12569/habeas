// Public statements are at most 280 bytes (UTF-8), not 280 characters.

export const STATEMENT_MAX_BYTES = 280;

export function statementBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export type StatementCheck = { ok: boolean; bytes: number; max: number; over: number; trimmed: string };

export function checkStatement(raw: string): StatementCheck {
  const text = raw.trim();
  const bytes = statementBytes(text);
  return { ok: bytes > 0 && bytes <= STATEMENT_MAX_BYTES, bytes, max: STATEMENT_MAX_BYTES, over: Math.max(0, bytes - STATEMENT_MAX_BYTES), trimmed: text };
}

/** A SHA-256 fingerprint as 64 lowercase hex characters, or null if it isn't one. */
export function normalizeFingerprint(h: string): string | null {
  const v = h.trim().toLowerCase().replace(/^0x/, "");
  return /^[0-9a-f]{64}$/.test(v) ? v : null;
}
