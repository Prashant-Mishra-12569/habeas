// Pays Habeas $0.001 (testnet USDC, over x402) for a signed token check, then
// proves the answer came from Habeas by checking its signature. Port of
// examples/agent-check.ts. Needs AGENT_SECRET and the optional @x402 packages.
import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { config } from "../config.ts";
import { ErrorCode, McpToolError } from "../lib/errors.ts";
import { ATTEST_PREFIX, canonicalJson } from "./canonical.ts";

export type SignedCheck = {
  paid: { network: "stellar:testnet"; transaction: string | null };
  signatureChecked: true;
  signer: string;
  signedAt: string;
  result: unknown;
};

export const paymentsEnabled = () => Boolean(config.AGENT_SECRET);

export async function paidCheck(asset: string, network: "mainnet" | "testnet"): Promise<SignedCheck> {
  const secret = config.AGENT_SECRET;
  if (!secret) {
    throw new McpToolError("check_asset needs AGENT_SECRET: a testnet account holding a little testnet USDC. See apps/mcp/.env.example.", ErrorCode.PAYMENT_NOT_CONFIGURED);
  }
  let x402: { fetch: typeof import("@x402/fetch"); stellar: typeof import("@x402/stellar"); exact: typeof import("@x402/stellar/exact/client") };
  try {
    x402 = {
      fetch: await import("@x402/fetch"),
      stellar: await import("@x402/stellar"),
      exact: await import("@x402/stellar/exact/client"),
    };
  } catch {
    throw new McpToolError("The x402 packages aren't installed. Run npm install in apps/mcp (they are optional dependencies).", ErrorCode.PAYMENT_NOT_CONFIGURED);
  }
  const signer = x402.stellar.createEd25519Signer(secret, "stellar:testnet");
  const pay = x402.fetch.wrapFetchWithPayment(fetch, new x402.fetch.x402Client().register("stellar:testnet", new x402.exact.ExactStellarScheme(signer)));

  const res = await pay(`${config.HABEAS_URL}/api/v1/check/${encodeURIComponent(asset)}?network=${network}`);
  const body = (await res.json()) as { error?: string; attestation?: Attestation } & Record<string, unknown>;
  if (!res.ok) throw new McpToolError(`Habeas answered ${res.status}: ${body.error ?? JSON.stringify(body)}`, ErrorCode.WEB_REQUEST_FAILED, { status: res.status });

  const { attestation, ...signed } = body;
  if (!attestation) throw new McpToolError("Habeas's answer carried no signature. Don't trust it.", ErrorCode.SIGNATURE_INVALID);
  verifyAttestation(signed, attestation);

  const receipt = res.headers.get("PAYMENT-RESPONSE");
  const transaction = receipt ? (x402.fetch.decodePaymentResponseHeader(receipt) as { transaction?: string }).transaction ?? null : null;
  return {
    paid: { network: "stellar:testnet", transaction },
    signatureChecked: true,
    signer: attestation.signer,
    signedAt: String(signed.signedAt),
    result: signed.result,
  };
}

type Attestation = { signer: string; signature: string; prefix?: string };

/** Throws unless the answer was signed by the pinned Habeas key. */
export function verifyAttestation(signed: Record<string, unknown>, attestation: Attestation): void {
  const digest = createHash("sha256").update((attestation.prefix ?? ATTEST_PREFIX) + canonicalJson(signed)).digest();
  const valid =
    attestation.signer === config.HABEAS_SIGNER && Keypair.fromPublicKey(config.HABEAS_SIGNER).verify(digest, Buffer.from(attestation.signature, "base64"));
  if (!valid) throw new McpToolError("The signature does not match Habeas's key. Don't trust this answer.", ErrorCode.SIGNATURE_INVALID);
}
