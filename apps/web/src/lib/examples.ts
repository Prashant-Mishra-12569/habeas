// Assets offered as one-click examples. Issuers were confirmed from primary
// sources on Oct 3, 2026: Circle's docs (USDC), Paxos's and Franklin
// Templeton's stellar.toml files (PYUSD, BENJI), the Tellus Cooperative
// analysis and mainnet Horizon (USBDCP). Look-alike scam assets use the same
// codes, which is why every check needs the issuer.
import deployment from "@/config/testnet.json";

export type Example = { code: string; issuer: string; network: "mainnet" | "testnet" };

const [demoCode, demoIssuer] = deployment.asset.split(":");

export const EXAMPLES: Example[] = [
  { code: "USBDCP", issuer: "GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E", network: "mainnet" },
  { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", network: "mainnet" },
  { code: "PYUSD", issuer: "GDQE7IXJ4HUHV6RQHIUPRJSEZE4DRS5WY577O2FY6YQ5LVWZ7JZTU2V5", network: "mainnet" },
  { code: "BENJI", issuer: "GBHNGLLIE3KWGKCHIKMHJ5HVZHYIK7WTBE4QF5PLAKL4CJGSEU7HZIW5", network: "mainnet" },
  { code: demoCode, issuer: demoIssuer, network: "testnet" },
];

export const checkHref = (e: { code: string; issuer: string; network: "mainnet" | "testnet" }) =>
  `/check/${e.code}-${e.issuer}${e.network === "testnet" ? "?network=testnet" : ""}`;
