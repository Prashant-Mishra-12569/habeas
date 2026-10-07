import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';
import { horizonGet } from '../lib/horizon.ts';
import { logger } from '../lib/logger.ts';
import { ErrorCode, McpToolError, toolError, toolResult, type ToolResponse } from '../lib/errors.ts';

export const GetAccountInfoInputSchema = z.object({
  public_key: z
    .string()
    .refine((k) => StrKey.isValidEd25519PublicKey(k), { message: 'Must be a valid Stellar public key (G..., 56 characters)' })
    .describe('Stellar account public key (starts with G)'),
  network: z.enum(['testnet', 'futurenet', 'mainnet']).default('testnet').describe('Network to query'),
});

export type GetAccountInfoInput = z.infer<typeof GetAccountInfoInputSchema>;

type HorizonAccount = {
  sequence: string;
  subentry_count: number;
  last_modified_ledger: number;
  home_domain?: string;
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  flags: { auth_required: boolean; auth_revocable: boolean; auth_immutable: boolean; auth_clawback_enabled: boolean };
  balances: { asset_type: string; asset_code?: string; asset_issuer?: string; balance: string; is_authorized?: boolean }[];
  signers: { key: string; type: string; weight: number }[];
};

export async function getAccountInfo(input: GetAccountInfoInput) {
  const { public_key, network } = input;
  logger.info({ publicKey: public_key, network }, 'Fetching account info');
  let a: HorizonAccount;
  try {
    a = await horizonGet<HorizonAccount>(network, `/accounts/${public_key}`);
  } catch (err) {
    if (err instanceof McpToolError && err.code === ErrorCode.NOT_FOUND) {
      throw new McpToolError(
        `Account ${public_key} not found on ${network}. It may not be funded yet.` +
          (network === 'testnet' ? ` Fund it at https://friendbot.stellar.org/?addr=${public_key}` : ''),
        ErrorCode.ACCOUNT_NOT_FOUND,
        { publicKey: public_key, network },
      );
    }
    throw err;
  }
  return {
    publicKey: public_key,
    network,
    balances: a.balances.map((b) => ({
      asset: b.asset_type === 'native' ? 'XLM (native)' : `${b.asset_code ?? 'unknown'}:${b.asset_issuer ?? 'unknown'}`,
      balance: b.balance,
      ...(b.is_authorized === false ? { frozen: true } : {}),
    })),
    sequenceNumber: a.sequence,
    subentryCount: a.subentry_count,
    thresholds: { lowThreshold: a.thresholds.low_threshold, medThreshold: a.thresholds.med_threshold, highThreshold: a.thresholds.high_threshold },
    signers: a.signers.map((s) => ({ key: s.key, type: s.type, weight: s.weight })),
    // The issuer powers Habeas is about: can this account freeze balances or take tokens back?
    issuerFlags: {
      canFreeze: a.flags.auth_revocable,
      canTakeBack: a.flags.auth_clawback_enabled,
      approvalRequired: a.flags.auth_required,
      locked: a.flags.auth_immutable,
    },
    homeDomain: a.home_domain ?? null,
    lastModifiedLedger: a.last_modified_ledger,
  };
}

export async function getAccountInfoHandler(rawInput: unknown): Promise<ToolResponse> {
  try {
    return toolResult(await getAccountInfo(GetAccountInfoInputSchema.parse(rawInput)));
  } catch (err) {
    return toolError(err);
  }
}
