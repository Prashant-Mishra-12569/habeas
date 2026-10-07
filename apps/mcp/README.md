# Habeas MCP server

Lets an AI agent work with Habeas and with Soroban contracts through the [Model Context Protocol](https://modelcontextprotocol.io): read cases, explain them in plain words, check a token's issuer powers, and build transactions that a **person** signs. It never signs and never holds a key.

It merges two projects: the Habeas website and contract, and [soroban-mcp-server](https://github.com/firstJOASH/soroban-mcp-server) (MIT, see `LICENSE-soroban-mcp-server`). The Soroban tools stay; Habeas now sits on top of them.

## Two surfaces

| | Local (`npm start`, stdio) | Hosted (`npm run start:http`, POST `/mcp`) |
| --- | --- | --- |
| For | your own machine and AI client | anyone, read-only |
| Habeas tools | all | all except `check_asset`, `fingerprint_file` |
| Soroban tools | all, including build, test, deploy | `get_account_info`, `get_contract_info`, `get_contract_state` |

Tools that run programs, read local files or spend money are never hosted.

## Tools

**Habeas** (testnet)

| Tool | What it does |
| --- | --- |
| `get_habeas_config` | Contract and token addresses, issuer, reviewer, windows, case count, and whether the deployed code matches the published release. Start here. |
| `get_case` | One case straight from the contract. |
| `list_cases_for` | Cases opened against an address, and its open case. |
| `explain_case` | Where a case stands, what happened, who can do what next, what settling would give. Computed from the rules in `docs/SPEC-cases.md`, not written by a model. |
| `case_timeline` | Each step with its transaction (RPC keeps about 7 days). |
| `decode_habeas_error` | An error number or a raw diagnostic in plain words. Knows the token contract has its own numbered errors. |
| `check_statement` | The 280-**byte** limit on public statements. |
| `verify_fingerprint` / `fingerprint_file` | Compare a file's SHA-256 with the one on a case. |
| `build_unsigned_tx` | `open_case`, `decide` or `withdraw` as an unsigned transaction. The website builds and simulates it, so its rules apply. |
| `check_asset` | Paid token check ($0.001 testnet USDC over x402) with the signature verified against the pinned Habeas key. Local only, needs `AGENT_SECRET`. |

**Soroban**: `get_account_info` (now with issuer flags), `get_contract_info`, `get_contract_state`, `invoke_contract`, `build_contract`, `run_tests`, `deploy_contract`.

**Resources**: `habeas://spec`, `habeas://case/{id}`, `soroban://{network}/status`, `soroban://{network}/contract/{id}/transactions`.

**Prompts** (the AI part): `explain_case`, `draft_holder_answer`, `review_brief`, `check_token`. They tell a model which tools to call first and carry the rules below.

## Rules the AI works under

- Facts come from tools. If a tool fails, the model says so.
- The model decides nothing and never predicts a verdict: the reviewer decides, deadlines settle the rest.
- No secret key passes through the model, ever. `deploy_contract` refuses a secret key and takes a `stellar keys` name instead.
- Plain words: freeze, take back (clawback), reviewer, Cleared, Taken back, fingerprint.

## Run it

```bash
cd apps/mcp
npm install            # then commit package-lock.json
npm test               # rules tests, real testnet reads, an in-memory MCP session
npm run typecheck
cp .env.example .env   # everything is optional
```

Node 22.18 or newer (24 recommended): it runs TypeScript directly, like `apps/alerts`.

**Claude Code**

```bash
claude mcp add habeas -- node /absolute/path/to/apps/mcp/src/stdio.ts
```

**Claude Desktop** (`claude_desktop_config.json`)

```json
{ "mcpServers": { "habeas": { "command": "node", "args": ["/absolute/path/to/apps/mcp/src/stdio.ts"] } } }
```

**Hosted**: build from the repository root (`apps/mcp/Dockerfile`, `apps/mcp/railway.json`), then `claude mcp add --transport http habeas https://<your-host>/mcp`. Set `MCP_AUTH_TOKEN` to require a bearer token. The rate limit (`RATE_LIMIT_PER_MIN`) is per address and in memory; put a real limiter in front for heavy use.

## What changed from soroban-mcp-server

- **Stellar SDK 13 to 17**, to match the rest of Habeas.
- **Logs go to stderr.** The old server logged to stdout, which is the protocol stream on stdio.
- **Big numbers survive.** `JSON.stringify` threw on `u64`/`i128` results, so a call such as `get_case` could not have returned.
- **`invoke_contract` takes typed arguments** (`{"type":"u64","value":"7"}`). Every integer used to become `i128`, and Habeas's case numbers are `u64`. The placeholder source account had 55 characters and was not a valid address; it now uses a valid one.
- **No API key in source.** `config.ts` had a hardcoded mainnet RPC URL with a key in it. Rotate that key, then use `MAINNET_RPC_URL`.
- **`get_network_health` bug fixed:** it stored the protocol version as the ledger close time.
- **Errors set `isError`**, so clients can tell a failure from an answer.
- **`get_account_info` uses Horizon directly** and reports whether an issuer can freeze or take back.
- **The timer in `withRpcTimeout` is cleared**, so it no longer keeps the process alive.
- **Habeas error numbers** are only named when Habeas raised them (the token contract's `#13` is a missing trustline, not `StatementRequired`).
- **`get_contract_state` is back on SDK 17.** It reads the instance entry with `getLedgerEntries` instead of SDK 13's `.switch()` accessors, and reports the wasm hash, when the entry was last written, how many ledgers it is still paid for, the contract's own instance storage, and its spec. The old ABI resource was a stub that always came back empty; `getContractMethods` reads the real spec now.
- **A bad argument is a sentence about the field.** `mapError` used to hand a zod validation failure to the client as a JSON dump under `UNKNOWN`; it is `INVALID_INPUT` with the field name instead.

## Not carried over, and why

- **The shared package** (moving `asset-check`, `habeas` and `timeline` out of `apps/web` so both apps import one copy). Those files use `server-only` and `@/` aliases. For now `apps/mcp` has its own small copies of the reads, the way `apps/alerts` already does; the website's `/api/tx/build` stays the one place that builds transactions.

## Status

`npm run typecheck` is clean and `npm test` passes: 12 rule tests and 8 live tests against testnet, including the contract's state (instance storage, expiry and all 23 methods). `node scripts/smoke.ts` drives the whole thing end to end — stdio, hosted HTTP and a secret scan of every reply. The CI workflow (`.github/workflows/mcp.yml`) runs `npm ci`, `npm run typecheck` and `npm test`.
