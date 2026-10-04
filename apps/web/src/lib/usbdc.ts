// The Sep 19, 2026 USBDC pilot event: a payment and the clawback of the same
// amount 15 minutes later. Ids verified on mainnet Horizon (docs/EVIDENCE.md).
export const USBDC_EVENT = {
  paymentOp: "277025910283366401",
  clawbackOp: "277026709147193345",
} as const;
