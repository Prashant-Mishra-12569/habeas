import { StrKey } from '@stellar/stellar-sdk';
import { rpcUrls, type Network } from '../config.ts';
import { getNetworkHealth, withRpc } from '../lib/rpc.ts';
import { logger } from '../lib/logger.ts';
import { ErrorCode, McpToolError } from '../lib/errors.ts';

export interface NetworkStatus {
  network: string;
  status: string;
  latestLedger: number;
  protocolVersion: number | null;
  rpcUrl: string;
}

export interface TransactionHistoryEntry {
  id: string;
  ledger: number;
  createdAt: string;
}

/** Current network status. Falls back to "unknown" rather than failing the read. */
export async function getNetworkStatusResource(network: Network): Promise<NetworkStatus> {
  const rpcUrl = rpcUrls(network)[0]!;
  try {
    const h = await getNetworkHealth(network);
    return { network, status: h.status, latestLedger: h.latestLedger, protocolVersion: h.protocolVersion, rpcUrl };
  } catch (err) {
    logger.warn({ network, err }, 'Failed to get network health');
    return { network, status: 'unknown', latestLedger: 0, protocolVersion: null, rpcUrl };
  }
}

/**
 * Recent transactions that touched a contract, found through its events. RPC
 * keeps only about 7 days, so this is a recent window, not full history.
 */
export async function getContractTransactionsResource(contractId: string, network: Network, limit = 20): Promise<TransactionHistoryEntry[]> {
  if (!StrKey.isValidContract(contractId)) {
    throw new McpToolError(`Invalid contract ID: "${contractId}".`, ErrorCode.INVALID_CONTRACT_ID);
  }
  return withRpc(network, async (server) => {
    const { sequence } = await server.getLatestLedger();
    const page = await server.getEvents({
      startLedger: Math.max(1, sequence - 1000),
      filters: [{ type: 'contract', contractIds: [contractId] }],
      limit,
    });
    const seen = new Map<string, TransactionHistoryEntry>();
    for (const e of page.events) {
      if (!seen.has(e.txHash)) seen.set(e.txHash, { id: e.txHash, ledger: e.ledger, createdAt: e.ledgerClosedAt });
    }
    return [...seen.values()].slice(0, limit);
  });
}
