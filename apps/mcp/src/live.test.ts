// Reads real cases from the live Habeas contract on Stellar testnet, then
// drives the server the way an AI client would, over an in-memory MCP
// connection. No mocks. Set SKIP_LIVE=1 to skip when offline.
import assert from "node:assert/strict";
import { test } from "node:test";
import { StrKey } from "@stellar/stellar-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { activeCaseFor, caseCount, getCase, getConfig } from "./habeas/chain.ts";
import { deployment } from "./habeas/deployment.ts";
import { explainCase } from "./habeas/explain.ts";
import { createMcpServer, toolsFor } from "./server.ts";
import { getContractStateHandler } from "./tools/getContractState.ts";

const live = { skip: process.env.SKIP_LIVE === "1" ? "SKIP_LIVE=1" : false };

test("the contract's settings match deployments/testnet.json", live, async () => {
  const d = deployment();
  const c = await getConfig();
  assert.equal(c.issuer, d.issuer);
  assert.equal(c.reviewer, d.reviewer);
  assert.equal(c.answerWindow, d.answer_window_secs);
});

test("a real case reads back and can be explained", live, async () => {
  const n = await caseCount();
  assert.ok(n >= 1, "the demo has cases");
  const c = await getCase(n);
  assert.equal(c.id, n);
  assert.match(c.holder, /^G[A-Z2-7]{55}$/);
  assert.match(c.issuerFile, /^[0-9a-f]{64}$/);
  const e = explainCase(c, Math.floor(Date.now() / 1000), { asset: "DEMOUSD" });
  assert.equal(e.caseId, n);
  assert.ok(e.summary.length > 20 && e.nextSteps.length > 0);
});

test("a case that doesn't exist is a clean NOT_FOUND, not a crash", live, async () => {
  await assert.rejects(getCase(9_999_999), (e: Error & { code?: string }) => e.code === "NOT_FOUND" && /no case/i.test(e.message));
});

test("an address with no cases has no open case", live, async () => {
  assert.equal(await activeCaseFor(deployment().relayer), null);
});

type State = {
  contractId: string;
  latestLedger: number;
  liveUntilLedgerSeq: number;
  executable: { type: string; wasmSha256: string | null };
  instanceStorage: { count: number; entries: { key: unknown; value: unknown }[] };
  methods: { name: string; inputs: unknown[]; outputs: unknown[] }[] | null;
  methodCount?: number;
};

test("a contract's state reads back: storage, expiry and its methods", live, async () => {
  const d = deployment();
  const r = await getContractStateHandler({ contract_id: d.habeas, network: "testnet" });
  assert.ok(!r.isError, r.content[0]?.text);
  const s = JSON.parse(r.content[0]!.text) as State;
  assert.equal(s.contractId, d.habeas);
  assert.equal(s.executable.wasmSha256, d.wasm_sha256, "the instance entry names the same wasm as the release");
  assert.ok(s.latestLedger > 0 && s.liveUntilLedgerSeq > s.latestLedger, "the contract is paid for past this ledger");

  const config = s.instanceStorage.entries.find((e) => Array.isArray(e.key) && e.key[0] === "Config");
  assert.ok(config, "the contract keeps its Config in instance storage");
  const stored = config.value as { reviewer: string; sac: string; answer_window: string };
  assert.equal(stored.reviewer, d.reviewer);
  assert.equal(stored.sac, d.sac);
  assert.equal(stored.answer_window, String(d.answer_window_secs));

  assert.ok((s.methodCount ?? 0) >= 20, `only ${s.methodCount} methods were read`);
  assert.ok(s.methods?.some((m) => m.name === "open_case"), "the spec does not list open_case");
  assert.ok(s.methods?.every((m) => Array.isArray(m.inputs) && Array.isArray(m.outputs)), "a method has no parameters or return types");
});

test("a contract that was never deployed is a clean CONTRACT_NOT_FOUND", live, async () => {
  const ghost = StrKey.encodeContract(new Uint8Array(32).fill(3));
  const r = await getContractStateHandler({ contract_id: ghost, network: "testnet" });
  assert.equal(r.isError, true);
  const j = JSON.parse(r.content[0]!.text) as { code: string; error: string };
  assert.equal(j.code, "CONTRACT_NOT_FOUND");
  assert.match(j.error, /no contract/i);
});

test("a bad contract id is a plain sentence, not a dump of the schema", async () => {
  const r = await getContractStateHandler({ contract_id: "not-a-contract" });
  assert.equal(r.isError, true);
  const j = JSON.parse(r.content[0]!.text) as { code: string; error: string };
  assert.equal(j.code, "INVALID_INPUT");
  assert.match(j.error, /contract_id:/);
  assert.ok(!/"path"|\bissues\b|ZodError/i.test(j.error), `still shows schema internals: ${j.error}`);
});

test("hosted mode offers only read-only tools", () => {
  const hosted = toolsFor("hosted").map((t) => t.name);
  for (const local of ["build_contract", "run_tests", "deploy_contract", "invoke_contract", "check_asset", "fingerprint_file"]) {
    assert.ok(!hosted.includes(local), `${local} must not be hosted`);
  }
  for (const name of ["get_case", "explain_case", "build_unsigned_tx", "get_account_info", "get_contract_state"]) assert.ok(hosted.includes(name), `${name} should be hosted`);
});

test("over MCP: tools, a real case, prompts and the spec resource", live, async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer("hosted");
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    const { tools } = await client.listTools();
    assert.ok(tools.some((t) => t.name === "explain_case"));

    const n = await caseCount();
    const res = (await client.callTool({ name: "explain_case", arguments: { case_id: n } })) as { isError?: boolean; content: { text: string }[] };
    assert.ok(!res.isError);
    assert.equal(JSON.parse(res.content[0]!.text).caseId, n);

    const missing = (await client.callTool({ name: "get_case", arguments: { case_id: 9_999_999 } })) as { isError?: boolean; content: { text: string }[] };
    assert.equal(missing.isError, true);
    assert.equal(JSON.parse(missing.content[0]!.text).code, "NOT_FOUND");

    const long = await client.callTool({ name: "check_statement", arguments: { text: "€".repeat(100) } });
    assert.equal(JSON.parse((long.content as { text: string }[])[0]!.text).ok, false);

    const prompt = await client.getPrompt({ name: "explain_case", arguments: { case_id: String(n) } });
    assert.match((prompt.messages[0]!.content as { text: string }).text, /explain_case/);

    const spec = await client.readResource({ uri: "habeas://spec" });
    const first = spec.contents[0];
    assert.match(first && "text" in first ? first.text : "", /Habeas|case/i);
  } finally {
    await client.close();
    await server.close();
  }
});
