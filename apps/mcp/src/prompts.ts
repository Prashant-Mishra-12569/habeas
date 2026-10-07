// Prompts are how Habeas guides an AI client: ready-made instructions that
// make it call the right tools first and keep to the site's rules. They hold
// no key and decide nothing. A person signs and the reviewer decides.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const RULES = `Rules:
- Facts about a case come only from the tools. If a tool fails, say so; never fill the gap.
- You decide nothing. Never predict that a case will be won or lost: the reviewer decides, and anyone can settle once a deadline passes.
- Never ask for, accept or repeat a secret key. Transactions are signed by a person in their own wallet.
- Use plain words: freeze, take back (clawback), reviewer, Cleared, Taken back, fingerprint (the SHA-256 of a file; Habeas never stores the file).`;

const user = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "explain_case",
    {
      title: "Explain a Habeas case",
      description: "Explains a case to someone who has never used crypto: where it stands, what happened, and what can happen next.",
      argsSchema: {
        case_id: z.string().describe("The case number"),
        language: z.string().optional().describe("Reply language, default English"),
      },
    },
    ({ case_id, language }) =>
      user(`Explain Habeas case ${case_id} to someone who has never used crypto${language ? `, in ${language}` : ""}.

First call explain_case, then get_case if you need the exact statements. Write 3 to 5 short sentences: who is involved, what is claimed and why, where the case stands, and what can happen next with the deadlines. Quote the public statements instead of paraphrasing their claims.

${RULES}`),
  );

  server.registerPrompt(
    "draft_holder_answer",
    {
      title: "Draft a holder's answer",
      description: "Helps a holder write the public answer to a case (280 bytes max) from what they tell you.",
      argsSchema: {
        case_id: z.string().describe("The case number"),
        points: z.string().describe("What the holder wants to say, in their own words"),
      },
    },
    ({ case_id, points }) =>
      user(`Help the holder of Habeas case ${case_id} write their public answer.

1. Call explain_case. If the case isn't Open, or the answer deadline has passed, say so and stop.
2. Draft one answer from ONLY these points, adding no facts and no promises: """${points}"""
3. Check it with check_statement. The limit is 280 bytes, not characters; shorten until it passes and say what you cut.
4. If the points mention evidence, remind them to attach the file on the website: its fingerprint is recorded, the file itself is not. Offer verify_fingerprint after they have done so.
5. Tell them to submit on the case page of the website, where answering is free. You cannot submit or sign for them.

${RULES}`),
  );

  server.registerPrompt(
    "review_brief",
    {
      title: "Brief for the reviewer",
      description: "A neutral summary of a case for the reviewer: both sides, what evidence is referenced, and what is still unclear. No verdict.",
      argsSchema: { case_id: z.string().describe("The case number") },
    },
    ({ case_id }) =>
      user(`Prepare a neutral brief for the reviewer of Habeas case ${case_id}.

Call get_case, explain_case and case_timeline. Then write: (1) the issuer's claim and statement, (2) the holder's answer, if any, (3) which files are recorded, as fingerprints, and whether each side attached one, (4) the deadline and who can act, (5) questions the statements leave open. If the reviewer gives you files, hash them with fingerprint_file and compare using verify_fingerprint; report matches and mismatches plainly.

Do not recommend a verdict or hint at one. The decision and its public statement belong to the reviewer.

${RULES}`),
  );

  server.registerPrompt(
    "check_token",
    {
      title: "Check a token before accepting it",
      description: "Explains whether a Stellar token's issuer can freeze or take back balances, and what it has done with that power.",
      argsSchema: {
        asset: z.string().describe("The token as CODE-ISSUER"),
        network: z.string().optional().describe("mainnet (default) or testnet"),
      },
    },
    ({ asset, network }) =>
      user(`Should I accept the Stellar token ${asset} on ${network ?? "mainnet"}? Explain what its issuer can do to my balance.

If check_asset is available, call it: it is paid and signed, and the signature is verified for you. If it isn't, call get_account_info on the issuer account (the part of the asset after the dash) and read issuerFlags. Say in plain words whether the issuer can freeze balances, can take tokens back, or is locked, and what history the result shows. A token whose issuer can do neither is different from one that can do both but never has.

${RULES}`),
  );
}
