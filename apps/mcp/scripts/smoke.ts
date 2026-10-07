// End-to-end smoke test for the Habeas MCP server, run against real Stellar
// testnet. Nothing is signed and nothing is submitted: build_unsigned_tx only
// returns XDR for a person to sign in their own wallet.
//
//   node apps/mcp/scripts/smoke.ts
//
// A  the stdio server, driven through a real MCP client
// B  the hosted HTTP server
// C  opencode itself is run by hand (see docs/PROGRESS.md)
//
// Prints PASS / FAIL / SKIPPED per check and exits 1 if anything failed.

import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Address, Keypair, StrKey, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import type { Transaction } from "@stellar/stellar-sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const mcpDir = path.resolve(here, "..");
const repoDir = path.resolve(mcpDir, "..", "..");
const PASSPHRASE = "Test SDF Network ; September 2015";
const DEPLOY_PATH = path.join(repoDir, "deployments", "testnet.json");

type Deployment = {
  asset: string;
  asset_issuer: string;
  sac: string;
  habeas: string;
  wasm_sha256: string;
  issuer: string;
  reviewer: string;
  holders: Record<string, string>;
};
const dep = JSON.parse(await readFile(DEPLOY_PATH, "utf8")) as Deployment;

/** One fake secret, used only to prove the tool refuses it. Never a real key. */
const FAKE_SECRET = `S${"A".repeat(55)}`;

// ---------------------------------------------------------------- results ---

type Row = { id: string; name: string; status: "PASS" | "FAIL" | "SKIPPED"; detail: string };
const rows: Row[] = [];

function ensure(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function check(id: string, name: string, run: () => Promise<string>): Promise<void> {
  try {
    rows.push({ id, name, status: "PASS", detail: await run() });
  } catch (e) {
    rows.push({ id, name, status: "FAIL", detail: e instanceof Error ? e.message : String(e) });
  }
}

function skip(id: string, name: string, why: string): void {
  rows.push({ id, name, status: "SKIPPED", detail: why });
}

/** One line, short enough to read in a table. */
const clip = (s: string, n = 220) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n)}…` : one;
};

// ---------------------------------------------------------------- helpers ---

function run(cmd: string, args: string[], timeoutMs = 30_000): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: mcpDir, windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += String(d)));
    p.stderr.on("data", (d) => (err += String(d)));
    const timer = setTimeout(() => {
      p.kill();
      reject(new Error(`${cmd} did not finish within ${timeoutMs}ms`));
    }, timeoutMs);
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, out, err });
    });
  });
}

/** Everything the script starts, killed if it is interrupted so nothing lingers. */
const spawned: (() => void)[] = [];

const killAll = (): void => {
  for (const stop of spawned) {
    try {
      stop();
    } catch {
      // already gone
    }
  }
};

process.on("exit", killAll);
process.on("SIGINT", () => {
  killAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  killAll();
  process.exit(143);
});

/** A child that may outlive the script if it dies without finishing. */
function track(p: ChildProcess): ChildProcess {
  spawned.push(() => p.kill());
  return p;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
  });
}

/**
 * Overrides that make a run reproducible whatever is set in the shell that
 * starts the script. A blank value counts as unset in config.ts, so these fall
 * back to the real defaults: testnet, the deployed contract, no secrets.
 */
const CLEAN: Record<string, string> = {
  AGENT_SECRET: "",
  MCP_AUTH_TOKEN: "",
  RPC_URL: "",
  TESTNET_RPC_URL: "",
  MAINNET_RPC_URL: "",
  HABEAS_URL: "",
  HABEAS_DEPLOYMENT: "",
  STELLAR_NETWORK: "testnet",
  LOG_LEVEL: "info",
};

/** The process environment, plus CLEAN, plus overrides. */
function childEnv(extra: Record<string, string> = {}): Record<string, string> {
  const base = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>;
  return { ...base, ...CLEAN, ...extra };
}

// ---------------------------------------------------------------- MCP calls ---

type ToolResult = { content: { type: string; text?: string }[]; isError?: boolean };
type Json = Record<string, unknown>;

/** Every response text, so the script can grep the whole run for secrets. */
const allOutput: string[] = [];

/** Tool, resource, prompt and HTTP text all go through here. */
const record = (text: string): void => {
  if (text) allOutput.push(text);
};

/** The newest case number, shared with section B. */
let caseIdForHttp = 0;

async function call(c: Client, name: string, args: Json = {}): Promise<ToolResult> {
  const r = (await c.callTool({ name, arguments: args })) as unknown as ToolResult;
  for (const part of r.content ?? []) if (part.text) record(part.text);
  return r;
}

const body = (r: ToolResult): string => (r.content ?? []).map((p) => p.text ?? "").join("");

function json(r: ToolResult): Json {
  const t = body(r);
  try {
    return JSON.parse(t) as Json;
  } catch {
    throw new Error(`response isn't JSON: ${clip(t)}`);
  }
}

/** Asserts the tool answered with isError and checks the message and its code. */
function expectError(r: ToolResult, match?: RegExp, code?: string): string {
  const t = body(r);
  ensure(r.isError === true, `expected an error, got: ${clip(t)}`);
  if (match) ensure(match.test(t), `expected ${match.source} in: ${clip(t)}`);
  ensure(!/\n\s+at\s+/.test(t), `a stack trace leaked into the message: ${clip(t)}`);
  if (code) {
    let parsed: { code?: string };
    try {
      parsed = JSON.parse(t) as { code?: string };
    } catch {
      throw new Error(`the error isn't JSON: ${clip(t)}`);
    }
    ensure(parsed.code === code, `error code is ${parsed.code}, expected ${code}: ${clip(t)}`);
  }
  return clip(t);
}

/** The contract call inside a built transaction, decoded the way SDK 17 gives it. */
function invokeOf(tx: Transaction): { contract: string; fn: string; args: unknown[] } {
  const op = tx.operations[0] as unknown as {
    type?: string;
    func?: { type?: string; invokeContract?: { contractAddress: xdr.ScAddress; functionName: unknown; args?: unknown[] } };
  };
  ensure(op?.type === "invokeHostFunction", `first operation is ${op?.type}`);
  ensure(op.func?.type === "hostFunctionTypeInvokeContract", `host function is ${op.func?.type}`);
  const call = op.func.invokeContract;
  ensure(call, "the operation is not a contract call");
  return {
    contract: Address.fromScAddress(call.contractAddress).toString(),
    fn: String(call.functionName),
    args: call.args ?? [],
  };
}

// ---------------------------------------------------------------- section A ---

const LOCAL_TOOLS = [
  "get_habeas_config",
  "get_case",
  "list_cases_for",
  "explain_case",
  "case_timeline",
  "decode_habeas_error",
  "check_statement",
  "verify_fingerprint",
  "build_unsigned_tx",
  "fingerprint_file",
  "get_account_info",
  "get_contract_info",
  "get_contract_state",
  "invoke_contract",
  "build_contract",
  "run_tests",
  "deploy_contract",
];

type ActiveCase = { id: number; status: string; holder: string };

/** A case the contract still counts as running, so a withdraw can be built for it. */
const ACTIVE_STATUSES = ["Open", "Answered"];
/** A case that is over: the site refuses decide with "This case is already closed." */
const CLOSED_STATUSES = ["Upheld", "Rejected", "Cleared", "TakenBack"];
type Files = { issuerFile: string | null; holderFile: string | null; reviewerFile: string | null };
type RecentCase = { id: number; status: string; files: Files };

async function sectionA(): Promise<void> {
  const serverLog: string[] = [];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(mcpDir, "src", "stdio.ts")],
    cwd: mcpDir,
    env: childEnv(),
    stderr: "pipe",
  });
  let logAttached = false;
  const attachLog = (): void => {
    const s = transport.stderr;
    if (s && !logAttached) {
      logAttached = true;
      s.on("data", (d: Buffer) => serverLog.push(d.toString()));
    }
  };
  attachLog();
  spawned.push(() => {
    void transport.close().catch(() => undefined);
  });
  const client = new Client({ name: "habeas-smoke", version: "0.0.0" }, { capabilities: {} });
  await client.connect(transport);
  attachLog();
  try {
    await sectionATools(client);
    await check("A32", "logs went to stderr, not stdout", async () => {
      const log = serverLog.join("");
      ensure(log.includes("habeas-mcp running on stdio"), `no startup log: ${clip(log, 200)}`);
      for (const line of log.split("\n").filter(Boolean)) JSON.parse(line);
      return `${log.split("\n").filter(Boolean).length} JSON log lines on stderr`;
    });
  } finally {
    await client.close();
  }
  await check("A33", "check_asset listed only with AGENT_SECRET", agentSecretListing);
  await check("A34", "stdio stdout carries JSON-RPC only", rawStdioCheck);
}

async function agentSecretListing(): Promise<string> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(mcpDir, "src", "stdio.ts")],
    cwd: mcpDir,
    env: childEnv({ AGENT_SECRET: "smoke-only-not-a-key" }),
    stderr: "pipe",
  });
  spawned.push(() => {
    void transport.close().catch(() => undefined);
  });
  const client = new Client({ name: "habeas-smoke", version: "0.0.0" }, { capabilities: {} });
  await client.connect(transport);
  try {
    const tools = (await client.listTools()).tools ?? [];
    const names = tools.map((t) => t.name);
    ensure(names.includes("check_asset"), "check_asset is missing with AGENT_SECRET set");
    ensure(names.length === LOCAL_TOOLS.length + 1, `expected ${LOCAL_TOOLS.length + 1} tools, got ${names.length}`);
    return `${names.length} tools, check_asset present`;
  } finally {
    await client.close();
  }
}

async function rawStdioCheck(): Promise<string> {
  const child = track(
    spawn(process.execPath, [path.join(mcpDir, "src", "stdio.ts")], {
      cwd: mcpDir,
      env: childEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    }),
  );
  let out = "";
  let err = "";
  let spawnError: Error | null = null;
  child.stdout?.on("data", (d) => (out += String(d)));
  child.stderr?.on("data", (d) => (err += String(d)));
  const goodbye = new Promise<void>((resolve) => {
    child.on("close", () => resolve());
    child.on("error", () => resolve());
    child.on("error", (e) => {
      spawnError = e;
    });
  });
  const messages = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } }),
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  ].join("\n");
  child.stdin?.write(`${messages}\n`);
  const until = Date.now() + 20_000;
  while (Date.now() < until && !spawnError && !/"id":2/.test(out)) await sleep(100);
  await sleep(300);
  child.kill();
  await goodbye;

  ensure(spawnError === null, `the server could not be started: ${String(spawnError)}`);
  ensure(out.length > 0, `no stdout at all. stderr: ${clip(err, 300)}`);
  const lines = out.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`a stdout line is not JSON: ${clip(line)}`);
    }
    ensure((parsed as { jsonrpc?: string }).jsonrpc === "2.0", `a stdout line is not JSON-RPC 2.0: ${clip(line)}`);
  }
  ensure(lines.length >= 2, `expected two responses, got ${lines.length}`);
  ensure(err.includes("habeas-mcp running on stdio"), `the server did not log to stderr: ${clip(err, 200)}`);
  return `${lines.length} JSON-RPC lines on stdout, ${err.split("\n").filter(Boolean).length} log lines on stderr`;
}

async function sectionATools(client: Client): Promise<void> {
  let active: ActiveCase | null = null;
  let closedId = 0;
  const recent: RecentCase[] = [];
  let latestId = 0;
  let latestHolder = dep.issuer;

  await check("A01", "initialize: server name and capabilities", async () => {
    const info = client.getServerVersion();
    ensure(info?.name === "habeas-mcp", `server name is ${info?.name}`);
    ensure(client.getServerCapabilities()?.tools !== undefined, "the server announced no tools capability");
    return `${info.name} ${info.version}`;
  });

  await check("A02", "tools/list: 17 local tools, no check_asset", async () => {
    const tools = (await client.listTools()).tools ?? [];
    const names = tools.map((t) => t.name);
    const missing = LOCAL_TOOLS.filter((n) => !names.includes(n));
    ensure(missing.length === 0, `missing tools: ${missing.join(", ")}`);
    ensure(!names.includes("check_asset"), "check_asset is listed without AGENT_SECRET");
    ensure(names.length === LOCAL_TOOLS.length, `expected ${LOCAL_TOOLS.length} tools, got ${names.length}: ${names.join(", ")}`);
    const unsigned = tools.find((t) => t.name === "build_unsigned_tx");
    ensure(unsigned?.description?.includes("never signs"), "build_unsigned_tx does not say it never signs");
    return `${names.length} tools, check_asset withheld`;
  });

  await check("A03", "get_habeas_config matches deployments/testnet.json", async () => {
    const j = json(await call(client, "get_habeas_config")) as {
      network: string;
      issuer: string;
      reviewer: string;
      caseCount: number;
      answerWindowSeconds: number;
      reviewWindowSeconds: number;
      deployedCode: { matchesRelease: boolean; publishedReleaseSha256: string };
      token: { sac: string };
    };
    ensure(j.network === "testnet", `network is ${j.network}`);
    ensure(j.issuer === dep.issuer, `issuer is ${j.issuer}`);
    ensure(j.reviewer === dep.reviewer, `reviewer is ${j.reviewer}`);
    ensure(Number.isInteger(j.caseCount) && j.caseCount > 0, `caseCount is ${j.caseCount}`);
    ensure(j.answerWindowSeconds === 180, `answer window is ${j.answerWindowSeconds}`);
    ensure(j.reviewWindowSeconds === 120, `review window is ${j.reviewWindowSeconds}`);
    ensure(j.token.sac === dep.sac, `sac is ${j.token.sac}`);
    ensure(j.deployedCode.publishedReleaseSha256 === dep.wasm_sha256, "published wasm hash differs from deployments/testnet.json");
    ensure(j.deployedCode.matchesRelease === true, "the deployed code does not match the published release");
    latestId = j.caseCount;
    caseIdForHttp = latestId;
    return `${j.caseCount} cases, on-chain code matches release ${dep.wasm_sha256.slice(0, 12)}…`;
  });

  // Read the newest case first: every later check wants a real case id.
  await check("A04", "get_case reads the newest case from the contract", async () => {
    ensure(latestId > 0, "case count unknown");
    const j = json(await call(client, "get_case", { case_id: latestId })) as { case: Record<string, unknown>; link: string };
    const c = j.case;
    latestHolder = String(c.holder);
    ensure(StrKey.isValidEd25519PublicKey(latestHolder), `holder is ${latestHolder}`);
    ensure(typeof c.status === "string" && c.status.length > 0, "status is empty");
    ensure(Number(c.openedAt) > 0, "openedAt is 0");
    ensure(Number(c.answerBy) > Number(c.openedAt), "answerBy is before openedAt");
    ensure(j.link.endsWith(`/case/${latestId}`), `link is ${j.link}`);
    const known = [...ACTIVE_STATUSES, ...CLOSED_STATUSES];
    ensure(known.includes(String(c.status)), `unexpected status ${c.status}`);
    // Walk back through recent cases: one still running for the build checks,
    // one that is over for the refusal check, and their files for the checks
    // below. A case that has been decided is not active, only Open and Answered are.
    const files = (rec: Record<string, unknown>): Files => ({
      issuerFile: (rec.issuerFile as string | null | undefined) ?? null,
      holderFile: (rec.holderFile as string | null | undefined) ?? null,
      reviewerFile: (rec.reviewerFile as string | null | undefined) ?? null,
    });
    for (let id = latestId; id > 0 && id > latestId - 15; id--) {
      let rec: Record<string, unknown>;
      if (id === latestId) {
        rec = c;
      } else {
        const r = await call(client, "get_case", { case_id: id });
        if (r.isError) continue;
        rec = (json(r).case ?? {}) as Record<string, unknown>;
        if (typeof rec.status !== "string" || !rec.status) continue;
      }
      const status = String(rec.status);
      recent.push({ id, status, files: files(rec) });
      if (!active && ACTIVE_STATUSES.includes(status)) active = { id, status, holder: String(rec.holder) };
      if (!closedId && CLOSED_STATUSES.includes(status)) closedId = id;
      if (active && closedId && recent.length >= 2) break;
    }
    return `case ${latestId}: ${c.status}, holder ${latestHolder.slice(0, 8)}…${active ? `, active case ${active.id} (${active.status})` : ", no active case"}${closedId ? `, closed case ${closedId}` : ""}`;
  });

  await check("A05", "explain_case agrees with the case record", async () => {
    const r = await call(client, "explain_case", { case_id: latestId });
    const j = json(r) as { caseId: number; stage: string; closed: boolean; deadlines: { answerBy: string; reviewBy: string | null }; summary: string; whatHappened: string[] };
    const record = json(await call(client, "get_case", { case_id: latestId })).case as { status: string; answerBy: number; reviewBy: number };
    ensure(j.caseId === latestId, `caseId is ${j.caseId}`);
    ensure(j.stage === record.status, `stage ${j.stage} vs record ${record.status}`);
    ensure(j.deadlines.answerBy === new Date(record.answerBy * 1000).toISOString(), `answerBy ${j.deadlines.answerBy}`);
    const expectedReview = record.reviewBy ? new Date(record.reviewBy * 1000).toISOString() : null;
    ensure(j.deadlines.reviewBy === expectedReview, `reviewBy ${j.deadlines.reviewBy} vs ${expectedReview}`);
    ensure(j.summary.includes(String(latestId)), "the summary doesn't name the case");
    ensure(j.whatHappened.length >= 1, "nothing happened according to the explanation");
    ensure(/frozen|deadline|reviewer|holder/i.test(j.summary), `summary isn't plain words: ${clip(j.summary, 120)}`);
    return `stage ${j.stage}, ${j.whatHappened.length} events, deadlines match the record`;
  });

  // Builds come next, while any active case is still inside its window.
  let caseBefore = "";
  if (active) {
    try {
      caseBefore = JSON.stringify(json(await call(client, "get_case", { case_id: active.id })).case);
    } catch {
      // the case went away between the reads: nothing can be built for it
      active = null;
    }
  }
  const noActive = active ? null : "no active case on testnet right now";

  if (noActive) {
    skip("A06", "build_unsigned_tx: withdraw returns unsigned XDR", noActive);
  } else {
    await check("A06", "build_unsigned_tx: withdraw returns unsigned XDR", async () => {
      ensure(active, "no active case on testnet right now");
      const r = await call(client, "build_unsigned_tx", { method: "withdraw", source: dep.issuer, case_id: active.id });
      ensure(r.isError !== true, `build failed: ${clip(body(r))}`);
      const j = json(r) as { unsigned: boolean; xdr: string; signer: string; method: string; next: string };
      ensure(j.unsigned === true, "the response does not say unsigned");
      ensure(typeof j.xdr === "string" && j.xdr.length > 100, "no XDR returned");
      const tx = TransactionBuilder.fromXDR(j.xdr, PASSPHRASE) as Transaction;
      ensure(tx.source === dep.issuer, `transaction source is ${tx.source}`);
      const call0 = invokeOf(tx);
      ensure(call0.fn === "withdraw", `the transaction calls ${call0.fn}`);
      ensure(call0.contract === dep.habeas, `the transaction calls ${call0.contract}`);
      ensure(call0.args.length === 1, `withdraw took ${call0.args.length} arguments`);
      const after = JSON.stringify(json(await call(client, "get_case", { case_id: active.id })).case);
      ensure(after === caseBefore, "the case record changed after building");
      ensure(j.next.includes("/api/tx/submit"), "the response doesn't say where to send it");
      return `unsigned ${j.xdr.length}-byte XDR for case ${active.id}, source ${dep.issuer.slice(0, 8)}…, nothing submitted`;
    });
  }

  const notAnswered = active && active.status !== "Answered" ? `case ${active.id} is ${active.status}, not Answered` : noActive;
  if (notAnswered) {
    skip("A07", "build_unsigned_tx: decide returns unsigned XDR", notAnswered);
  } else {
    await check("A07", "build_unsigned_tx: decide returns unsigned XDR", async () => {
      ensure(active, "no active case on testnet right now");
      const statement = "The holder answered before the deadline, so the claim is dropped.";
      const r = await call(client, "build_unsigned_tx", { method: "decide", source: dep.reviewer, case_id: active.id, uphold: false, statement });
      ensure(r.isError !== true, `build failed: ${clip(body(r))}`);
      const j = json(r) as { unsigned: boolean; xdr: string };
      ensure(j.unsigned === true && typeof j.xdr === "string" && j.xdr.length > 100, "no unsigned XDR returned");
      const tx = TransactionBuilder.fromXDR(j.xdr, PASSPHRASE) as Transaction;
      ensure(tx.source === dep.reviewer, `transaction source is ${tx.source}`);
      const c = invokeOf(tx);
      ensure(c.fn === "decide", `the transaction calls ${c.fn}`);
      ensure(c.contract === dep.habeas, `the transaction calls ${c.contract}`);
      ensure(c.args.length === 4, `decide took ${c.args.length} arguments`);
      return `unsigned ${j.xdr.length}-byte XDR for case ${active.id}, source ${dep.reviewer.slice(0, 8)}…, nothing submitted`;
    });
  }

  if (noActive) {
    skip("A08", "build_unsigned_tx refuses a wrong source plainly", noActive);
  } else {
    await check("A08", "build_unsigned_tx refuses a wrong source plainly", async () => {
      ensure(active, "no active case on testnet right now");
      const r = await call(client, "build_unsigned_tx", { method: "withdraw", source: dep.reviewer, case_id: active.id });
      const msg = expectError(r, /Only the issuer of this Habeas contract can do this/, "HABEAS_REFUSED");
      ensure(msg.includes(dep.issuer), "the refusal doesn't name the real issuer");
      return clip(msg, 160);
    });
  }

  if (!closedId) {
    skip("A09", "build_unsigned_tx surfaces the site's refusal on a closed case", "no case that is over among the last 15 cases");
  } else {
    await check("A09", "build_unsigned_tx surfaces the site's refusal on a closed case", async () => {
      const r = await call(client, "build_unsigned_tx", { method: "decide", source: dep.reviewer, case_id: closedId, uphold: true, statement: "A statement long enough to pass the check." });
      const msg = expectError(r, /This case is already closed/, "HABEAS_REFUSED");
      return `case ${closedId} is over: ${clip(msg, 120)}`;
    });
  }

  await check("A10", "build_unsigned_tx rejects a 281-byte statement", async () => {
    const holder = dep.holders.c!;
    const r = await call(client, "build_unsigned_tx", {
      method: "open_case",
      source: dep.issuer,
      holder,
      amount: 1,
      reason: "Fraud",
      statement: "x".repeat(281),
      file_sha256: "a".repeat(64),
    });
    const msg = expectError(r, /The statement is 281 bytes; the limit is 280/, "INVALID_INPUT");
    return clip(msg, 160);
  });

  await check("A11", "deploy_contract refuses a secret key without running the CLI", async () => {
    const started = Date.now();
    const r = await call(client, "deploy_contract", { wasm_path: "contract.wasm", source_account: FAKE_SECRET, network: "testnet" });
    const msg = expectError(r, /never a secret key/i);
    const took = Date.now() - started;
    ensure(took < 5_000, `the check took ${took}ms, so something was probably executed`);
    return `refused in ${took}ms, no CLI ran`;
  });

  await check("A12", "list_cases_for lists the newest holder's cases", async () => {
    const address = active ? active.holder : latestHolder;
    const j = json(await call(client, "list_cases_for", { address })) as { address: string; caseIds: number[]; activeCaseId: number | null; latest: unknown[] };
    ensure(j.address === address, `echoed address is ${j.address}`);
    ensure(j.caseIds.includes(latestId) || (active !== null && j.caseIds.includes(active.id)), `case ${latestId} is not in ${j.caseIds.join(", ")}`);
    ensure(Array.isArray(j.latest) && j.latest.length > 0, "no cases returned");
    ensure(j.activeCaseId === (active ? active.id : null), `activeCaseId is ${j.activeCaseId}`);
    return `${j.caseIds.length} cases for ${address.slice(0, 8)}…, active ${j.activeCaseId ?? "none"}`;
  });

  await check("A13", "case_timeline returns ordered steps with transactions", async () => {
    const j = json(await call(client, "case_timeline", { case_id: latestId })) as { steps: { kind: string; at: number; tx: string | null }[]; eventsKeptSince: string | null };
    ensure(j.steps.length > 0, "no steps");
    ensure(j.steps[0]?.kind === "opened", `first step is ${j.steps[0]?.kind}`);
    for (let i = 1; i < j.steps.length; i++) ensure(j.steps[i]!.at >= j.steps[i - 1]!.at, "steps are out of order");
    ensure(j.eventsKeptSince !== null, `no transaction lookups: ${clip(JSON.stringify(j), 160)}`);
    const kept = Date.parse(j.eventsKeptSince!);
    const withTx = j.steps.filter((s) => s.at * 1000 >= kept && s.tx);
    const missing = j.steps.filter((s) => s.at * 1000 >= kept && !s.tx);
    ensure(missing.length === 0, `${missing.length} recent steps have no transaction: ${missing.map((s) => s.kind).join(", ")}`);
    ensure(withTx.length > 0, "no step has a transaction hash");
    return `${j.steps.length} steps in order, ${withTx.length} with a transaction, events kept since ${j.eventsKeptSince}`;
  });

  await check("A14", "get_case on a missing number fails with a plain message", async () => {
    const r = await call(client, "get_case", { case_id: latestId + 999 });
    const msg = expectError(r, /There is no case with that number/, "NOT_FOUND");
    ensure(!msg.includes("stack"), "the error mentions a stack");
    return clip(msg, 160);
  });

  await check("A15", "decode_habeas_error: code 14 in plain words", async () => {
    const r = await call(client, "decode_habeas_error", { code: 14 });
    ensure(r.isError !== true, `failed: ${clip(body(r))}`);
    const j = json(r) as { error: { code: number; name: string; meaning: string }; caveat: string };
    ensure(j.error.code === 14, `code is ${j.error.code}`);
    ensure(j.error.name === "StatementTooLong", `name is ${j.error.name}`);
    ensure(j.error.meaning.includes("280 bytes"), `meaning is ${j.error.meaning}`);
    ensure(j.caveat.includes("token contract"), "no caveat about the token contract's own errors");
    return `${j.error.name}: ${j.error.meaning}`;
  });

  await check("A16", "decode_habeas_error: unknown code 99 says it isn't one", async () => {
    const r = await call(client, "decode_habeas_error", { code: 99 });
    const j = json(r) as { error: unknown; knownCodes: string };
    ensure(j.error === null, `error is ${JSON.stringify(j.error)}`);
    ensure(typeof j.knownCodes === "string" && j.knownCodes.includes("1 to"), `knownCodes is ${j.knownCodes}`);
    return `99 is not a Habeas error; known codes ${j.knownCodes}`;
  });

  await check("A17", "decode_habeas_error: a token diagnostic is not a Habeas error", async () => {
    const diagnostic = `[EC] soroban host diagnostic\ntopics:[error, Error(Contract, #13)] contract:${dep.sac} data:["Missing trustline"]`;
    const r = await call(client, "decode_habeas_error", { diagnostic });
    ensure(r.isError !== true, `failed: ${clip(body(r))}`);
    const j = json(r) as { kind: string; contract?: string; code?: number; message?: string };
    ensure(j.kind === "other-contract", `kind is ${j.kind}`);
    ensure(j.contract === dep.sac, `contract is ${j.contract}`);
    ensure(j.code === 13, `code is ${j.code}`);
    ensure(j.message === "Missing trustline", `message is ${j.message}`);
    return `error #13 blamed on the token contract ${dep.sac.slice(0, 10)}…, not on Habeas`;
  });

  await check("A18", "check_statement counts 280 bytes as OK", async () => {
    const j = json(await call(client, "check_statement", { text: "x".repeat(280) })) as { ok: boolean; bytes: number; max: number };
    ensure(j.ok === true && j.bytes === 280 && j.max === 280, JSON.stringify(j));
    return "280 bytes, ok";
  });

  await check("A19", "check_statement counts bytes, not characters", async () => {
    const j = json(await call(client, "check_statement", { text: "€".repeat(100) })) as { ok: boolean; bytes: number; over: number };
    ensure(j.ok === false, "100 euro signs were accepted");
    ensure(j.bytes === 300, `bytes is ${j.bytes}`);
    ensure(j.over === 20, `over is ${j.over}`);
    return "100 characters = 300 bytes, over by 20";
  });

  await check("A20", "fingerprint_file matches an independent SHA-256", async () => {
    const file = path.join(repoDir, "docs", "SPEC-cases.md");
    const j = json(await call(client, "fingerprint_file", { file_path: file })) as { sha256: string; bytes: number };
    ensure(/^[0-9a-f]{64}$/.test(j.sha256), `sha256 is ${j.sha256}`);
    const quoted = file.replace(/'/g, "''");
    const ps = await run("powershell", ["-NoProfile", "-NonInteractive", "-Command", `(Get-FileHash -Algorithm SHA256 -LiteralPath '${quoted}').Hash.ToLower()`]);
    ensure(ps.code === 0, `Get-FileHash failed: ${ps.err || ps.out}`);
    const outside = ps.out.trim().toLowerCase();
    ensure(outside === j.sha256, `tool gave ${j.sha256}, Get-FileHash gave ${outside}`);
    ensure(j.bytes > 0, "byte count is 0");
    return `${j.sha256.slice(0, 16)}… over ${j.bytes} bytes, matches Get-FileHash`;
  });

  const partyWithFile = (f: Files): "issuer" | "holder" | "reviewer" | null =>
    f.issuerFile ? "issuer" : f.holderFile ? "holder" : f.reviewerFile ? "reviewer" : null;
  const partyWithoutFile = (f: Files): "issuer" | "holder" | "reviewer" | null =>
    !f.holderFile ? "holder" : !f.reviewerFile ? "reviewer" : !f.issuerFile ? "issuer" : null;

  const filed = recent.find((x) => partyWithFile(x.files));
  if (!filed) {
    skip("A21", "verify_fingerprint: a wrong fingerprint does not match", "no case among the last 15 has a fingerprint on file");
  } else {
    await check("A21", "verify_fingerprint: a wrong fingerprint does not match", async () => {
      const party = partyWithFile(filed.files)!;
      const j = json(await call(client, "verify_fingerprint", { case_id: filed.id, party, sha256: "0".repeat(64) })) as { recorded: boolean; match: boolean; onChain: string };
      ensure(j.recorded === true, "no fingerprint is recorded for that party");
      ensure(j.match === false, "a fingerprint of all zeros matched the record");
      ensure(j.onChain !== "0".repeat(64), "the recorded fingerprint is all zeros");
      return `case ${filed.id}: ${party}'s fingerprint recorded, comparison correctly false`;
    });
  }

  const unfiled = recent.find((x) => partyWithoutFile(x.files));
  if (!unfiled) {
    skip("A22", "verify_fingerprint: says plainly when no file is recorded", "every party attached a file on the last 15 cases");
  } else {
    await check("A22", "verify_fingerprint: says plainly when no file is recorded", async () => {
      const party = partyWithoutFile(unfiled.files)!;
      const j = json(await call(client, "verify_fingerprint", { case_id: unfiled.id, party, sha256: "1".repeat(64) })) as { recorded: boolean; note: string };
      ensure(j.recorded === false, "a fingerprint was reported as recorded");
      ensure(j.note.includes("hasn't attached"), `note is ${j.note}`);
      return `case ${unfiled.id}: the ${party} hasn't attached a file`;
    });
  }

  await check("A23", "get_account_info: the issuer can freeze and take back", async () => {
    const j = json(await call(client, "get_account_info", { public_key: dep.asset_issuer, network: "testnet" })) as { issuerFlags: { canFreeze: boolean; canTakeBack: boolean; approvalRequired: boolean; locked: boolean }; balances: unknown[] };
    ensure(j.issuerFlags.canFreeze === true, "canFreeze is false, which the demo doesn't ship with");
    ensure(j.issuerFlags.canTakeBack === true, "canTakeBack is false, which the demo doesn't ship with");
    ensure(j.issuerFlags.locked === false, "the issuer is locked");
    ensure(j.balances.length > 0, "no balances");
    return `canFreeze ${j.issuerFlags.canFreeze}, canTakeBack ${j.issuerFlags.canTakeBack}, ${j.balances.length} balance lines`;
  });

  await check("A24", "get_account_info: an unfunded account fails plainly", async () => {
    const ghost = Keypair.random().publicKey();
    const r = await call(client, "get_account_info", { public_key: ghost, network: "testnet" });
    const msg = expectError(r, /not funded|friendbot/i, "ACCOUNT_NOT_FOUND");
    return clip(msg, 160);
  });

  await check("A25", "get_contract_info: the Habeas wasm matches the release", async () => {
    const j = json(await call(client, "get_contract_info", { contract_id: dep.habeas, network: "testnet" })) as { wasmSha256: string; habeas: { isHabeas: boolean; matchesRelease: boolean } };
    ensure(j.wasmSha256 === dep.wasm_sha256, `on-chain hash is ${j.wasmSha256}`);
    ensure(j.habeas.isHabeas === true, "the tool did not recognise its own contract");
    ensure(j.habeas.matchesRelease === true, "deployed code does not match the published release");
    return `${j.wasmSha256.slice(0, 16)}… matches the published release`;
  });

  await check("A26", "get_contract_info: the token contract has no wasm", async () => {
    const j = json(await call(client, "get_contract_info", { contract_id: dep.sac, network: "testnet" })) as { wasmSha256: string | null; kind: string };
    ensure(j.wasmSha256 === null, `wasmSha256 is ${j.wasmSha256}`);
    ensure(j.kind.includes("built-in"), `kind is ${j.kind}`);
    return "Stellar Asset Contract, built in, no wasm";
  });

  await check("A27", "invoke_contract: u64 argument reads a case", async () => {
    const j = json(await call(client, "invoke_contract", { contract_id: dep.habeas, function_name: "get_case", args: [{ type: "u64", value: String(latestId) }], network: "testnet" })) as { success: boolean; result: { id: string; holder: string; status: string[] }; note: string };
    ensure(j.success === true, `failed: ${clip(JSON.stringify(j))}`);
    ensure(String(j.result.id) === String(latestId), `result.id is ${j.result.id}`);
    ensure(StrKey.isValidEd25519PublicKey(String(j.result.holder)), `holder is ${j.result.holder}`);
    ensure(j.note.includes("Nothing was signed"), `note is ${j.note}`);
    return `case ${j.result.id} simulated, holder ${String(j.result.holder).slice(0, 8)}…, nothing sent`;
  });

  await check("A28", "invoke_contract: a bare number does not crash", async () => {
    const r = await call(client, "invoke_contract", { contract_id: dep.habeas, function_name: "get_case", args: [latestId], network: "testnet" });
    let outcome: string;
    if (r.isError) {
      const t = expectError(r);
      ensure(!/undefined is not a function|TypeError|Cannot read/i.test(t), `the tool crashed: ${t}`);
      outcome = `refused: ${clip(t, 120)}`;
    } else {
      const j = json(r) as { success: boolean };
      ensure(j.success === true, `unexpected payload: ${clip(JSON.stringify(j))}`);
      outcome = "simulated as i128";
    }
    const after = await call(client, "check_statement", { text: "still here" });
    ensure(after.isError !== true, "the client stopped working after that call");
    return `${outcome}; the client still answered afterwards`;
  });

  await check("A29", "resources: spec, case and network status", async () => {
    const list = (await client.listResources()).resources ?? [];
    ensure(list.some((r) => r.uri === "habeas://spec"), `resources/list is ${list.map((r) => r.uri).join(", ")}`);
    const spec = await client.readResource({ uri: "habeas://spec" });
    const specText = spec.contents?.map((c) => ("text" in c ? c.text ?? "" : "")).join("") ?? "";
    const file = await readFile(path.join(repoDir, "docs", "SPEC-cases.md"), "utf8").catch(() => null);
    if (file !== null) ensure(specText === file, "habeas://spec does not match docs/SPEC-cases.md");
    else ensure(specText.length > 0, "habeas://spec is empty");

    const one = await client.readResource({ uri: `habeas://case/${latestId}` });
    const caseText = one.contents?.map((c) => ("text" in c ? c.text ?? "" : "")).join("") ?? "";
    const parsed = JSON.parse(caseText) as { id: number };
    ensure(parsed.id === latestId, `resource returned case ${parsed.id}`);

    const status = await client.readResource({ uri: "soroban://testnet/status" });
    const statusText = status.contents?.map((c) => ("text" in c ? c.text ?? "" : "")).join("") ?? "";
    record(specText);
    record(caseText);
    record(statusText);
    const st = JSON.parse(statusText) as { status: string; latestLedger: number };
    ensure(st.latestLedger > 0, `latestLedger is ${st.latestLedger}`);
    return `spec ${specText.length} bytes, case ${parsed.id}, ledger ${st.latestLedger} (${st.status})`;
  });

  await check("A30", "prompts: four prompts, each points at the right tools", async () => {
    const prompts = (await client.listPrompts()).prompts ?? [];
    const names = prompts.map((p) => p.name);
    const wanted = ["explain_case", "draft_holder_answer", "review_brief", "check_token"];
    ensure(wanted.every((n) => names.includes(n)), `prompts are ${names.join(", ")}`);
    const read = async (name: string, args: Record<string, string>) => {
      const p = await client.getPrompt({ name, arguments: args });
      const text = p.messages.map((m) => (m.content.type === "text" ? m.content.text : "")).join("\n");
      record(text);
      return text;
    };
    const explain = await read("explain_case", { case_id: String(latestId) });
    ensure(explain.includes("explain_case") && explain.includes("get_case"), "explain_case prompt doesn't name its tools");
    ensure(explain.includes("Never ask for, accept or repeat a secret key"), "the rules are missing from the prompt");
    const draft = await read("draft_holder_answer", { case_id: String(latestId), points: "I paid for this" });
    ensure(draft.includes("check_statement"), "draft_holder_answer doesn't mention check_statement");
    const brief = await read("review_brief", { case_id: String(latestId) });
    ensure(brief.includes("case_timeline") && brief.includes("Do not recommend a verdict"), "review_brief is missing its tools or its neutrality rule");
    const token = await read("check_token", { asset: `DEMOUSD-${dep.asset_issuer}` });
    ensure(token.includes("get_account_info") && token.includes("issuerFlags"), "check_token doesn't point at get_account_info");
    return `${names.length} prompts, tools and rules named in each`;
  });

  // Always builds one, so there is an unsigned transaction to inspect even on a
  // day when every case on testnet is already closed.
  await check("A31", "build_unsigned_tx: open_case returns unsigned XDR", async () => {
    let holder: string | null = null;
    for (const address of Object.values(dep.holders)) {
      const seen = json(await call(client, "list_cases_for", { address })) as { activeCaseId: number | null };
      if (seen.activeCaseId === null) {
        holder = address;
        break;
      }
    }
    ensure(holder, "every demo holder already has an open case");
    const r = await call(client, "build_unsigned_tx", {
      method: "open_case",
      source: dep.issuer,
      holder,
      amount: 1,
      reason: "Fraud",
      statement: "Building this transaction is a check, not a claim.",
      file_sha256: "b".repeat(64),
    });
    ensure(r.isError !== true, `build failed: ${clip(body(r))}`);
    const j = json(r) as { unsigned: boolean; xdr: string };
    ensure(j.unsigned === true && typeof j.xdr === "string" && j.xdr.length > 100, "no unsigned XDR returned");
    const tx = TransactionBuilder.fromXDR(j.xdr, PASSPHRASE) as Transaction;
    ensure(tx.source === dep.issuer, `transaction source is ${tx.source}`);
    const c = invokeOf(tx);
    ensure(c.fn === "open_case", `the transaction calls ${c.fn}`);
    ensure(c.contract === dep.habeas, `the transaction calls ${c.contract}`);
    ensure(c.args.length === 5, `open_case took ${c.args.length} arguments`);
    ensure(Address.fromScVal(c.args[0] as xdr.ScVal).toString() === holder, "the first argument isn't the holder");
    const after = json(await call(client, "list_cases_for", { address: holder })) as { activeCaseId: number | null };
    ensure(after.activeCaseId === null, "a case was opened by building");
    return `unsigned ${j.xdr.length}-byte XDR for holder ${holder.slice(0, 8)}…, 5 arguments, nothing submitted`;
  });
}

// ---------------------------------------------------------------- section B ---

type HttpServer = { proc: ChildProcess; port: number; stdout: string; stderr: string };

async function startHttp(extra: Record<string, string>): Promise<HttpServer> {
  const port = await freePort();
  const proc = track(
    spawn(process.execPath, [path.join(mcpDir, "src", "http.ts")], {
      cwd: mcpDir,
      env: { ...childEnv(), PORT: String(port), ...extra },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }),
  );
  const s: HttpServer = { proc, port, stdout: "", stderr: "" };
  let spawnError: Error | null = null;
  proc.on("error", (e) => {
    spawnError = e;
  });
  proc.stdout?.on("data", (d) => (s.stdout += String(d)));
  proc.stderr?.on("data", (d) => (s.stderr += String(d)));
  for (let i = 0; i < 80; i++) {
    if (spawnError) throw new Error(`the HTTP server could not be started: ${spawnError.message}`);
    if (proc.exitCode !== null) throw new Error(`the HTTP server exited with ${proc.exitCode}: ${clip(s.stderr, 300)}`);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) return s;
    } catch {
      // not listening yet
    }
    await sleep(250);
  }
  proc.kill();
  throw new Error(`the HTTP server never came up: ${clip(s.stderr, 300)}`);
}

function sseText(t: string): string {
  if (!t.includes("data: ")) return t;
  const lines = t.split("\n").filter((l) => l.startsWith("data: "));
  return (lines.at(-1) ?? "").slice(6);
}

async function post(port: number, raw: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
  let res: Response;
  try {
    res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
      body: raw,
    });
  } catch (e) {
    const cause = (e as { cause?: { message?: string } }).cause?.message;
    throw new Error(`the connection failed: ${(e as Error).message}${cause ? ` (${cause})` : ""}`);
  }
  const text = sseText(await res.text());
  record(text);
  return { status: res.status, text };
}

const rpc = (id: number | null, method: string, params: Json = {}): string => JSON.stringify(id === null ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id, method, params });

async function sectionB(): Promise<void> {
  const main = await startHttp({});
  try {
    await check("B01", "healthz answers on the hosted server", async () => {
      const res = await fetch(`http://127.0.0.1:${main.port}/healthz`);
      const j = (await res.json()) as { ok: boolean; tools: number };
      ensure(res.status === 200 && j.ok === true, `status ${res.status}`);
      ensure(j.tools === 12, `hosted mode exposes ${j.tools} tools`);
      return `200, ok, ${j.tools} tools`;
    });

    const init = { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } };

    await check("B02", "initialize over HTTP", async () => {
      const r = await post(main.port, rpc(1, "initialize", init));
      ensure(r.status === 200, `status ${r.status}: ${clip(r.text)}`);
      const j = JSON.parse(r.text) as { result: { serverInfo: { name: string }; protocolVersion: string } };
      ensure(j.result.serverInfo.name === "habeas-mcp", `serverInfo is ${JSON.stringify(j.result.serverInfo)}`);
      return `${j.result.serverInfo.name}, protocol ${j.result.protocolVersion}`;
    });

    await check("B03", "hosted tools: read-only set, no local tools", async () => {
      const r = await post(main.port, rpc(2, "tools/list"));
      const j = JSON.parse(r.text) as { result: { tools: { name: string }[] } };
      const names = j.result.tools.map((t) => t.name);
      ensure(names.length === 12, `expected 12 tools, got ${names.length}: ${names.join(", ")}`);
      const forbidden = ["build_contract", "run_tests", "deploy_contract", "invoke_contract", "check_asset", "fingerprint_file"];
      const leaked = forbidden.filter((n) => names.includes(n));
      ensure(leaked.length === 0, `local-only tools are exposed: ${leaked.join(", ")}`);
      ensure(names.includes("build_unsigned_tx"), "build_unsigned_tx is missing");
      return `12 tools, ${forbidden.length} local-only tools withheld`;
    });

    await check("B04", "hosted tools/call reads a real case", async () => {
      const r = await post(main.port, rpc(3, "tools/call", { name: "get_case", arguments: { case_id: caseIdForHttp } }));
      const j = JSON.parse(r.text) as { result: { isError?: boolean; content: { text?: string }[] } };
      ensure(!j.result.isError, `the call failed: ${clip(r.text)}`);
      const inner = JSON.parse(j.result.content.map((c) => c.text ?? "").join("")) as { case: { id: number } };
      ensure(inner.case.id === caseIdForHttp, `returned case ${inner.case.id}`);
      return `case ${inner.case.id} read over HTTP`;
    });

    await check("B05", "GET /mcp is refused with 405", async () => {
      const res = await fetch(`http://127.0.0.1:${main.port}/mcp`);
      const j = (await res.json()) as { error: { message: string } };
      ensure(res.status === 405, `status ${res.status}`);
      ensure(j.error.message.includes("POST"), `message is ${j.error.message}`);
      return `405: ${j.error.message}`;
    });

    await check("B06", "unknown paths get 404", async () => {
      const res = await fetch(`http://127.0.0.1:${main.port}/nope`);
      const j = (await res.json()) as { error: string };
      ensure(res.status === 404, `status ${res.status}`);
      ensure(j.error.includes("/mcp"), `error is ${j.error}`);
      return `404: ${j.error}`;
    });

    await check("B07", "a body that isn't JSON gets 400", async () => {
      const r = await post(main.port, "{not json");
      ensure(r.status === 400, `status ${r.status}: ${clip(r.text)}`);
      ensure(r.text.includes("under 1 MB"), `message is ${clip(r.text)}`);
      return "400: The request body must be JSON under 1 MB.";
    });

    await check("B08", "a body over 1 MB is refused", async () => {
      const huge = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"x":"${"a".repeat(1_100_000)}"}}`;
      try {
        const r = await post(main.port, huge);
        ensure(r.status === 400, `status ${r.status}`);
        ensure(r.text.includes("under 1 MB"), `message is ${clip(r.text)}`);
        return "400: The request body must be JSON under 1 MB.";
      } catch (e) {
        const msg = (e as Error).message;
        ensure(/ECONNRESET|socket hang up|terminated|failed/i.test(msg), `unexpected failure: ${msg}`);
        return `the server cut the connection while sending ${huge.length} bytes (${msg})`;
      }
    });

    let auth: HttpServer | null = null;
    await check("B09", "MCP_AUTH_TOKEN: 401 without it, 200 with it", async () => {
      auth = await startHttp({ MCP_AUTH_TOKEN: "smoke-token" });
      try {
        const bare = await post(auth.port, rpc(1, "initialize", init));
        ensure(bare.status === 401, `without a token: status ${bare.status}`);
        const ok = await post(auth.port, rpc(2, "initialize", init), { authorization: "Bearer smoke-token" });
        ensure(ok.status === 200, `with a token: status ${ok.status}: ${clip(ok.text)}`);
        return "401 unauthorized, 200 with Bearer smoke-token";
      } finally {
        auth.proc.kill();
      }
    });

    let limited: HttpServer | null = null;
    await check("B10", "RATE_LIMIT_PER_MIN returns 429", async () => {
      limited = await startHttp({ RATE_LIMIT_PER_MIN: "3" });
      try {
        const statuses: number[] = [];
        for (let i = 1; i <= 4; i++) {
          const r = await post(limited.port, rpc(i, "initialize", init));
          statuses.push(r.status);
        }
        ensure(statuses[3] === 429, `statuses were ${statuses.join(", ")}`);
        ensure(statuses.slice(0, 3).every((s) => s === 200), `the first calls failed: ${statuses.join(", ")}`);
        return `200, 200, 200, ${statuses[3]}`;
      } finally {
        limited.proc.kill();
      }
    });

    await check("B11", "the hosted server writes nothing to stdout", async () => {
      ensure(main.stdout.trim() === "", `stdout is not empty: ${clip(main.stdout, 200)}`);
      return "stdout empty, logs only on stderr";
    });

    await check("B12", "get_contract_state reads the contract over HTTP", async () => {
      const r = await post(main.port, rpc(4, "tools/call", { name: "get_contract_state", arguments: { contract_id: dep.habeas, network: "testnet" } }));
      const j = JSON.parse(r.text) as { result: { isError?: boolean; content: { text?: string }[] } };
      ensure(!j.result.isError, `the call failed: ${clip(r.text)}`);
      const s = JSON.parse(j.result.content.map((c) => c.text ?? "").join("")) as {
        contractId: string;
        latestLedger: number;
        liveUntilLedgerSeq: number;
        ledgersUntilItExpires: number;
        executable: { wasmSha256: string | null };
        instanceStorage: { count: number; entries: { key: unknown; value: unknown }[] };
        methods: { name: string }[] | null;
        methodCount?: number;
      };
      ensure(s.contractId === dep.habeas, `read ${s.contractId}`);
      ensure(s.executable.wasmSha256 === dep.wasm_sha256, `the instance entry names ${s.executable.wasmSha256}`);
      ensure(s.liveUntilLedgerSeq > s.latestLedger, "the contract has no expiry ledger");
      ensure(s.instanceStorage.count >= 3, `only ${s.instanceStorage.count} storage entries`);
      const stored = s.instanceStorage.entries.find((e) => Array.isArray(e.key) && e.key[0] === "Config");
      ensure(stored, "Config is not in the contract's instance storage");
      ensure((stored.value as { reviewer: string }).reviewer === dep.reviewer, "the stored reviewer differs from the deployment");
      ensure((s.methodCount ?? 0) >= 20, `only ${s.methodCount} methods in the spec`);
      ensure(s.methods?.some((m) => m.name === "open_case") === true, "the spec does not list open_case");
      return `${s.instanceStorage.count} storage entries, ${s.methodCount} methods, expires in ${s.ledgersUntilItExpires} ledgers`;
    });
  } finally {
    main.proc.kill();
  }
}

// ---------------------------------------------------------------- reporting ---

function scanForSecrets(): { ok: boolean; detail: string } {
  const problems: string[] = [];
  let validSecrets = 0;
  let rawSeeds = 0;
  for (const text of allOutput) {
    for (const m of text.matchAll(/\bS[A-Z2-7]{55}\b/g)) {
      if (m[0] === FAKE_SECRET) continue;
      rawSeeds += 1;
      if (StrKey.isValidSecretSeed(m[0])) validSecrets += 1;
    }
    if (/(api[_-]?key|apikey)\s*[:=]/i.test(text)) problems.push(`an api key appeared in: ${clip(text, 120)}`);
  }
  if (validSecrets > 0) problems.push(`${validSecrets} valid secret keys appeared in a response`);
  if (rawSeeds > 0) problems.push(`${rawSeeds} seed-looking strings appeared in a response`);
  return problems.length
    ? { ok: false, detail: problems.join("; ") }
    : { ok: true, detail: `${allOutput.length} texts from tools, resources, prompts and HTTP checked, no secret keys, no api keys` };
}

function report(): void {
  const w0 = Math.max(2, ...rows.map((r) => r.id.length));
  const w1 = Math.max(5, ...rows.map((r) => r.name.length));
  console.log("");
  console.log(`${"ID".padEnd(w0)}  ${"CHECK".padEnd(w1)}  RESULT    DETAIL`);
  console.log(`${"-".repeat(w0)}  ${"-".repeat(w1)}  ------    ------`);
  for (const r of rows) console.log(`${r.id.padEnd(w0)}  ${r.name.padEnd(w1)}  ${r.status.padEnd(8)}  ${r.detail}`);
  const n = (s: string) => rows.filter((r) => r.status === s).length;
  console.log(`\n${n("PASS")} passed, ${n("FAIL")} failed, ${n("SKIPPED")} skipped.`);
}

async function main(): Promise<void> {
  await sectionA().catch((e) => rows.push({ id: "A00", name: "section A (stdio)", status: "FAIL", detail: e instanceof Error ? e.message : String(e) }));
  await sectionB().catch((e) => rows.push({ id: "B00", name: "section B (http)", status: "FAIL", detail: e instanceof Error ? e.message : String(e) }));
}

await main();
const scan = scanForSecrets();
rows.push({ id: "S01", name: "no secrets in any response text", status: scan.ok ? "PASS" : "FAIL", detail: scan.detail });
report();
process.exitCode = rows.some((r) => r.status === "FAIL") ? 1 : 0;
