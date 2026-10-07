import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import { runCli } from '../lib/cli.ts';
import { logger } from '../lib/logger.ts';
import { ErrorCode, McpToolError, toolError, toolResult, type ToolResponse } from '../lib/errors.ts';

export const BuildContractInputSchema = z.object({
  project_path: z
    .string()
    .min(1)
    .describe(
      'Absolute or relative path to the Soroban contract project directory (contains Cargo.toml)',
    ),
  network: z
    .enum(['testnet', 'futurenet', 'mainnet'])
    .default('testnet')
    .describe('Target network for the build'),
});

export type BuildContractInput = z.infer<typeof BuildContractInputSchema>;

export interface CompilerDiagnostic {
  level: 'error' | 'warning' | 'note';
  message: string;
  file: string | undefined;
  line: number | undefined;
  column: number | undefined;
  errorCode: string | undefined;
}

export interface BuildContractResult {
  success: boolean;
  wasmPath: string | undefined;
  wasmSizeBytes: number | undefined;
  diagnostics: CompilerDiagnostic[];
  rawOutput: string | undefined;
}

/**
 * Parses rustc/cargo JSON diagnostic lines from stderr.
 * cargo build --message-format=json emits one JSON object per line.
 */
function parseDiagnostics(stderr: string, stdout: string): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];

  // Try JSON message format first (from --message-format=json)
  const lines = [...stderr.split('\n'), ...stdout.split('\n')];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;

    try {
      const msg = JSON.parse(trimmed) as Record<string, unknown>;
      if (msg['reason'] !== 'compiler-message') continue;

      const msgInner = msg['message'] as Record<string, unknown> | undefined;
      if (!msgInner) continue;

      const level = (msgInner['level'] as string) ?? 'error';
      const text = (msgInner['message'] as string) ?? '';
      const code = (msgInner['code'] as Record<string, string> | null)?.code;

      const spans = (msgInner['spans'] as Array<Record<string, unknown>>) ?? [];
      const primarySpan = spans.find((s) => s['is_primary']) ?? spans[0];

      diagnostics.push({
        level: level === 'warning' ? 'warning' : level === 'note' ? 'note' : 'error',
        message: text,
        file: primarySpan ? String(primarySpan['file_name']) : undefined,
        line: primarySpan ? Number(primarySpan['line_start']) : undefined,
        column: primarySpan ? Number(primarySpan['column_start']) : undefined,
        errorCode: code,
      });
    } catch {
      // Not valid JSON, skip
    }
  }

  if (diagnostics.length > 0) return diagnostics;

  // Fallback: parse human-readable rustc output
  // Matches: error[E0XXX]: message  OR  error: message
  const errorPattern = /^(error|warning|note)(\[([A-Z]\d+)\])?: (.+)$/m;
  // Matches:   --> src/lib.rs:10:5
  const locationPattern = /-->\s+(.+):(\d+):(\d+)/;

  const blocks = stderr.split(/\n(?=error|warning|note)/);
  for (const block of blocks) {
    const errMatch = block.match(errorPattern);
    if (!errMatch) continue;

    const level = errMatch[1] as 'error' | 'warning' | 'note';
    const errorCode = errMatch[3];
    const message = errMatch[4] ?? '';

    const locMatch = block.match(locationPattern);

    diagnostics.push({
      level,
      message: message.trim(),
      file: locMatch ? locMatch[1] : undefined,
      line: locMatch ? parseInt(locMatch[2]!, 10) : undefined,
      column: locMatch ? parseInt(locMatch[3]!, 10) : undefined,
      errorCode,
    });
  }

  return diagnostics;
}

export async function buildContract(input: BuildContractInput): Promise<BuildContractResult> {
  const parsed = BuildContractInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new McpToolError(
      `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      ErrorCode.BUILD_FAILED,
    );
  }

  const { project_path } = parsed.data;
  const resolvedPath = path.resolve(project_path);

  // Verify the project directory exists and has a Cargo.toml
  try {
    await fs.access(path.join(resolvedPath, 'Cargo.toml'));
  } catch {
    throw new McpToolError(
      `No Cargo.toml found in "${resolvedPath}". Make sure project_path points to a Rust/Soroban project.`,
      ErrorCode.BUILD_FAILED,
    );
  }

  logger.info({ projectPath: resolvedPath }, 'Building Soroban contract');

  const result = await runCli(
    ['contract', 'build', '--manifest-path', path.join(resolvedPath, 'Cargo.toml')],
    { cwd: resolvedPath, timeout: 300_000 }, // 5 min for first build
  );

  const diagnostics = parseDiagnostics(result.stderr, result.stdout);

  if (result.exitCode !== 0) {
    logger.warn({ exitCode: result.exitCode, diagnostics }, 'Build failed');
    return {
      success: false,
      wasmPath: undefined,
      wasmSizeBytes: undefined,
      diagnostics,
      rawOutput: result.stderr.slice(0, 2000),
    };
  }

  // Find the output .wasm file
  const targetDir = path.join(resolvedPath, 'target', 'wasm32-unknown-unknown', 'release');
  let wasmPath: string | undefined;
  let wasmSizeBytes: number | undefined;

  try {
    const files = await fs.readdir(targetDir);
    const wasmFiles = files.filter((f) => f.endsWith('.wasm') && !f.endsWith('.d'));
    if (wasmFiles.length > 0) {
      wasmPath = path.join(targetDir, wasmFiles[0]!);
      const stat = await fs.stat(wasmPath);
      wasmSizeBytes = stat.size;
    }
  } catch {
    // Target dir might not exist yet — build may have placed it elsewhere
  }

  logger.info({ wasmPath, wasmSizeBytes }, 'Build succeeded');

  return {
    success: true,
    wasmPath,
    wasmSizeBytes,
    diagnostics: diagnostics.filter((d) => d.level !== 'error'),
    rawOutput: undefined,
  };
}

export async function buildContractHandler(
  rawInput: unknown,
): Promise<ToolResponse> {
  try {
    const input = BuildContractInputSchema.parse(rawInput);
    const result = await buildContract(input);
    return toolResult(result);
  } catch (err) {
    return toolError(err);
  }
}
