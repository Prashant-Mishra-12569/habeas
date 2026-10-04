import "server-only";
import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { ReadError } from "./network";

/**
 * Signed answers for the paid agent check. A buyer can keep the response and
 * prove later that Habeas said it, without trusting the connection it came
 * over.
 *
 * What is signed: sha256("habeas-check-v1:" + canonical JSON of
 * { resource, network, result, signedAt }), with ed25519. Canonical JSON means
 * object keys sorted at every level and no spaces. See examples/agent-check.ts
 * for verification.
 */
export const ATTEST_PREFIX = "habeas-check-v1:";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function attestKey(): Keypair {
  const secret = process.env.HABEAS_ATTEST_SECRET;
  if (!secret) throw new ReadError("The server is missing HABEAS_ATTEST_SECRET. See apps/web/.env.example.");
  return Keypair.fromSecret(secret);
}

export function attestPublicKey(): string {
  return attestKey().publicKey();
}

export type Attestation = { signer: string; algorithm: "ed25519"; digest: "sha256"; prefix: string; signedAt: string; signature: string };

export function attest(payload: { resource: string; network: string; result: unknown }): { signed: typeof payload & { signedAt: string }; attestation: Attestation } {
  const kp = attestKey();
  const signed = { ...payload, signedAt: new Date().toISOString() };
  const hash = createHash("sha256").update(ATTEST_PREFIX + canonicalJson(signed)).digest();
  return {
    signed,
    attestation: {
      signer: kp.publicKey(),
      algorithm: "ed25519",
      digest: "sha256",
      prefix: ATTEST_PREFIX,
      signedAt: signed.signedAt,
      signature: Buffer.from(kp.sign(hash)).toString("base64"),
    },
  };
}
