import "server-only";
import { createHash } from "node:crypto";
import {
  Account,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  scValToNative,
  type xdr,
} from "@stellar/stellar-sdk";

export type Network = "mainnet" | "testnet";

export const NETWORKS = {
  mainnet: {
    passphrase: Networks.PUBLIC,
    horizon: process.env.MAINNET_HORIZON_URL ?? "https://horizon.stellar.org",
    // Free public endpoints listed in Stellar's docs; the second is a fallback.
    rpc: [process.env.MAINNET_RPC_URL ?? "https://mainnet.sorobanrpc.com", "https://rpc.lightsail.network/"],
    explorer: "public",
  },
  testnet: {
    passphrase: Networks.TESTNET,
    horizon: process.env.TESTNET_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
    rpc: [process.env.TESTNET_RPC_URL ?? "https://soroban-testnet.stellar.org"],
    explorer: "testnet",
  },
} as const;

/** A read from Stellar failed. The message is shown to people, so keep it plain. */
export class ReadError extends Error {}

/** Stellar answered, and has no such account, asset or record. */
export class NotFoundError extends ReadError {}

export async function horizon<T>(network: Network, path: string, revalidate = 60): Promise<T> {
  const url = `${NETWORKS[network].horizon}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate } });
  } catch (e) {
    throw new ReadError(`Couldn't reach Stellar's public Horizon server (${(e as Error).message}).`);
  }
  if (res.status === 404) throw new NotFoundError(`Stellar has no record of that (${path}).`);
  if (!res.ok) throw new ReadError(`Horizon answered ${res.status} for ${path}.`);
  return res.json() as Promise<T>;
}

async function withRpc<T>(network: Network, fn: (server: rpc.Server) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const url of NETWORKS[network].rpc) {
    try {
      return await fn(new rpc.Server(url));
    } catch (e) {
      if (e instanceof SimulationError) throw e;
      last = e;
    }
  }
  throw new ReadError(`Couldn't reach a Stellar ${network} RPC server (${(last as Error)?.message}).`);
}

/** The contract ran and refused; carries the raw diagnostic text. */
export class SimulationError extends Error {
  constructor(public readonly raw: string) {
    super(raw.split("\n")[0]);
  }
}

/**
 * Calls a contract function through simulation: free, read-only, no
 * signature. `source` only needs to be a valid address.
 */
export async function simulateRead(
  network: Network,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  source = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
): Promise<unknown> {
  return withRpc(network, async (server) => {
    const tx = new TransactionBuilder(new Account(source, "0"), {
      fee: BASE_FEE,
      networkPassphrase: NETWORKS[network].passphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new SimulationError(sim.error);
    return scValToNative(sim.result!.retval);
  });
}

/** SHA-256 of a contract's wasm, which is also its on-chain wasm hash. */
export async function contractWasmHash(network: Network, contractId: string): Promise<string | null> {
  return withRpc(network, async (server) => {
    try {
      const wasm = await server.getContractWasmByContractId(contractId);
      return createHash("sha256").update(wasm).digest("hex");
    } catch (e) {
      // Built-in contracts such as a SAC have no wasm.
      if (/not found|wasm|executable/i.test((e as Error).message)) return null;
      throw e;
    }
  });
}
