// SEP-1 stellar.toml for the demo asset. The asset issuer's home domain
// points here, so wallets and explorers can show what DEMOUSD is and how it's
// protected. Built from deployments/testnet.json so it always matches the chain.
import deployment from "@/config/testnet.json";

export const dynamic = "force-static";

const [code, issuer] = deployment.asset.split(":");
const site = "https://habeas-stellar.vercel.app";

const toml = `VERSION = "2.7.0"
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
ACCOUNTS = ["${issuer}"]

[DOCUMENTATION]
ORG_NAME = "Habeas (testnet demo)"
ORG_URL = "${site}"
ORG_DESCRIPTION = "A fair process before a Stellar token issuer freezes or takes back tokens: a public reason, a deadline to answer and a neutral reviewer."
ORG_LOGO = "${site}/brand/icon-512.png"
ORG_GITHUB = "Prashant-Mishra-12569/habeas"
ORG_TWITTER = "0xprashantt"

[[CURRENCIES]]
code = "${code}"
issuer = "${issuer}"
status = "test"
display_decimals = 2
name = "Habeas demo dollar"
image = "${site}/brand/icon-512.png"
desc = "A test token on Stellar testnet with no value. Its token contract (${deployment.sac}) is run by the Habeas contract (${deployment.habeas}), so it can only be frozen or taken back through a case with a public reason, a deadline to answer and a neutral reviewer. The issuer account's key is switched off."
conditions = "Freezes and take-backs only through a Habeas case. If the reviewer doesn't decide in time, the holder keeps the tokens. Details: ${site}/check/${code}-${issuer}?network=testnet"
is_asset_anchored = false
`;

export function GET() {
  return new Response(toml, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Required by SEP-1 so wallets can read it from the browser.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
