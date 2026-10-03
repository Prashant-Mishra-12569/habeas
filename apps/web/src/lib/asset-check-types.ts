// Result of an asset check. Shared by server and client code, and returned
// as JSON by the agent API.

export type Verdict =
  /** Admin is a verified Habeas build and the issuer can't skip it. */
  | "protected"
  /** Can freeze or take back, and no use was found in what we scanned. */
  | "not-used"
  /** Froze or took back with no public process. */
  | "used-without-process"
  /** The issuer gave itself no power to freeze or take back. */
  | "no-powers";

export type ScanOp = {
  kind: "take-back" | "freeze" | "unfreeze";
  at: string;
  tx: string;
  op: string;
  holder: string | null;
  amount: string | null;
};

export type AssetCheck = {
  network: "mainnet" | "testnet";
  code: string;
  issuer: string;
  homeDomain: string | null;
  holders: number | null;
  flags: { required: boolean; revocable: boolean; clawbackEnabled: boolean; immutable: boolean };
  admin: {
    /** The asset's built-in token contract (SAC). */
    sac: string;
    deployed: boolean;
    address: string | null;
    /** issuer: the issuer account itself; habeas: a verified Habeas build; contract: some other contract; none: no SAC yet, so only the issuer account. */
    kind: "issuer" | "account" | "habeas" | "contract" | "none";
    wasmHash: string | null;
  };
  habeas: {
    contract: string;
    reviewer: string;
    answerWindowSecs: number;
    reviewWindowSecs: number;
    caseCount: number;
    activeCount: number;
    takenBackCount: number;
    casesRead: number;
    backDoor: { closed: boolean; how: string };
  } | null;
  history: {
    takeBacks: ScanOp[];
    freezes: ScanOp[];
    unfreezes: number;
    /** Issuer operations read. */
    scanned: number;
    /** False when we stopped early; answers then cover only what was scanned. */
    complete: boolean;
    oldestScanned: string | null;
  };
  /** Memos left on take-back transactions, the only on-chain place for a reason. */
  reasons: { tx: string; memo: string }[];
  verdict: Verdict;
  checkedAt: string;
};
