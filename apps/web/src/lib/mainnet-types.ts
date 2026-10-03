// Shared by server and client code.
export type ClawbackEvent = {
  assetCode: string;
  issuer: string;
  holder: string;
  amount: string;
  sentAt: string;
  takenAt: string;
  takeBackTx: string;
  takeBackOp: string;
  secondsBetween: number;
};
