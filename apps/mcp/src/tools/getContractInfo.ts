import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';
import { contractWasmHash } from '../lib/rpc.ts';
import { toolError, toolResult, type ToolResponse } from '../lib/errors.ts';
import { deployment } from '../habeas/deployment.ts';

export const GetContractInfoInputSchema = z.object({
  contract_id: z
    .string()
    .refine((k) => StrKey.isValidContract(k), { message: 'Must be a valid contract ID (C..., 56 characters)' })
    .describe('Contract ID (starts with C)'),
  network: z.enum(['testnet', 'futurenet', 'mainnet']).default('testnet').describe('Network to query'),
});

/**
 * The SHA-256 of the contract's deployed wasm. Compare it with a verified
 * build to know the code on chain is the code you read. Null means a built-in
 * contract with no wasm, such as a Stellar Asset Contract (a token).
 */
export async function getContractInfoHandler(rawInput: unknown): Promise<ToolResponse> {
  try {
    const { contract_id, network } = GetContractInfoInputSchema.parse(rawInput);
    const wasmSha256 = await contractWasmHash(network, contract_id);
    let habeas: Record<string, unknown> | undefined;
    try {
      const d = deployment();
      if (network === 'testnet' && contract_id === d.habeas) {
        habeas = { isHabeas: true, publishedReleaseSha256: d.wasm_sha256, matchesRelease: wasmSha256 === d.wasm_sha256, source: d.wasm_source };
      }
    } catch {
      // No deployment file: just report the hash.
    }
    return toolResult({
      contractId: contract_id,
      network,
      wasmSha256,
      kind: wasmSha256 === null ? 'built-in (no wasm), such as a token' : 'wasm contract',
      ...(habeas ? { habeas } : {}),
    });
  } catch (err) {
    return toolError(err);
  }
}
