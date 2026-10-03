import "server-only";
import { ReadError } from "./habeas";
import type { ClawbackEvent } from "./mainnet-types";

export type { ClawbackEvent };

export const MAINNET_HORIZON = process.env.MAINNET_HORIZON_URL ?? "https://horizon.stellar.org";

/**
 * The Sep 19, 2026 USBDC pilot event: a payment and the clawback of the same
 * amount 15 minutes later. Ids verified on mainnet Horizon on Oct 3, 2026
 * (docs/EVIDENCE.md). Everything shown is read live from Horizon.
 */
export const USBDC_EVENT = {
  paymentOp: "277025910283366401",
  clawbackOp: "277026709147193345",
} as const;

type HorizonOp = {
  id: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  amount: string;
  asset_code: string;
  asset_issuer: string;
  from: string;
  to?: string;
};

async function horizon<T>(path: string): Promise<T> {
  let res: Response;
  try {
    // Past operations never change, so a long cache is safe.
    res = await fetch(`${MAINNET_HORIZON}${path}`, { next: { revalidate: 86_400 } });
  } catch (e) {
    throw new ReadError(`Couldn't reach Stellar's public Horizon server (${(e as Error).message}).`);
  }
  if (!res.ok) throw new ReadError(`Horizon answered ${res.status} for ${path}.`);
  return res.json() as Promise<T>;
}


export async function getUsbdcEvent(): Promise<ClawbackEvent> {
  const [payment, clawback] = await Promise.all([
    horizon<HorizonOp>(`/operations/${USBDC_EVENT.paymentOp}`),
    horizon<HorizonOp>(`/operations/${USBDC_EVENT.clawbackOp}`),
  ]);
  if (clawback.type !== "clawback") {
    throw new ReadError(`Operation ${clawback.id} is a ${clawback.type}, not a clawback.`);
  }
  return {
    assetCode: clawback.asset_code,
    issuer: clawback.asset_issuer,
    holder: clawback.from,
    amount: clawback.amount,
    sentAt: payment.created_at,
    takenAt: clawback.created_at,
    takeBackTx: clawback.transaction_hash,
    takeBackOp: clawback.id,
    secondsBetween: (Date.parse(clawback.created_at) - Date.parse(payment.created_at)) / 1000,
  };
}
