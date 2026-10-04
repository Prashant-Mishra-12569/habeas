import "server-only";
import { ReadError, horizon } from "./network";
import type { ClawbackEvent } from "./mainnet-types";
import { USBDC_EVENT } from "./usbdc";

export type { ClawbackEvent };
export { USBDC_EVENT };


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

export async function getUsbdcEvent(): Promise<ClawbackEvent> {
  const [payment, clawback] = await Promise.all([
    horizon<HorizonOp>("mainnet", `/operations/${USBDC_EVENT.paymentOp}`, 86_400),
    horizon<HorizonOp>("mainnet", `/operations/${USBDC_EVENT.clawbackOp}`, 86_400),
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
