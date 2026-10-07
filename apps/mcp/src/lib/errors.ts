/**
 * Every failure becomes a typed error with a code and a plain message, never a
 * raw stack trace. Tools answer with isError set so a client knows it failed.
 */
import { ZodError } from "zod";
import { toJson } from "./json.ts";

export const ErrorCode = {
  // Build and test
  BUILD_FAILED: "BUILD_FAILED",
  WASM_NOT_FOUND: "WASM_NOT_FOUND",
  INVALID_WASM: "INVALID_WASM",
  TEST_EXECUTION_FAILED: "TEST_EXECUTION_FAILED",
  // Network
  NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
  NETWORK_UNREACHABLE: "NETWORK_UNREACHABLE",
  RPC_ERROR: "RPC_ERROR",
  // Contracts and accounts
  INVALID_CONTRACT_ID: "INVALID_CONTRACT_ID",
  CONTRACT_NOT_FOUND: "CONTRACT_NOT_FOUND",
  CONTRACT_INVOCATION_FAILED: "CONTRACT_INVOCATION_FAILED",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  INVALID_PUBLIC_KEY: "INVALID_PUBLIC_KEY",
  // CLI
  CLI_NOT_FOUND: "CLI_NOT_FOUND",
  CLI_EXECUTION_FAILED: "CLI_EXECUTION_FAILED",
  // Habeas
  HABEAS_REFUSED: "HABEAS_REFUSED",
  INVALID_INPUT: "INVALID_INPUT",
  WEB_REQUEST_FAILED: "WEB_REQUEST_FAILED",
  PAYMENT_NOT_CONFIGURED: "PAYMENT_NOT_CONFIGURED",
  SIGNATURE_INVALID: "SIGNATURE_INVALID",
  NOT_FOUND: "NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class McpToolError extends Error {
  code: ErrorCode;
  details: Record<string, unknown> | undefined;
  constructor(message: string, code: ErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.name = "McpToolError";
    this.code = code;
    this.details = details;
  }
}

const ERROR_PATTERNS: { pattern: RegExp; code: ErrorCode; message: (m: RegExpMatchArray) => string }[] = [
  {
    pattern: /ENOENT.*soroban|command not found.*soroban|command not found.*stellar/i,
    code: ErrorCode.CLI_NOT_FOUND,
    message: () => "Stellar CLI not found. Install it with: cargo install --locked stellar-cli",
  },
  {
    pattern: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network timeout/i,
    code: ErrorCode.NETWORK_TIMEOUT,
    message: () => "Network request timed out or the connection was refused. Check the RPC URL and your connection.",
  },
  {
    pattern: /contract not found|no contract deployed/i,
    code: ErrorCode.CONTRACT_NOT_FOUND,
    message: () => "Contract not found. Check the contract ID and the network.",
  },
  {
    pattern: /insufficient balance|account has insufficient/i,
    code: ErrorCode.INSUFFICIENT_BALANCE,
    message: () => "Insufficient balance to complete the transaction. On testnet, fund the account at https://friendbot.stellar.org",
  },
  {
    pattern: /invalid contract id|invalid strkey/i,
    code: ErrorCode.INVALID_CONTRACT_ID,
    message: () => 'Invalid contract ID. Contract IDs are 56 characters and start with "C".',
  },
  {
    pattern: /account not found|no account found/i,
    code: ErrorCode.ACCOUNT_NOT_FOUND,
    message: () => "Account not found on the network. It may not be funded yet.",
  },
  {
    pattern: /error\[e\d+\]/i,
    code: ErrorCode.BUILD_FAILED,
    message: () => "Rust compilation failed. See the diagnostics field for details.",
  },
];

export function mapError(error: unknown): McpToolError {
  if (error instanceof McpToolError) return error;
  if (error instanceof ZodError) {
    // A bad argument is a plain sentence about the field, never a JSON dump of the schema.
    const parts = error.issues.map((issue) => `${issue.path.length ? issue.path.join(".") : "input"}: ${issue.message}`);
    return new McpToolError(parts.join("; "), ErrorCode.INVALID_INPUT, { fields: parts.length });
  }
  const message = error instanceof Error ? error.message : String(error);
  const fullText = `${message}\n${error instanceof Error ? (error.stack ?? "") : ""}`;
  for (const { pattern, code, message: msg } of ERROR_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) return new McpToolError(msg(match), code, { originalMessage: message });
  }
  return new McpToolError(`An unexpected error occurred: ${message}`, ErrorCode.UNKNOWN, { originalMessage: message });
}

export function formatToolError(error: unknown): { error: string; code: string; details?: Record<string, unknown> } {
  const mapped = mapError(error);
  return { error: mapped.message, code: mapped.code, ...(mapped.details ? { details: mapped.details } : {}) };
}

export type ToolResponse = { content: { type: "text"; text: string }[]; isError?: boolean };

export const toolResult = (value: unknown): ToolResponse => ({ content: [{ type: "text", text: toJson(value) }] });
export const toolError = (err: unknown): ToolResponse => ({
  content: [{ type: "text", text: toJson(formatToolError(err)) }],
  isError: true,
});
