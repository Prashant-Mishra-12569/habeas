import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../lib/logger.ts';
import { ErrorCode, McpToolError, toolError, toolResult, type ToolResponse } from '../lib/errors.ts';

export const RunTestsInputSchema = z.object({
  project_path: z
    .string()
    .min(1)
    .describe(
      'Absolute or relative path to the Soroban contract project directory (contains Cargo.toml)',
    ),
  filter: z
    .string()
    .optional()
    .describe('Optional test name filter — passed to `cargo test <filter>`'),
});

export type RunTestsInput = z.infer<typeof RunTestsInputSchema>;

export type TestStatus = 'passed' | 'failed' | 'ignored';

export interface TestResult {
  name: string;
  status: TestStatus;
  /** Duration in milliseconds, if available */
  durationMs: number | undefined;
  /** Failure message / panic output, if the test failed */
  message: string | undefined;
}

export interface RunTestsResult {
  success: boolean;
  total: number;
  passed: number;
  failed: number;
  ignored: number;
  tests: TestResult[];
  /** Raw output snippet, present only on hard failures */
  rawOutput?: string;
}

/**
 * Parses `cargo test` output (human-readable format).
 *
 * Example lines:
 *   test test_hello ... ok
 *   test test_fail  ... FAILED
 *   test test_skip  ... ignored
 *
 * Failure detail block:
 *   failures:
 *   ---- test_fail stdout ----
 *   thread 'test_fail' panicked at 'assertion failed', src/lib.rs:20
 */
function parseCargoTestOutput(stdout: string, stderr: string): Omit<RunTestsResult, 'success'> {
  const combined = stdout + '\n' + stderr;
  const lines = combined.split('\n');

  const tests: TestResult[] = [];
  const failureMessages: Map<string, string[]> = new Map();

  // Parse test result lines
  const testLineRe = /^test (.+?) \.\.\. (ok|FAILED|ignored)(?:\s+<(\d+)ms>)?$/;

  for (const line of lines) {
    const match = line.trim().match(testLineRe);
    if (match) {
      const name = match[1]!.trim();
      const rawStatus = match[2]!;
      const durationMs = match[3] ? parseInt(match[3], 10) : undefined;

      const status: TestStatus =
        rawStatus === 'ok' ? 'passed' : rawStatus === 'FAILED' ? 'failed' : 'ignored';

      tests.push({ name, status, durationMs, message: undefined });
    }
  }

  // Parse failure detail blocks
  // Format:
  //   ---- <test_name> stdout ----
  //   <lines of output>
  //   (blank line or next section)
  let inFailureSection = false;
  let currentTestName: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('failures:')) {
      inFailureSection = true;
      continue;
    }

    if (!inFailureSection) continue;

    const headerMatch = line.match(/^-{4} (.+?) stdout -{4}$/);
    if (headerMatch) {
      // Save previous
      if (currentTestName && currentLines.length > 0) {
        failureMessages.set(currentTestName, currentLines);
      }
      currentTestName = headerMatch[1]!.trim();
      currentLines = [];
      continue;
    }

    // End of failure section
    if (line.startsWith('test result:')) {
      if (currentTestName && currentLines.length > 0) {
        failureMessages.set(currentTestName, currentLines);
      }
      break;
    }

    if (currentTestName) {
      currentLines.push(line);
    }
  }

  // Attach failure messages to test results
  for (const test of tests) {
    if (test.status === 'failed') {
      const msgLines = failureMessages.get(test.name);
      if (msgLines) {
        test.message = msgLines
          .filter((l) => l.trim())
          .join('\n')
          .trim();
      }
    }
  }

  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = tests.filter((t) => t.status === 'failed').length;
  const ignored = tests.filter((t) => t.status === 'ignored').length;

  return { total: tests.length, passed, failed, ignored, tests };
}

export async function runTests(input: RunTestsInput): Promise<RunTestsResult> {
  const parsed = RunTestsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new McpToolError(
      `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      ErrorCode.TEST_EXECUTION_FAILED,
    );
  }

  const { project_path, filter } = parsed.data;
  const resolvedPath = path.resolve(project_path);

  try {
    await fs.access(path.join(resolvedPath, 'Cargo.toml'));
  } catch {
    throw new McpToolError(
      `No Cargo.toml found in "${resolvedPath}". Make sure project_path points to a Rust/Soroban project.`,
      ErrorCode.TEST_EXECUTION_FAILED,
    );
  }

  logger.info({ projectPath: resolvedPath, filter }, 'Running contract tests');

  // runCargoTest respects the filter by appending it if set
  const result = await (async (): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> => {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const args = ['test'];
    if (filter) args.push(filter);
    args.push('--', '--test-output', 'immediate');

    try {
      const { stdout, stderr } = await execFileAsync('cargo', args, {
        timeout: 120_000,
        cwd: resolvedPath,
        maxBuffer: 10 * 1024 * 1024,
      });
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
  })();

  const parsed2 = parseCargoTestOutput(result.stdout, result.stderr);

  // If cargo produced no test lines at all and exited non-zero, it's a compile/setup error
  if (parsed2.total === 0 && result.exitCode !== 0) {
    return {
      success: false,
      ...parsed2,
      rawOutput: (result.stderr + result.stdout).slice(0, 3000),
    };
  }

  return {
    success: parsed2.failed === 0,
    ...parsed2,
  };
}

export async function runTestsHandler(
  rawInput: unknown,
): Promise<ToolResponse> {
  try {
    const input = RunTestsInputSchema.parse(rawInput);
    const result = await runTests(input);
    return toolResult(result);
  } catch (err) {
    return toolError(err);
  }
}
