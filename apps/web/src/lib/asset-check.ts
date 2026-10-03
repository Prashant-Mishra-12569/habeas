import "server-only";
import { Asset, StrKey, nativeToScVal } from "@stellar/stellar-sdk";
import { NETWORKS, ReadError, SimulationError, contractWasmHash, horizon, simulateRead, type Network } from "./network";
import type { AssetCheck, ScanOp, Verdict } from "./asset-check-types";

export type { AssetCheck, ScanOp, Verdict };

/**
 * Wasm hashes of Habeas builds made and attested by GitHub Actions from this
 * repository (docs/EVIDENCE.md). Only these count as "protected".
 */
export const VERIFIED_HABEAS_WASM = new Set([
  "e822b7f162c873286a73019eb5ea915b29a287eaab02e626090d48ef19e26825", // v0.1.0
]);

/** Pages of 200 issuer operations to scan before stopping and saying so. */
const MAX_PAGES = 10;
/** Clawback transactions whose memo we read, looking for a stated reason. */
const MAX_MEMOS = 20;
/** Habeas cases read per check. */
const MAX_CASES = 50;

type HorizonAccount = {
  flags: { auth_required: boolean; auth_revocable: boolean; auth_immutable: boolean; auth_clawback_enabled: boolean };
  home_domain?: string;
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  signers: { key: string; weight: number; type: string }[];
};

type HorizonOp = {
  id: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  paging_token: string;
  asset_code?: string;
  asset_issuer?: string;
  amount?: string;
  from?: string;
  trustor?: string;
  authorize?: boolean;
  set_flags_s?: string[];
  clear_flags_s?: string[];
};

/** Parses "CODE-ISSUER" or "CODE:ISSUER". */
export function parseAsset(input: string): { code: string; issuer: string } {
  const m = /^([A-Za-z0-9]{1,12})[-:](G[A-Z2-7]{55})$/.exec(input.trim());
  if (!m || !StrKey.isValidEd25519PublicKey(m[2])) {
    throw new ReadError("That doesn't look like an asset. Use the code and issuer, like USDC-GA5Z…KZVN.");
  }
  return { code: m[1], issuer: m[2] };
}

/** Classic operations that freeze, unfreeze or take back this asset. */
function classify(op: HorizonOp, code: string, issuer: string): ScanOp | null {
  if (op.asset_code !== code || (op.asset_issuer && op.asset_issuer !== issuer)) {
    // allow_trust ops carry asset_code only; everything else must match both.
    if (!(op.type === "allow_trust" && op.asset_code === code)) return null;
  }
  const base = { at: op.created_at, tx: op.transaction_hash, op: op.id };
  switch (op.type) {
    case "clawback":
      return { ...base, kind: "take-back", holder: op.from ?? null, amount: op.amount ?? null };
    case "clawback_claimable_balance":
      return { ...base, kind: "take-back", holder: null, amount: null };
    case "set_trust_line_flags":
      if (op.clear_flags_s?.includes("authorized")) return { ...base, kind: "freeze", holder: op.trustor ?? null, amount: null };
      if (op.set_flags_s?.includes("authorized")) return { ...base, kind: "unfreeze", holder: op.trustor ?? null, amount: null };
      return null;
    case "allow_trust":
      return { ...base, kind: op.authorize ? "unfreeze" : "freeze", holder: op.trustor ?? null, amount: null };
    default:
      return null;
  }
}

async function scanIssuer(network: Network, code: string, issuer: string) {
  const found: ScanOp[] = [];
  let scanned = 0;
  let cursor = "";
  let oldest: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await horizon<{ _embedded: { records: HorizonOp[] } }>(
      network,
      `/accounts/${issuer}/operations?order=desc&limit=200${cursor ? `&cursor=${cursor}` : ""}`,
    );
    const records = res._embedded.records;
    for (const op of records) {
      const hit = classify(op, code, issuer);
      if (hit) found.push(hit);
    }
    scanned += records.length;
    if (records.length) {
      oldest = records[records.length - 1].created_at;
      cursor = records[records.length - 1].paging_token;
    }
    if (records.length < 200) return { found, scanned, complete: true, oldest };
  }
  return { found, scanned, complete: false, oldest };
}

/** A take back's transaction memo is the only place an issuer could have left a reason on-chain. */
async function memosFor(network: Network, txs: string[]) {
  const out: { tx: string; memo: string }[] = [];
  for (const tx of txs.slice(0, MAX_MEMOS)) {
    const t = await horizon<{ memo_type: string; memo?: string }>(network, `/transactions/${tx}`, 86_400);
    if (t.memo_type !== "none" && t.memo) out.push({ tx, memo: t.memo });
  }
  return out;
}

/**
 * The back door is closed when signers other than the reviewer can't reach
 * the issuer account's low threshold, the lowest one any freeze or take back
 * (classic SetTrustLineFlags, AllowTrust, Clawback) needs.
 */
function backDoor(account: HorizonAccount, reviewer: string) {
  const others = account.signers.filter((s) => s.key !== reviewer).reduce((sum, s) => sum + s.weight, 0);
  const needed = Math.max(account.thresholds.low_threshold, 1);
  const reviewerSigns = account.signers.some((s) => s.key === reviewer && s.weight > 0);
  if (others < needed) {
    return {
      closed: true,
      how: reviewerSigns
        ? "The issuer account can't freeze or take back without the reviewer's signature."
        : "The issuer account can no longer sign anything.",
    };
  }
  return {
    closed: false,
    how: "The issuer account can still freeze or take back directly, skipping Habeas.",
  };
}

export async function checkAsset(network: Network, code: string, issuer: string): Promise<AssetCheck> {
  const account = await horizon<HorizonAccount>(network, `/accounts/${issuer}`);
  const assetRecord = await horizon<{ _embedded: { records: { accounts?: { authorized: number } }[] } }>(
    network,
    `/assets?asset_code=${code}&asset_issuer=${issuer}`,
  );
  if (!assetRecord._embedded.records.length) {
    throw new ReadError(`Stellar has no ${code} issued by this account on ${network}. Check the code and issuer.`);
  }
  const holders = assetRecord._embedded.records[0].accounts?.authorized ?? null;

  // The asset's built-in token contract (SAC) and who controls it.
  const sac = new Asset(code, issuer).contractId(NETWORKS[network].passphrase);
  let admin: AssetCheck["admin"];
  try {
    const current = String(await simulateRead(network, sac, "admin"));
    if (current.startsWith("G")) {
      admin = { sac, deployed: true, address: current, kind: current === issuer ? "issuer" : "account", wasmHash: null };
    } else {
      const wasmHash = await contractWasmHash(network, current);
      admin = {
        sac,
        deployed: true,
        address: current,
        kind: wasmHash && VERIFIED_HABEAS_WASM.has(wasmHash) ? "habeas" : "contract",
        wasmHash,
      };
    }
  } catch (e) {
    if (e instanceof SimulationError && /MissingValue|non-existent|not found/i.test(e.raw)) {
      admin = { sac, deployed: false, address: null, kind: "none", wasmHash: null };
    } else throw e;
  }

  // Habeas details: its reviewer, and its own record of every case.
  let habeas: AssetCheck["habeas"] = null;
  if (admin.kind === "habeas" && admin.address) {
    const cfg = (await simulateRead(network, admin.address, "get_config")) as { sac: string; reviewer: string; answer_window: bigint; review_window: bigint };
    if (cfg.sac !== sac) {
      admin = { ...admin, kind: "contract" }; // A Habeas build, but configured for another asset.
    } else {
      const count = Number(await simulateRead(network, admin.address, "case_count"));
      const active = Number(await simulateRead(network, admin.address, "active_count"));
      const cases = [];
      for (let id = count; id >= 1 && cases.length < MAX_CASES; id--) {
        const c = (await simulateRead(network, admin.address, "get_case", [nativeToScVal(BigInt(id), { type: "u64" })])) as {
          status: [string];
          taken: bigint;
          statement: string;
        };
        cases.push({ id, status: c.status[0], takenStroops: c.taken.toString(), statement: c.statement });
      }
      habeas = {
        contract: admin.address,
        reviewer: cfg.reviewer,
        answerWindowSecs: Number(cfg.answer_window),
        reviewWindowSecs: Number(cfg.review_window),
        caseCount: count,
        activeCount: active,
        takenBackCount: cases.filter((c) => c.status === "TakenBack").length,
        casesRead: cases.length,
        backDoor: backDoor(account, cfg.reviewer),
      };
    }
  }

  const scan = await scanIssuer(network, code, issuer);
  const takeBacks = scan.found.filter((o) => o.kind === "take-back");
  const freezes = scan.found.filter((o) => o.kind === "freeze");
  const memos = await memosFor(network, [...new Set(takeBacks.map((o) => o.tx))]);

  const canFreeze = account.flags.auth_revocable;
  const canTakeBack = account.flags.auth_clawback_enabled;
  let verdict: Verdict;
  if (habeas?.backDoor.closed) verdict = "protected";
  else if (!canFreeze && !canTakeBack && admin.kind !== "contract" && admin.kind !== "account") verdict = "no-powers";
  else if (takeBacks.length || freezes.length) verdict = "used-without-process";
  else verdict = "not-used";

  return {
    network,
    code,
    issuer,
    homeDomain: account.home_domain || null,
    holders,
    flags: {
      required: account.flags.auth_required,
      revocable: canFreeze,
      clawbackEnabled: canTakeBack,
      immutable: account.flags.auth_immutable,
    },
    admin,
    habeas,
    history: {
      takeBacks,
      freezes,
      unfreezes: scan.found.filter((o) => o.kind === "unfreeze").length,
      scanned: scan.scanned,
      complete: scan.complete,
      oldestScanned: scan.oldest,
    },
    reasons: memos,
    verdict,
    checkedAt: new Date().toISOString(),
  };
}
