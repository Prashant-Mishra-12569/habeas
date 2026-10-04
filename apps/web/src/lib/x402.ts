import "server-only";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { x402ResourceServer } from "@x402/next";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

/**
 * The paid agent check. Payments are in testnet USDC on Stellar and are
 * verified and settled by the public x402.org facilitator, which supports
 * Stellar testnet and pays the network fee itself.
 */
export const X402_NETWORK = "stellar:testnet";
export const X402_PRICE = "$0.001";
/** Receives payments. Public testnet account with a USDC trustline (scripts/setup-x402.mjs). */
export const X402_PAY_TO = process.env.X402_PAY_TO ?? "GD2YGUUJU4LC75TFPODRSZVQEX472MVIFMN5XD77GZREWFCCSTBGG7U2";
export const X402_FACILITATOR = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

export const x402Server = new x402ResourceServer(new HTTPFacilitatorClient({ url: X402_FACILITATOR })).register(
  X402_NETWORK,
  new ExactStellarScheme(),
);
