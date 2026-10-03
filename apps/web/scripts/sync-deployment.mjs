// Copies the public testnet deployment (contract ids and addresses, no
// secrets) from the repo's deployments/ folder into the app.
import { copyFileSync, existsSync } from "node:fs";

const from = new URL("../../../deployments/testnet.json", import.meta.url);
const to = new URL("../src/config/testnet.json", import.meta.url);
if (!existsSync(from)) {
  console.error("deployments/testnet.json not found. Run scripts/deploy-testnet.sh first.");
  process.exit(1);
}
copyFileSync(from, to);
console.log("Synced src/config/testnet.json");
