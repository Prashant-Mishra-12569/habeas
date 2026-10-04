import { NextResponse } from "next/server";
import { ATTEST_PREFIX, attestPublicKey } from "@/lib/attest";
import { X402_NETWORK, X402_PAY_TO, X402_PRICE } from "@/lib/x402";

/** Free: the key that signs paid answers, and how to check a signature. */
export function GET() {
  let signer: string;
  try {
    signer = attestPublicKey();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
  return NextResponse.json({
    signer,
    algorithm: "ed25519",
    message: `sha256("${ATTEST_PREFIX}" + canonical JSON of { resource, network, result, signedAt })`,
    canonicalJson: "object keys sorted at every level, no whitespace",
    price: X402_PRICE,
    network: X402_NETWORK,
    payTo: X402_PAY_TO,
    example: "https://github.com/Prashant-Mishra-12569/habeas/blob/main/examples/agent-check.ts",
  });
}
