import { z } from 'zod';
import { Account, Address, BASE_FEE, Contract, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from '../config.ts';
import { SIM_SOURCE, SimulationError, withRpc } from '../lib/rpc.ts';
import { logger } from '../lib/logger.ts';
import { ErrorCode, McpToolError, toolError, toolResult, type ToolResponse } from '../lib/errors.ts';

const INT_TYPES = ['u32', 'i32', 'u64', 'i64', 'u128', 'i128'] as const;
type IntType = (typeof INT_TYPES)[number];
const isIntType = (t: string): t is IntType => (INT_TYPES as readonly string[]).includes(t);

/**
 * An argument is a plain JSON value or {type, value}. Contracts are strict
 * about integer widths (Habeas's case numbers are u64), so say the type:
 * {"type": "u64", "value": "7"}. Plain numbers default to i128, as before.
 * Types: u32 i32 u64 i64 u128 i128 address bytes (hex) symbol string bool.
 */
export const InvokeContractInputSchema = z.object({
  contract_id: z
    .string()
    .refine((k) => StrKey.isValidContract(k), { message: 'Must be a valid contract ID (C..., 56 characters)' })
    .describe('Contract ID (starts with C)'),
  function_name: z.string().min(1).describe('Name of the contract function to call'),
  args: z
    .array(z.unknown())
    .default([])
    .describe('Arguments. Plain JSON values, or {"type": "u64"|"i128"|"address"|"bytes"|"symbol"|"string"|"bool"|..., "value": ...} when the exact type matters'),
  network: z.enum(['testnet', 'futurenet', 'mainnet']).default('testnet').describe('Network to simulate on'),
  source_account: z.string().optional().describe('Optional account address used as the simulation source. Nothing is signed or sent.'),
});

export type InvokeContractInput = z.infer<typeof InvokeContractInputSchema>;

const bad = (message: string) => new McpToolError(message, ErrorCode.CONTRACT_INVOCATION_FAILED);

export function jsToScVal(value: unknown): xdr.ScVal {
  if (typeof value === 'boolean') return nativeToScVal(value);
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw bad(`Numbers must be whole: ${value}`);
    return nativeToScVal(BigInt(value), { type: 'i128' });
  }
  if (typeof value === 'bigint') return nativeToScVal(value, { type: 'i128' });
  if (typeof value === 'string') return nativeToScVal(value, { type: 'string' });
  if (Array.isArray(value)) return xdr.ScVal.scvVec(value.map(jsToScVal));
  if (value && typeof value === 'object') {
    const { type, value: v } = value as { type?: unknown; value?: unknown };
    if (typeof type === 'string') {
      if (isIntType(type)) {
        if (typeof v !== 'string' && typeof v !== 'number') throw bad(`${type} needs a number or a numeric string as its value`);
        return nativeToScVal(type === 'u32' || type === 'i32' ? Number(v) : BigInt(v), { type });
      }
      if (type === 'address' && typeof v === 'string') {
        if (!StrKey.isValidEd25519PublicKey(v) && !StrKey.isValidContract(v)) throw bad(`Not a valid address: ${v}`);
        return new Address(v).toScVal();
      }
      if (type === 'bytes' && typeof v === 'string') {
        if (!/^([0-9a-f]{2})*$/i.test(v)) throw bad('bytes needs a hex string');
        return xdr.ScVal.scvBytes(Buffer.from(v, 'hex'));
      }
      if (type === 'symbol' && typeof v === 'string') return xdr.ScVal.scvSymbol(v);
      if (type === 'string' && typeof v === 'string') return nativeToScVal(v, { type: 'string' });
      if (type === 'bool' && typeof v === 'boolean') return nativeToScVal(v);
    }
  }
  throw bad(
    'Unsupported argument. Use a number, string, boolean, array, or {"type": "u32|i32|u64|i64|u128|i128|address|bytes|symbol|string|bool", "value": ...}.',
  );
}

/** Simulates the call: free, nothing is signed or sent. Works for reads and shows what a write would do. */
export async function invokeContract(input: InvokeContractInput) {
  const { contract_id, function_name, args, network, source_account } = input;
  logger.info({ contractId: contract_id, functionName: function_name, network }, 'Simulating contract call');

  const scArgs = args.map(jsToScVal);
  const passphrase = NETWORK_PASSPHRASE[network];

  return withRpc(network, async (server) => {
    let source: Account;
    if (source_account) {
      if (!StrKey.isValidEd25519PublicKey(source_account)) throw bad(`Not a valid account address: ${source_account}`);
      source = await server.getAccount(source_account).catch(() => new Account(source_account, '0'));
    } else {
      source = new Account(SIM_SOURCE, '0');
    }
    const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
      .addOperation(new Contract(contract_id).call(function_name, ...scArgs))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new SimulationError(sim.error);
    if (rpc.Api.isSimulationRestore(sim)) {
      throw new McpToolError(
        "The contract's stored state has expired and must be restored before this call can run.",
        ErrorCode.CONTRACT_INVOCATION_FAILED,
        { contractId: contract_id },
      );
    }
    const retval = sim.result?.retval;
    return {
      success: true,
      result: retval === undefined ? null : scValToNative(retval),
      resultXdr: retval?.toXDR('base64'),
      minResourceFee: sim.minResourceFee,
      network,
      contractId: contract_id,
      functionName: function_name,
      note: 'Simulated only. Nothing was signed or sent.',
    };
  });
}

export async function invokeContractHandler(rawInput: unknown): Promise<ToolResponse> {
  try {
    return toolResult(await invokeContract(InvokeContractInputSchema.parse(rawInput)));
  } catch (err) {
    if (err instanceof SimulationError) {
      return toolError(new McpToolError(`The contract refused: ${err.message}`, ErrorCode.CONTRACT_INVOCATION_FAILED, { simulationError: err.raw.split('\n').slice(0, 12).join('\n') }));
    }
    return toolError(err);
  }
}
