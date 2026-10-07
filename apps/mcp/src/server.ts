import { readFile } from "node:fs/promises";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type Network } from "./config.ts";
import { toJson } from "./lib/json.ts";
import { getCase } from "./habeas/chain.ts";
import { SPEC_PATH } from "./habeas/deployment.ts";
import { registerPrompts } from "./prompts.ts";
import { getNetworkStatusResource, getContractTransactionsResource } from "./resources/index.ts";
import { BuildContractInputSchema, buildContractHandler } from "./tools/buildContract.ts";
import { DeployContractInputSchema, deployContractHandler } from "./tools/deployContract.ts";
import { GetAccountInfoInputSchema, getAccountInfoHandler } from "./tools/getAccountInfo.ts";
import { GetContractInfoInputSchema, getContractInfoHandler } from "./tools/getContractInfo.ts";
import { GetContractStateInputSchema, getContractStateHandler } from "./tools/getContractState.ts";
import { habeasToolsEnabled } from "./tools/habeasTools.ts";
import { InvokeContractInputSchema, invokeContractHandler } from "./tools/invokeContract.ts";
import { RunTestsInputSchema, runTestsHandler } from "./tools/runTests.ts";
import type { ToolDef } from "./tools/types.ts";

/**
 * local:  stdio on your own machine. Everything, including tools that run
 *         programs, read files or spend from AGENT_SECRET.
 * hosted: HTTP for anyone. Read-only tools only.
 */
export type Mode = "local" | "hosted";

const sorobanTools: ToolDef[] = [
  {
    name: "get_account_info",
    title: "Stellar account info",
    description:
      "Balances, signers, thresholds and issuer flags of a Stellar account. issuerFlags says whether the account can freeze balances or take tokens back, which is what matters when it issues a token.",
    shape: GetAccountInfoInputSchema.shape,
    handler: getAccountInfoHandler,
    where: "both",
    readOnly: true,
  },
  {
    name: "get_contract_info",
    title: "Soroban contract info",
    description: "The SHA-256 of a deployed contract's wasm, to compare with a verified build. For the Habeas contract it also says whether the deployed code matches the published release.",
    shape: GetContractInfoInputSchema.shape,
    handler: getContractInfoHandler,
    where: "both",
    readOnly: true,
  },
  {
    name: "get_contract_state",
    title: "Soroban contract state",
    description:
      "What a deployed contract holds on chain right now: when its instance was last written, how many ledgers it is still paid for, its own instance storage, and the methods it exposes. Read-only: nothing is simulated, signed or sent.",
    shape: GetContractStateInputSchema.shape,
    handler: getContractStateHandler,
    where: "both",
    readOnly: true,
  },
  {
    name: "invoke_contract",
    title: "Simulate a contract call",
    description:
      "Simulates a Soroban contract function and returns the result and the minimum fee. Nothing is signed or sent. Say the type of each argument when it matters, for example {\"type\":\"u64\",\"value\":\"7\"}: contracts reject the wrong integer width.",
    shape: InvokeContractInputSchema.shape,
    handler: invokeContractHandler,
    where: "local",
    readOnly: true,
  },
  {
    name: "build_contract",
    title: "Build a Soroban contract",
    description: "Runs `stellar contract build` in a project directory and returns the wasm path, size and compiler diagnostics.",
    shape: BuildContractInputSchema.shape,
    handler: buildContractHandler,
    where: "local",
    readOnly: false,
  },
  {
    name: "run_tests",
    title: "Run contract tests",
    description: "Runs `cargo test` in a contract project and returns each test's result.",
    shape: RunTestsInputSchema.shape,
    handler: runTestsHandler,
    where: "local",
    readOnly: false,
  },
  {
    name: "deploy_contract",
    title: "Deploy a contract to testnet or futurenet",
    description: "Deploys a built wasm with a named stellar-cli key. Mainnet is not supported. Never pass a secret key, only the key's name.",
    shape: DeployContractInputSchema.shape,
    handler: deployContractHandler,
    where: "local",
    readOnly: false,
    destructive: true,
  },
];

export function toolsFor(mode: Mode): ToolDef[] {
  return [...habeasToolsEnabled(), ...sorobanTools].filter((t) => mode === "local" || t.where === "both");
}

const INSTRUCTIONS = `Habeas is a Stellar contract that lets a token issuer freeze a holder and take tokens back only through a public case: the holder can answer, a reviewer decides, deadlines settle the rest. Everything is public on Stellar testnet.
Start with get_habeas_config. Use explain_case before saying anything about a case. This server reads and builds; it never signs and never holds a key. build_unsigned_tx returns a transaction that a person signs in their own wallet.`;

export function createMcpServer(mode: Mode): McpServer {
  const server = new McpServer({ name: "habeas-mcp", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  for (const t of toolsFor(mode)) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.shape,
        annotations: { readOnlyHint: t.readOnly, destructiveHint: t.destructive ?? false, idempotentHint: t.readOnly, openWorldHint: true },
      },
      async (args: unknown) => t.handler((args ?? {}) as Record<string, unknown>),
    );
  }

  server.registerResource(
    "habeas-spec",
    "habeas://spec",
    { title: "Habeas case rules", description: "The full case lifecycle: states, deadlines, who can act, how each case ends.", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await readFile(SPEC_PATH, "utf8").catch(() => "docs/SPEC-cases.md isn't available in this deployment.") }] }),
  );

  server.registerResource(
    "habeas-case",
    new ResourceTemplate("habeas://case/{id}", { list: undefined }),
    { title: "A Habeas case", description: "One case as stored on-chain, as JSON.", mimeType: "application/json" },
    async (uri, vars) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: toJson(await getCase(Number(vars.id))) }] }),
  );

  server.registerResource(
    "soroban-network-status",
    new ResourceTemplate("soroban://{network}/status", { list: undefined }),
    { title: "Network status", description: "Health and latest ledger of a Stellar network (testnet, futurenet or mainnet).", mimeType: "application/json" },
    async (uri, vars) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: toJson(await getNetworkStatusResource(String(vars.network) as Network)) }] }),
  );

  server.registerResource(
    "soroban-contract-transactions",
    new ResourceTemplate("soroban://{network}/contract/{contract_id}/transactions", { list: undefined }),
    { title: "Recent contract transactions", description: "Transactions that touched a contract in the last stretch RPC keeps (about 7 days at most).", mimeType: "application/json" },
    async (uri, vars) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: toJson(await getContractTransactionsResource(String(vars.contract_id), String(vars.network) as Network)) }],
    }),
  );

  registerPrompts(server);
  return server;
}
