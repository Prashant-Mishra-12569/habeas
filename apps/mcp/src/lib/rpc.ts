import { Account, BASE_FEE, Contract, TransactionBuilder, rpc, scValToNative, type xdr } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, rpcUrls, type Network } from "../config.ts";
import { ErrorCode, McpToolError } from "./errors.ts";
import { logger } from "./logger.ts";

/** The contract ran and refused. Carries the raw diagnostic text. */
export class SimulationError extends Error {
  raw: string;
  constructor(raw: string) {
    super(raw.split("\n")[0]);
    this.name = "SimulationError";
    this.raw = raw;
  }
}

/** Any valid account can be the source of a simulation. This is the all-zero key. */
export const SIM_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

const clients = new Map<string, rpc.Server>();
export function rpcClient(url: string): rpc.Server {
  let c = clients.get(url);
  if (!c) {
    c = new rpc.Server(url, { allowHttp: url.startsWith("http://") });
    clients.set(url, c);
  }
  return c;
}

/** Races a call against a timeout and clears the timer, so nothing keeps the process alive. */
export async function withTimeout<T>(fn: () => Promise<T>, ms = 30_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new McpToolError("RPC request timed out. The network may be congested or unreachable.", ErrorCode.NETWORK_TIMEOUT, { timeoutMs: ms })), ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs `fn` against the network's RPC servers in order and moves to the next
 * one only when a server can't be reached. A refusal from a contract is an
 * answer, not an outage, so it is never retried elsewhere.
 */
export async function withRpc<T>(network: Network, fn: (server: rpc.Server) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const url of rpcUrls(network)) {
    try {
      return await withTimeout(() => fn(rpcClient(url)));
    } catch (e) {
      if (e instanceof SimulationError) throw e;
      if (e instanceof McpToolError && e.code !== ErrorCode.NETWORK_TIMEOUT) throw e;
      logger.warn({ url, err: e }, "RPC server failed, trying the next one");
      last = e;
    }
  }
  const message = last instanceof Error ? last.message : String(last);
  if (last instanceof McpToolError) throw last;
  throw new McpToolError(`Couldn't reach a Stellar ${network} RPC server (${message}).`, ErrorCode.NETWORK_UNREACHABLE, { network });
}

/** Calls a contract function through simulation: free, read-only, no signature. */
export async function simulateRead(
  network: Network,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  source = SIM_SOURCE,
): Promise<unknown> {
  return withRpc(network, async (server) => {
    const tx = new TransactionBuilder(new Account(source, "0"), { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE[network] })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new SimulationError(sim.error);
    if (!sim.result) throw new McpToolError(`${method} returned nothing.`, ErrorCode.CONTRACT_INVOCATION_FAILED);
    return scValToNative(sim.result.retval);
  });
}

export async function getNetworkHealth(network: Network): Promise<{ status: string; latestLedger: number; protocolVersion: number | null }> {
  return withRpc(network, async (server) => {
    const health = (await server.getHealth()) as { status: string };
    const ledger = (await server.getLatestLedger()) as { sequence: number; protocolVersion?: number | string };
    return {
      status: health.status,
      latestLedger: ledger.sequence,
      protocolVersion: ledger.protocolVersion === undefined ? null : Number(ledger.protocolVersion),
    };
  });
}

/** SHA-256 of a contract's wasm, which is also its on-chain wasm hash. Null for built-in contracts such as a token (SAC). */
export async function contractWasmHash(network: Network, contractId: string): Promise<string | null> {
  const { createHash } = await import("node:crypto");
  return withRpc(network, async (server) => {
    try {
      const wasm = await server.getContractWasmByContractId(contractId);
      return createHash("sha256").update(wasm).digest("hex");
    } catch (e) {
      if (/not found|wasm|executable/i.test((e as Error).message)) return null;
      throw e;
    }
  });
}
