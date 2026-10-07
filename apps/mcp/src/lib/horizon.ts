import { HORIZON_URLS, type Network } from "../config.ts";
import { ErrorCode, McpToolError } from "./errors.ts";

/** GET a Horizon path as JSON. A 404 becomes NOT_FOUND so callers can say what is missing. */
export async function horizonGet<T>(network: Network, path: string): Promise<T> {
  const url = `${HORIZON_URLS[network]}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { accept: "application/json" } });
  } catch (e) {
    throw new McpToolError(`Couldn't reach Stellar's Horizon server for ${network} (${(e as Error).message}).`, ErrorCode.NETWORK_UNREACHABLE, { network });
  }
  if (res.status === 404) throw new McpToolError(`Stellar has no record of that (${path}).`, ErrorCode.NOT_FOUND, { network, path });
  if (!res.ok) throw new McpToolError(`Horizon answered ${res.status} for ${path}.`, ErrorCode.RPC_ERROR, { network, status: res.status });
  return (await res.json()) as T;
}
