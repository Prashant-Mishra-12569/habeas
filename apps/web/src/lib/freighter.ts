// Freighter in the browser. Testnet only. Errors come back as plain sentences.
import {
  getAddress,
  getNetworkDetails,
  isConnected,
  requestAccess,
  signAuthEntry,
  signTransaction,
} from "@stellar/freighter-api";

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

export class WalletError extends Error {
  constructor(
    message: string,
    public readonly kind: "missing" | "network" | "declined" | "other" = "other",
  ) {
    super(message);
  }
}

type FreighterError = { message?: string; code?: number } | string | undefined;

function fail(error: FreighterError): never {
  const text = typeof error === "string" ? error : (error?.message ?? "");
  if (/declin|reject|denied|cancel/i.test(text)) throw new WalletError("You declined in Freighter. Nothing was sent.", "declined");
  throw new WalletError(text || "Freighter didn't answer.");
}

/** Asks Freighter for access and returns the account address. Checks it's on Testnet. */
export async function connectFreighter(): Promise<string> {
  const installed = await isConnected();
  if (!installed.isConnected) {
    throw new WalletError("Freighter isn't installed in this browser.", "missing");
  }
  const access = await requestAccess();
  if (access.error) fail(access.error);
  const net = await getNetworkDetails();
  if (net.error) fail(net.error);
  if (net.networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new WalletError(`Freighter is set to ${net.network || "another network"}. Switch it to Testnet and try again.`, "network");
  }
  const { address, error } = await getAddress();
  if (error) fail(error);
  return address || access.address;
}

/** Signs a whole transaction (used only for adding the DEMOUSD trustline). */
export async function signTx(xdr: string, address: string): Promise<string> {
  const r = await signTransaction(xdr, { networkPassphrase: TESTNET_PASSPHRASE, address });
  if (r.error) fail(r.error);
  return r.signedTxXdr;
}

/**
 * Signs only an authorization: Freighter is given the authorization preimage
 * and returns a signature. Nothing is submitted and no fee is paid by the
 * holder. Returns base64.
 */
export async function signAuth(preimageXdr: string, address: string): Promise<{ signature: string; signerAddress: string }> {
  const r = await signAuthEntry(preimageXdr, { networkPassphrase: TESTNET_PASSPHRASE, address });
  if (r.error) fail(r.error);
  const raw = r.signedAuthEntry as unknown;
  if (!raw) throw new WalletError("Freighter returned no signature.");
  // Some Freighter versions return bytes instead of base64.
  const signature =
    typeof raw === "string"
      ? raw
      : btoa(String.fromCharCode(...new Uint8Array((raw as { data?: number[] }).data ?? (raw as ArrayLike<number>))));
  return { signature, signerAddress: r.signerAddress || address };
}
