import { z } from "zod";

export type Network = "testnet" | "futurenet" | "mainnet";

// A blank value in .env (KEY=) counts as not set.
const blank = (v: unknown) => (v === "" ? undefined : v);
const text = () => z.preprocess(blank, z.string().optional());
const url = () => z.preprocess(blank, z.string().url().optional());

const Schema = z.object({
  STELLAR_NETWORK: z.preprocess(blank, z.enum(["testnet", "futurenet", "mainnet"]).default("testnet")),
  RPC_URL: url(),
  TESTNET_RPC_URL: url(),
  MAINNET_RPC_URL: url(),
  SOROBAN_CLI_PATH: z.preprocess(blank, z.string().default("stellar")),
  LOG_LEVEL: z.preprocess(blank, z.enum(["debug", "info", "warn", "error"]).default("info")),
  HABEAS_URL: z.preprocess(blank, z.string().url().default("https://habeas-stellar.vercel.app")),
  HABEAS_DEPLOYMENT: text(),
  // Published at /api/v1/key on the Habeas site; pinned, because a signature from any other key means nothing.
  HABEAS_SIGNER: z.preprocess(blank, z.string().default("GAJ2MWWEY5VAMG3GW72Z36647UVIYWZKOZDBF5BUTZM2JNTOZWUJHZ4J")),
  AGENT_SECRET: text(),
  PORT: z.preprocess(blank, z.coerce.number().int().min(1).max(65535).default(8787)),
  MCP_AUTH_TOKEN: text(),
  RATE_LIMIT_PER_MIN: z.preprocess(blank, z.coerce.number().int().min(1).default(60)),
});

function loadConfig(): z.infer<typeof Schema> {
  const result = Schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  return result.data;
}

export const config = loadConfig();

/** RPC endpoints per network, first one preferred. No keys live in source: override with env vars. */
export function rpcUrls(network: Network): string[] {
  if (config.RPC_URL && network === config.STELLAR_NETWORK) return [config.RPC_URL];
  switch (network) {
    case "testnet":
      return [config.TESTNET_RPC_URL ?? "https://soroban-testnet.stellar.org"];
    case "futurenet":
      return ["https://rpc-futurenet.stellar.org"];
    case "mainnet":
      // Free public endpoints listed in Stellar's docs; the second is a fallback.
      return [config.MAINNET_RPC_URL ?? "https://mainnet.sorobanrpc.com", "https://rpc.lightsail.network/"];
  }
}

export const HORIZON_URLS: Record<Network, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  futurenet: "https://horizon-futurenet.stellar.org",
  mainnet: "https://horizon.stellar.org",
};

export const NETWORK_PASSPHRASE: Record<Network, string> = {
  testnet: "Test SDF Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
  mainnet: "Public Global Stellar Network ; September 2015",
};
