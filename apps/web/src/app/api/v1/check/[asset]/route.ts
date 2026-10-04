import { NextResponse, type NextRequest } from "next/server";
import { withX402 } from "@x402/next";
import { attest } from "@/lib/attest";
import { checkAsset, parseAsset } from "@/lib/asset-check";
import { NotFoundError } from "@/lib/network";
import { X402_NETWORK, X402_PAY_TO, X402_PRICE, x402Server } from "@/lib/x402";

export const maxDuration = 60;

/**
 * GET /api/v1/check/CODE-ISSUER[?network=testnet]
 *
 * The same answers as the free web check, as JSON, signed by Habeas. Paid per
 * call with x402 (testnet USDC). Payment settles only when this returns
 * successfully, so a bad asset or a Stellar outage costs the buyer nothing.
 */
async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
  const raw = decodeURIComponent(req.nextUrl.pathname.split("/").pop() ?? "");
  const network = req.nextUrl.searchParams.get("network") === "testnet" ? "testnet" : "mainnet";
  let asset: { code: string; issuer: string };
  try {
    asset = parseAsset(raw);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const result = await checkAsset(network, asset.code, asset.issuer);
    const { signed, attestation } = attest({ resource: `${asset.code}-${asset.issuer}`, network, result });
    return NextResponse.json({ ...signed, attestation });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof NotFoundError ? 404 : 502 });
  }
}

export const GET = withX402(
  handler,
  {
    "/api/v1/check/[asset]": {
      accepts: [{ scheme: "exact", price: X402_PRICE, network: X402_NETWORK, payTo: X402_PAY_TO }],
      description: "Habeas asset check: can this Stellar token be frozen or taken back, has it been, and is there a fair process. Signed answer.",
      mimeType: "application/json",
    },
  },
  x402Server,
);
