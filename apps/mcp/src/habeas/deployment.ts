import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "../config.ts";
import { ErrorCode, McpToolError } from "../lib/errors.ts";

/** What deployments/testnet.json records about the live demo. */
export type Deployment = {
  network: "testnet";
  deployed_at: string;
  asset: string;
  asset_issuer: string;
  sac: string;
  habeas: string;
  wasm_sha256: string;
  wasm_source: string;
  issuer: string;
  reviewer: string;
  relayer: string;
  answer_window_secs: number;
  review_window_secs: number;
};

// apps/mcp/src/habeas -> repository root
const DEFAULT_PATH = fileURLToPath(new URL("../../../../deployments/testnet.json", import.meta.url));
export const SPEC_PATH = fileURLToPath(new URL("../../../../docs/SPEC-cases.md", import.meta.url));

let cached: Deployment | undefined;

/** The demo deployment. Set HABEAS_DEPLOYMENT to point at another file with the same fields. */
export function deployment(): Deployment {
  if (cached) return cached;
  const path = config.HABEAS_DEPLOYMENT ?? DEFAULT_PATH;
  try {
    cached = JSON.parse(readFileSync(path, "utf8")) as Deployment;
  } catch (e) {
    throw new McpToolError(`Couldn't read the Habeas deployment file at ${path} (${(e as Error).message}).`, ErrorCode.NOT_FOUND, { path });
  }
  return cached;
}

/** "DEMOUSD" from "DEMOUSD:G...". */
export const assetCode = (d: Deployment) => d.asset.split(":")[0] ?? d.asset;
