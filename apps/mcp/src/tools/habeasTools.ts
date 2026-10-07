import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";
import { config } from "../config.ts";
import { ErrorCode, McpToolError, toolError, toolResult } from "../lib/errors.ts";
import { contractWasmHash } from "../lib/rpc.ts";
import { activeCaseFor, caseCount, getCase, getConfig, holderCaseIds } from "../habeas/chain.ts";
import { assetCode, deployment } from "../habeas/deployment.ts";
import { HABEAS_ERRORS, habeasError, interpretRefusal } from "../habeas/errors.ts";
import { explainCase } from "../habeas/explain.ts";
import { checkStatement, normalizeFingerprint } from "../habeas/statement.ts";
import { caseTimeline } from "../habeas/timeline.ts";
import { buildUnsigned, type UnsignedRequest } from "../habeas/web.ts";
import { paidCheck, paymentsEnabled } from "../habeas/x402.ts";
import type { Party } from "../habeas/types.ts";
import type { ToolDef } from "./types.ts";

const account = z
  .string()
  .refine((k) => StrKey.isValidEd25519PublicKey(k), { message: "Must be a Stellar account address (starts with G, 56 characters)" });
const caseId = z.number().int().min(1).describe("The case number");
const now = () => Math.floor(Date.now() / 1000);
const link = (id: number) => `${config.HABEAS_URL}/case/${id}`;

function parse<S extends z.ZodRawShape>(shape: S, args: unknown): z.infer<z.ZodObject<S>> {
  const r = z.object(shape).safeParse(args);
  if (!r.success) {
    throw new McpToolError(`Invalid input: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`, ErrorCode.INVALID_INPUT);
  }
  return r.data;
}

function tool<S extends z.ZodRawShape>(
  def: Omit<ToolDef, "shape" | "handler" | "where" | "readOnly"> & { shape: S; where?: ToolDef["where"]; readOnly?: boolean },
  run: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>,
): ToolDef {
  return {
    where: "both",
    readOnly: true,
    ...def,
    handler: async (args) => {
      try {
        return toolResult(await run(parse(def.shape, args)));
      } catch (e) {
        return toolError(e);
      }
    },
  };
}

export const habeasTools: ToolDef[] = [
  tool(
    {
      name: "get_habeas_config",
      title: "Habeas deployment and settings",
      description:
        "The live Habeas demo on Stellar testnet: contract and token addresses, who the issuer and reviewer are, the answer and review windows, how many cases exist, and whether the deployed code matches the published release. Start here to learn what Habeas is running.",
      shape: {},
    },
    async () => {
      const d = deployment();
      const [live, cases, wasm] = await Promise.all([getConfig(), caseCount(), contractWasmHash("testnet", d.habeas)]);
      return {
        network: "testnet",
        habeasContract: d.habeas,
        token: { asset: d.asset, code: assetCode(d), issuer: d.asset_issuer, sac: d.sac },
        issuer: live.issuer,
        reviewer: live.reviewer,
        answerWindowSeconds: live.answerWindow,
        reviewWindowSeconds: live.reviewWindow,
        caseCount: cases,
        deployedCode: { onChainWasmSha256: wasm, publishedReleaseSha256: d.wasm_sha256, matchesRelease: wasm === d.wasm_sha256, source: d.wasm_source },
        website: config.HABEAS_URL,
      };
    },
  ),

  tool(
    {
      name: "get_case",
      title: "Read a Habeas case",
      description:
        "Reads one case straight from the Habeas contract: the holder, amount, reason, each side's public statement, the file fingerprints, deadlines, status and how it ended. Times are unix seconds, 0 means not yet.",
      shape: { case_id: caseId },
    },
    async ({ case_id }) => ({ case: await getCase(case_id), link: link(case_id) }),
  ),

  tool(
    {
      name: "list_cases_for",
      title: "Cases opened against an address",
      description: "Lists the cases opened against a holder's address on Habeas, oldest first, with the open case if there is one. Shows the latest 10 in full.",
      shape: { address: account.describe("The holder's Stellar account address (G...)") },
    },
    async ({ address }) => {
      const [ids, active] = await Promise.all([holderCaseIds(address), activeCaseFor(address)]);
      const latest = ids.slice(-10);
      const cases = await Promise.all(latest.map((id) => getCase(id)));
      return { address, caseIds: ids, activeCaseId: active, latest: cases, ...(ids.length > latest.length ? { note: `Showing the latest ${latest.length} of ${ids.length} cases.` } : {}) };
    },
  ),

  tool(
    {
      name: "explain_case",
      title: "Explain a case in plain language",
      description:
        "Explains where a case stands, what happened so far, who can do what next and what settling would result in. Computed from the case record and the lifecycle rules, not guessed: use it as the ground truth before writing anything about a case.",
      shape: { case_id: caseId },
    },
    async ({ case_id }) => {
      const c = await getCase(case_id);
      return { ...explainCase(c, now(), { asset: assetCode(deployment()) }), link: link(case_id) };
    },
  ),

  tool(
    {
      name: "case_timeline",
      title: "Every step of a case, with transactions",
      description:
        "The steps a case went through, in order, with the Stellar transaction hash for each when it is recent enough (RPC keeps about 7 days of events). Times come from the case record itself.",
      shape: { case_id: caseId },
    },
    async ({ case_id }) => ({ caseId: case_id, ...(await caseTimeline(await getCase(case_id))) }),
  ),

  tool(
    {
      name: "decode_habeas_error",
      title: "Decode a Habeas contract error",
      description:
        "Turns a Habeas error number or a raw simulation diagnostic into plain words. Give the diagnostic when you have it: the token contract Habeas calls has its own numbered errors (for example #13 is a missing trustline there), and only the diagnostic shows which contract raised it.",
      shape: {
        code: z.number().int().optional().describe("An error number such as 14"),
        diagnostic: z.string().optional().describe("The raw error text from a failed simulation"),
      },
    },
    async ({ code, diagnostic }) => {
      if (diagnostic) return interpretRefusal(diagnostic, deployment().habeas);
      if (code === undefined) throw new McpToolError("Give a code or a diagnostic.", ErrorCode.INVALID_INPUT);
      const e = habeasError(code);
      return {
        error: e,
        caveat: "Only a Habeas error if Habeas raised it. The token contract it calls has its own numbered errors, so check which contract the diagnostic names.",
        ...(e ? {} : { knownCodes: `1 to ${HABEAS_ERRORS.length - 1}` }),
      };
    },
  ),

  tool(
    {
      name: "check_statement",
      title: "Check a public statement against the length limit",
      description: "Habeas public statements are at most 280 bytes in UTF-8, not 280 characters (accents and symbols take more than one byte). Returns the byte count and how far over it is.",
      shape: { text: z.string().describe("The statement to check") },
    },
    async ({ text }) => checkStatement(text),
  ),

  tool(
    {
      name: "verify_fingerprint",
      title: "Compare a file's fingerprint with the one on a case",
      description:
        "Habeas keeps only a SHA-256 fingerprint of each file, never the file. Compare a fingerprint you computed (fingerprint_file, sha256sum) with the one recorded on the case for the issuer, the holder or the reviewer.",
      shape: {
        case_id: caseId,
        party: z.enum(["issuer", "holder", "reviewer"]).describe("Whose file to compare with"),
        sha256: z.string().describe("The file's SHA-256, 64 hex characters"),
      },
    },
    async ({ case_id, party, sha256 }) => {
      const given = normalizeFingerprint(sha256);
      if (!given) throw new McpToolError("That isn't a SHA-256 fingerprint (64 hex characters).", ErrorCode.INVALID_INPUT);
      const c = await getCase(case_id);
      const onChain = ({ issuer: c.issuerFile, holder: c.holderFile, reviewer: c.reviewerFile } satisfies Record<Party, string | null>)[party];
      if (!onChain) return { caseId: case_id, party, recorded: false, note: `The ${party} hasn't attached a file to this case.` };
      return { caseId: case_id, party, recorded: true, match: onChain === given, onChain, given };
    },
  ),

  tool(
    {
      name: "build_unsigned_tx",
      title: "Build an unsigned Habeas transaction",
      description:
        "Builds a transaction for open_case, decide or withdraw and returns it UNSIGNED as XDR. The Habeas website builds and simulates it, so its rules apply: only the issuer can open or withdraw and only the reviewer can decide. A person signs it in their own wallet; this server never signs and never holds a key. Holders answer a case on the website, where it is free.",
      shape: {
        method: z.enum(["open_case", "decide", "withdraw"]),
        source: account.describe("The wallet that will sign: the issuer for open_case and withdraw, the reviewer for decide"),
        holder: account.optional().describe("open_case: the holder to freeze"),
        amount: z.number().positive().optional().describe("open_case: how many whole tokens to claim"),
        reason: z.enum(["Fraud", "SanctionsOrder", "SentByMistake", "CourtOrder", "Other"]).optional().describe("open_case: the reason"),
        statement: z.string().optional().describe("open_case and decide: the public statement, at most 280 bytes"),
        file_sha256: z.string().optional().describe("open_case: fingerprint of the supporting file (required). decide: optional"),
        case_id: z.number().int().min(1).optional().describe("decide and withdraw: the case number"),
        uphold: z.boolean().optional().describe("decide: true sides with the issuer, false with the holder"),
      },
      readOnly: true,
    },
    async (a) => {
      const need = (v: unknown, name: string) => {
        if (v === undefined || v === "") throw new McpToolError(`${a.method} needs ${name}.`, ErrorCode.INVALID_INPUT);
        return v;
      };
      const statement = () => {
        const s = checkStatement(String(need(a.statement, "statement")));
        if (!s.ok) throw new McpToolError(`The statement is ${s.bytes} bytes; the limit is ${s.max}. Put details in the file.`, ErrorCode.INVALID_INPUT, { bytes: s.bytes, over: s.over });
        return s.trimmed;
      };
      const hash = (required: boolean) => {
        if (a.file_sha256 === undefined) {
          if (required) need(undefined, "file_sha256");
          return undefined;
        }
        const h = normalizeFingerprint(a.file_sha256);
        if (!h) throw new McpToolError("file_sha256 must be a SHA-256 fingerprint (64 hex characters).", ErrorCode.INVALID_INPUT);
        return h;
      };

      let req: UnsignedRequest;
      if (a.method === "open_case") {
        req = {
          method: "open_case",
          source: a.source,
          holder: String(need(a.holder, "holder")),
          amount: Number(need(a.amount, "amount")),
          reason: String(need(a.reason, "reason")),
          statement: statement(),
          fileHash: hash(true)!,
        };
      } else if (a.method === "decide") {
        const fileHash = hash(false);
        req = { method: "decide", source: a.source, caseId: Number(need(a.case_id, "case_id")), uphold: Boolean(need(a.uphold, "uphold")), statement: statement(), ...(fileHash ? { fileHash } : {}) };
      } else {
        req = { method: "withdraw", source: a.source, caseId: Number(need(a.case_id, "case_id")) };
      }

      const { xdr } = await buildUnsigned(req);
      return {
        unsigned: true,
        network: "testnet",
        method: a.method,
        signer: a.source,
        xdr,
        next: `Not sent. The wallet for ${a.source} has to sign this transaction (for example in Freighter). After signing, send it to ${config.HABEAS_URL}/api/tx/submit as {"signedXdr": "..."}.`,
      };
    },
  ),

  tool(
    {
      name: "check_asset",
      title: "Check a Stellar token before accepting it (paid)",
      description:
        "Asks Habeas whether a Stellar token's issuer can freeze balances or take tokens back, and what it has done with those powers. Costs $0.001 in testnet USDC over x402, paid from AGENT_SECRET, and the answer's signature is checked against Habeas's pinned key before it is returned. Only available when AGENT_SECRET is set.",
      shape: {
        asset: z.string().regex(/^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/, "Use CODE-ISSUER, for example USDC-GA5Z...").describe("The token as CODE-ISSUER"),
        network: z.enum(["mainnet", "testnet"]).default("mainnet").describe("The network the token lives on; payment is always testnet"),
      },
      where: "local",
      readOnly: false,
    },
    async ({ asset, network }) => paidCheck(asset, network),
  ),

  tool(
    {
      name: "fingerprint_file",
      title: "SHA-256 fingerprint of a local file",
      description: "Computes the SHA-256 fingerprint of a file on this machine, the same fingerprint Habeas records for a case file. Compare it with verify_fingerprint.",
      shape: { file_path: z.string().min(1).describe("Path of the file on this machine") },
      where: "local",
    },
    async ({ file_path }) => {
      let size: number;
      try {
        size = (await stat(file_path)).size;
      } catch {
        throw new McpToolError(`Couldn't read ${file_path}.`, ErrorCode.NOT_FOUND);
      }
      const h = createHash("sha256");
      for await (const chunk of createReadStream(file_path)) h.update(chunk as Buffer);
      return { file: file_path, bytes: size, sha256: h.digest("hex") };
    },
  ),
];

export const habeasToolsEnabled = (): ToolDef[] => habeasTools.filter((t) => t.name !== "check_asset" || paymentsEnabled());
