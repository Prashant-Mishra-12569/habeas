// What the Habeas website does for us: build unsigned transactions (its rules
// stay in one place) and answer paid token checks. This server never signs for
// anyone and never holds the issuer's or reviewer's key.
import { config } from "../config.ts";
import { ErrorCode, McpToolError } from "../lib/errors.ts";

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.HABEAS_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    throw new McpToolError(`Couldn't reach the Habeas website (${(e as Error).message}).`, ErrorCode.WEB_REQUEST_FAILED, { url: config.HABEAS_URL });
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    // The site's messages are written for people and say what to do next.
    throw new McpToolError(data.error ?? `The Habeas website answered ${res.status}.`, res.status === 400 ? ErrorCode.HABEAS_REFUSED : ErrorCode.WEB_REQUEST_FAILED, { status: res.status });
  }
  return data;
}

export type UnsignedRequest =
  | { method: "open_case"; source: string; holder: string; amount: number; reason: string; statement: string; fileHash: string }
  | { method: "decide"; source: string; caseId: number; uphold: boolean; statement: string; fileHash?: string }
  | { method: "withdraw"; source: string; caseId: number };

/** Asks the site to build, simulate and return an unsigned transaction for a wallet to sign. */
export async function buildUnsigned(req: UnsignedRequest): Promise<{ xdr: string }> {
  return postJson<{ xdr: string }>("/api/tx/build", req);
}
