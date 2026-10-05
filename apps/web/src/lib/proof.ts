// Facts about the contract shown on the home page. They come from the code,
// not from the chain, so a test (proof.test.ts) checks them against the
// contract's source; if the contract changes, the test fails until this does.

/** `#[test]` functions in contracts/habeas/src/test.rs. */
export const CONTRACT_TESTS = 54;

/** Ways a case can end, each run on testnet (docs/EVIDENCE.md). */
export const CASE_ENDINGS = ["Cleared after an answer", "Taken back after review", "No answer", "Reviewer silent", "Withdrawn", "Emergency"] as const;
