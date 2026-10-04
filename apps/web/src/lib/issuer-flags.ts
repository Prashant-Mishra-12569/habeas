import "server-only";
import { NotFoundError, horizon, type Network } from "./network";

export type IssuerFlags = { revocable: boolean; clawback: boolean };

/** Can the issuer freeze or take back? One Horizon read, fast enough for page metadata and share cards. */
export async function issuerFlags(network: Network, issuer: string): Promise<IssuerFlags> {
  const a = await horizon<{ flags: { auth_revocable: boolean; auth_clawback_enabled: boolean } }>(network, `/accounts/${issuer}`);
  return { revocable: a.flags.auth_revocable, clawback: a.flags.auth_clawback_enabled };
}

/** For callers that don't know the network (share images get no query string): mainnet first, then testnet. */
export async function issuerFlagsAnyNetwork(issuer: string): Promise<{ network: Network; flags: IssuerFlags } | null> {
  for (const network of ["mainnet", "testnet"] as const) {
    try {
      return { network, flags: await issuerFlags(network, issuer) };
    } catch (e) {
      if (!(e instanceof NotFoundError)) return null;
    }
  }
  return null;
}
