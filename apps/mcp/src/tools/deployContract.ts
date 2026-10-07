import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import { runCli } from '../lib/cli.ts';
import { logger } from '../lib/logger.ts';
import { ErrorCode, McpToolError, toolError, toolResult, type ToolResponse } from '../lib/errors.ts';

export const DeployContractInputSchema = z.object({
  wasm_path: z.string().min(1).describe('Path to the compiled .wasm file to deploy'),
  network: z
    .enum(['testnet', 'futurenet'])
    .default('testnet')
    .describe('Target network (mainnet deployments are not supported by this tool for safety)'),
  source_account: z
    .string()
    .min(1)
    .refine((v) => !/^S[A-Z2-7]{55}$/.test(v), {
      message: 'Pass the name of a stellar-cli key (see `stellar keys ls`), never a secret key: secrets must not pass through a model or a command line.',
    })
    .describe('Name of a key in the stellar-cli config that pays for deployment (not a secret key)'),
  ignore_checks: z
    .boolean()
    .default(false)
    .describe('Pass --ignore-checks to stellar contract deploy (skip safety warnings)'),
});

export type DeployContractInput = z.infer<typeof DeployContractInputSchema>;

export interface DeployContractResult {
  success: boolean;
  contractId: string | undefined;
  transactionHash: string | undefined;
  network: string;
  wasmHash: string | undefined;
}

export async function deployContract(input: DeployContractInput): Promise<DeployContractResult> {
  const parsed = DeployContractInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new McpToolError(
      `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      ErrorCode.CLI_EXECUTION_FAILED,
    );
  }

  const { wasm_path, network, source_account, ignore_checks } = parsed.data;
  const resolvedWasm = path.resolve(wasm_path);

  // Verify the .wasm file exists
  try {
    const stat = await fs.stat(resolvedWasm);
    if (!resolvedWasm.endsWith('.wasm')) {
      throw new McpToolError(
        `File "${resolvedWasm}" does not have a .wasm extension. Run build_contract first.`,
        ErrorCode.INVALID_WASM,
      );
    }
    if (stat.size === 0) {
      throw new McpToolError(
        `WASM file "${resolvedWasm}" is empty. Re-run build_contract.`,
        ErrorCode.INVALID_WASM,
      );
    }
  } catch (err) {
    if (err instanceof McpToolError) throw err;
    throw new McpToolError(
      `WASM file not found at "${resolvedWasm}". Run build_contract first.`,
      ErrorCode.WASM_NOT_FOUND,
    );
  }

  logger.info({ wasmPath: resolvedWasm, network }, 'Deploying contract');

  const args = [
    'contract',
    'deploy',
    '--wasm',
    resolvedWasm,
    '--source-account',
    source_account,
    '--network',
    network,
  ];

  if (ignore_checks) args.push('--ignore-checks');

  const result = await runCli(args, { timeout: 120_000 });

  if (result.exitCode !== 0) {
    const combinedOutput = `${result.stdout}\n${result.stderr}`;

    if (/insufficient balance|fee|xlm/i.test(combinedOutput)) {
      throw new McpToolError(
        `Deployment failed due to insufficient balance. Fund the account and retry. ` +
          `For testnet: https://friendbot.stellar.org`,
        ErrorCode.INSUFFICIENT_BALANCE,
        { stderr: result.stderr.slice(0, 500) },
      );
    }

    if (/invalid secret|invalid key|secret key/i.test(combinedOutput)) {
      throw new McpToolError(
        `Invalid source account key. Provide a valid Stellar secret key (starts with S) or a configured account name.`,
        ErrorCode.CLI_EXECUTION_FAILED,
        { stderr: result.stderr.slice(0, 500) },
      );
    }

    throw new McpToolError(
      `Contract deployment failed: ${result.stderr.slice(0, 500)}`,
      ErrorCode.CLI_EXECUTION_FAILED,
      { exitCode: result.exitCode, stderr: result.stderr.slice(0, 1000) },
    );
  }

  // The CLI prints the contract ID on stdout
  const contractId = result.stdout.trim().split('\n').pop()?.trim();

  if (!contractId || contractId.length !== 56 || !contractId.startsWith('C')) {
    logger.warn({ stdout: result.stdout }, 'Could not parse contract ID from output');
  }

  // Extract transaction hash from stderr (stellar CLI logs it there)
  const txHashMatch = result.stderr.match(/[0-9a-f]{64}/i);
  const transactionHash = txHashMatch ? txHashMatch[0] : undefined;

  logger.info({ contractId, transactionHash }, 'Contract deployed successfully');

  return {
    success: true,
    contractId,
    transactionHash,
    network,
    wasmHash: undefined,
  };
}

export async function deployContractHandler(
  rawInput: unknown,
): Promise<ToolResponse> {
  try {
    const input = DeployContractInputSchema.parse(rawInput);
    const result = await deployContract(input);
    return toolResult(result);
  } catch (err) {
    return toolError(err);
  }
}
