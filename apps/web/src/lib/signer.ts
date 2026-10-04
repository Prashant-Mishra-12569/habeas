// One interface for the two ways a visitor can sign: their Freighter wallet,
// or a throwaway testnet key made in this browser tab. Both only ever sign a
// DEMOUSD trustline or an authorization for their own answer.
import { connectFreighter, signAuth as freighterSignAuth, signTx as freighterSignTx } from "./freighter";

export type Signer = {
  kind: "freighter" | "temp";
  address: string;
  signTx(xdr: string): Promise<string>;
  signAuth(preimageXdr: string): Promise<{ signature: string; signerAddress: string }>;
};

export async function freighterSigner(): Promise<Signer> {
  const address = await connectFreighter();
  return {
    kind: "freighter",
    address,
    signTx: (xdr) => freighterSignTx(xdr, address),
    signAuth: (preimage) => freighterSignAuth(preimage, address),
  };
}

const KEY = "habeas-test-wallet";

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

export function hasTestWallet(): boolean {
  try {
    return Boolean(sessionStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export function forgetTestWallet() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

/**
 * A throwaway testnet key for visitors without a wallet. It is kept only in
 * this tab's session storage and disappears when the tab closes. The Stellar
 * SDK is loaded only when someone picks this path.
 */
export async function testWalletSigner(): Promise<Signer> {
  const { Keypair, Networks, TransactionBuilder } = await import("@stellar/stellar-sdk");
  let secret: string | null = null;
  try {
    secret = sessionStorage.getItem(KEY);
  } catch {}
  const kp = secret ? Keypair.fromSecret(secret) : Keypair.random();
  try {
    sessionStorage.setItem(KEY, kp.secret());
  } catch {}
  return {
    kind: "temp",
    address: kp.publicKey(),
    async signTx(xdr) {
      const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
      tx.sign(kp);
      return tx.toXDR();
    },
    // Same as a wallet's signAuthEntry: ed25519 over sha256 of the preimage.
    async signAuth(preimage) {
      const payload = new Uint8Array(await crypto.subtle.digest("SHA-256", fromBase64(preimage)));
      return { signature: toBase64(new Uint8Array(kp.sign(payload as unknown as Buffer))), signerAddress: kp.publicKey() };
    },
  };
}
