// Copies the public testnet records (deployment, case runs, issuer lock,
// cases run through the website, paid agent checks)
// (contract ids, addresses and tx hashes; no secrets) from the repo's
// deployments/ folder into the app.
import { copyFileSync, existsSync } from "node:fs";

for (const name of ["testnet.json", "testnet-run.json", "testnet-lock.json", "testnet-freighter.json", "testnet-web.json", "testnet-x402.json"]) {
  const from = new URL(`../../../deployments/${name}`, import.meta.url);
  const to = new URL(`../src/config/${name}`, import.meta.url);
  if (!existsSync(from)) {
    console.error(`deployments/${name} not found. Run the scripts in scripts/ first.`);
    process.exit(1);
  }
  copyFileSync(from, to);
  console.log(`Synced src/config/${name}`);
}
