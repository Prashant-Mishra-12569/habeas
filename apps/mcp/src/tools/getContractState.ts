import { Contract, StrKey, scValToNative, xdr } from "@stellar/stellar-sdk";
import { z } from "zod";
import { NETWORK_PASSPHRASE } from "../config.ts";
import { ErrorCode, McpToolError, toolError, toolResult, type ToolResponse } from "../lib/errors.ts";
import { withRpc } from "../lib/rpc.ts";

export const GetContractStateInputSchema = z.object({
  contract_id: z
    .string()
    .refine((k) => StrKey.isValidContract(k), { message: "Must be a valid contract ID (C..., 56 characters)" })
    .describe('Contract ID (starts with "C")'),
  network: z.enum(["testnet", "futurenet", "mainnet"]).default("testnet").describe("Network to query"),
  include_methods: z
    .boolean()
    .default(true)
    .describe("Also read the contract's spec: its method names, parameters and return types. Slower, because it downloads the wasm."),
  storage_limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("How many entries of the contract's own instance storage to return."),
});

type Entry = { key: unknown; value: unknown };

/** One storage entry, converted to plain JSON, falling back to XDR if it cannot be read. */
function readEntry(entry: xdr.ScMapEntry): Entry {
  const plain = (v: xdr.ScVal): unknown => {
    try {
      return scValToNative(v);
    } catch {
      return v.toXdr("base64");
    }
  };
  return { key: plain(entry.key), value: plain(entry.val) };
}

/**
 * What a contract holds on chain right now: its instance entry (which is also
 * how long it is still paid for), what it stores in its own instance storage,
 * and its spec. Read the instance entry directly with getLedgerEntries rather
 * than guessing at XDR, because SDK 17 replaced the old accessor methods with
 * properties.
 */
export async function getContractStateHandler(rawInput: unknown): Promise<ToolResponse> {
  try {
    const { contract_id, network, include_methods, storage_limit } = GetContractStateInputSchema.parse(rawInput);

    const state = await withRpc(network, async (server) => {
      const footprint = new Contract(contract_id).getFootprint();
      const { entries, latestLedger } = await server.getLedgerEntries(footprint);
      const entry = entries[0];
      if (!entry?.val) return null;
      if (entry.val.type !== "contractData") {
        throw new McpToolError(`That address holds a ${entry.val.type} ledger entry, not a contract instance.`, ErrorCode.CONTRACT_NOT_FOUND);
      }
      const value = entry.val.value.val;
      if (value.type !== "scvContractInstance") {
        throw new McpToolError(
          "That ledger entry holds no contract instance, so nothing is deployed at that address on this network.",
          ErrorCode.CONTRACT_NOT_FOUND,
        );
      }

      const instance = value.value;
      const executable =
        instance.executable.type === "contractExecutableWasm"
          ? { type: "wasm contract", wasmSha256: instance.executable.wasmHash.toString() }
          : instance.executable.type === "contractExecutableStellarAsset"
            ? { type: "built-in contract (Stellar Asset Contract, a token), no wasm of its own", wasmSha256: null }
            : { type: "wasm held by another contract (external reference)", wasmSha256: null };

      const storageAll = instance.storage ?? [];
      const liveUntilLedgerSeq = entry.liveUntilLedgerSeq ?? null;

      let methods: { name: string; inputs: { name: string; type: string }[]; outputs: string[]; doc?: string }[] | null = null;
      let methodsError: string | null = null;
      if (include_methods) {
        try {
          methods = await server.getContractMethods(contract_id, NETWORK_PASSPHRASE[network]);
        } catch (e) {
          methodsError = e instanceof Error ? e.message.split("\n")[0] : String(e);
        }
      }

      return {
        contractId: contract_id,
        network,
        latestLedger,
        lastModifiedLedgerSeq: entry.lastModifiedLedgerSeq ?? null,
        liveUntilLedgerSeq,
        ledgersUntilItExpires: liveUntilLedgerSeq === null ? null : liveUntilLedgerSeq - latestLedger,
        executable,
        instanceStorage: {
          count: storageAll.length,
          entries: storageAll.slice(0, storage_limit).map(readEntry),
          ...(storageAll.length > storage_limit ? { more: storageAll.length - storage_limit, hint: `Raise storage_limit up to 50 to see ${storageAll.length - storage_limit} more.` } : {}),
        },
        ...(methods === null
          ? include_methods
            ? { methods: [], methodsError }
            : { methods: null, methodsNote: "Not read: include_methods was false." }
          : { methods: methods.slice(0, 50), methodCount: methods.length, ...(methods.length > 50 ? { methodsTruncated: methods.length - 50 } : {}) }),
      };
    });

    if (!state) throw new McpToolError(`There is no contract with that address on ${network}.`, ErrorCode.CONTRACT_NOT_FOUND);
    return toolResult(state);
  } catch (err) {
    return toolError(err);
  }
}
