import "server-only";
import { horizon } from "./network";
import { X402_PAY_TO } from "./x402";

/** Circle's testnet USDC, the asset x402 payments on Stellar testnet use. */
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export type PaidCheck = { tx: string; at: string; from: string; amount: string };

type HorizonPayment = {
  type: string;
  transaction_hash: string;
  created_at: string;
  asset_balance_changes?: { type: string; asset_code?: string; asset_issuer?: string; from?: string; to?: string; amount: string }[];
};

/**
 * Payments for paid checks, newest first, read from Horizon. An x402 payment
 * on Stellar is a USDC token transfer inside a contract call, so Horizon lists
 * it as an invoke_host_function with the transfer in asset_balance_changes.
 */
export async function paidChecks(limit = 10): Promise<{ checks: PaidCheck[]; scanned: number }> {
  const page = await horizon<{ _embedded: { records: HorizonPayment[] } }>(
    "testnet",
    `/accounts/${X402_PAY_TO}/payments?order=desc&limit=200`,
    30,
  );
  const records = page._embedded.records;
  const checks = records.flatMap((r) =>
    r.type !== "invoke_host_function"
      ? []
      : (r.asset_balance_changes ?? [])
          .filter((c) => c.type === "transfer" && c.to === X402_PAY_TO && c.asset_code === "USDC" && c.asset_issuer === USDC_ISSUER)
          .map((c) => ({ tx: r.transaction_hash, at: r.created_at, from: c.from ?? "", amount: c.amount })),
  );
  return { checks: checks.slice(0, limit), scanned: records.length };
}
