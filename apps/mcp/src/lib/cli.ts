import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.ts';
import { logger } from './logger.ts';
import { ErrorCode, McpToolError } from './errors.ts';

const execFileAsync = promisify(execFile);

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CliOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string | undefined>;
}

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes for builds

/**
 * Executes a Soroban/Stellar CLI command and returns structured output.
 * Never throws on non-zero exit — callers inspect exitCode themselves.
 */
export async function runCli(args: string[], options: CliOptions = {}): Promise<CliResult> {
  const cliPath = config.SOROBAN_CLI_PATH;
  const { timeout = DEFAULT_TIMEOUT_MS, cwd, env } = options;

  logger.debug({ cmd: cliPath, args, cwd }, 'Running CLI command');

  try {
    const { stdout, stderr } = await execFileAsync(cliPath, args, {
      timeout,
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    });
    logger.debug({ stdout: stdout.slice(0, 500), stderr: stderr.slice(0, 500) }, 'CLI succeeded');
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as Error & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };

    if (e.code === 'ENOENT') {
      throw new McpToolError(
        `CLI binary not found at "${cliPath}". Install stellar-cli or set SOROBAN_CLI_PATH.`,
        ErrorCode.CLI_NOT_FOUND,
      );
    }

    if (e.code === 'ETIMEDOUT') {
      throw new McpToolError(
        `CLI command timed out after ${timeout}ms.`,
        ErrorCode.NETWORK_TIMEOUT,
      );
    }

    // Non-zero exit: return stdout/stderr for caller to parse
    const stdout = e.stdout ?? '';
    const stderr = e.stderr ?? '';
    const exitCode = typeof e.code === 'number' ? e.code : 1;

    logger.debug({ exitCode, stderr: stderr.slice(0, 500) }, 'CLI exited non-zero');
    return { stdout, stderr, exitCode };
  }
}

/**
 * Runs `cargo test` in the given project directory.
 */
export async function runCargoTest(projectPath: string): Promise<CliResult> {
  logger.debug({ projectPath }, 'Running cargo test');

  try {
    const { stdout, stderr } = await execFileAsync(
      'cargo',
      ['test', '--', '--test-output', 'immediate'],
      {
        timeout: DEFAULT_TIMEOUT_MS,
        cwd: projectPath,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as Error & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };

    if (e.code === 'ENOENT') {
      throw new McpToolError(
        'cargo not found. Install Rust from https://rustup.rs',
        ErrorCode.CLI_NOT_FOUND,
      );
    }

    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}
