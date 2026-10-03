// Runs the asset check against real Stellar mainnet and testnet. Expected
// values are facts checked by hand on Oct 3, 2026 (docs/EVIDENCE.md).
import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import deployment from "@/config/testnet.json";
import { checkAsset, parseAsset } from "./asset-check";
import { ReadError } from "./network";

const USBDCP = "GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E";
const USDC = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const BENJI = "GBHNGLLIE3KWGKCHIKMHJ5HVZHYIK7WTBE4QF5PLAKL4CJGSEU7HZIW5";

describe("parseAsset", () => {
  it("reads CODE-ISSUER and CODE:ISSUER", () => {
    expect(parseAsset(`USDC-${USDC}`)).toEqual({ code: "USDC", issuer: USDC });
    expect(parseAsset(` USDC:${USDC} `)).toEqual({ code: "USDC", issuer: USDC });
  });

  it("refuses anything else with a plain message", () => {
    expect(() => parseAsset("USDC")).toThrow(ReadError);
    expect(() => parseAsset(`USDC-${USDC.slice(0, -1)}A`)).toThrow(/doesn't look like an asset/);
  });
});

describe("checkAsset on mainnet", () => {
  it("finds the Sep 19 USBDC take back and no public process", async () => {
    const r = await checkAsset("mainnet", "USBDCP", USBDCP);
    expect(r.flags).toMatchObject({ required: true, revocable: true, clawbackEnabled: true });
    // No asset contract deployed: only the classic issuer account holds the powers.
    expect(r.admin.kind).toBe("none");
    expect(r.habeas).toBeNull();
    expect(r.history.complete).toBe(true);
    const sep19 = r.history.takeBacks.find((o) => o.op === "277026709147193345");
    expect(sep19).toMatchObject({ amount: "24000.0000000", holder: "GD74GGNTM2W5QTE56OKDXTU6672SXKX3MSYFYMCBZTYTAZXSQCMABGZ7" });
    expect(r.verdict).toBe("used-without-process");
  });

  it("sees that USDC's asset contract is run by another contract, and scans only part of a huge history", async () => {
    const r = await checkAsset("mainnet", "USDC", USDC);
    expect(r.flags).toMatchObject({ revocable: true, clawbackEnabled: false });
    expect(r.admin.kind).toBe("contract");
    expect(r.admin.wasmHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.history.complete).toBe(false);
    expect(r.history.scanned).toBe(2000);
    expect(r.holders).toBeGreaterThan(1_000_000);
  });

  it("reports BENJI's admin as the issuer account itself", async () => {
    const r = await checkAsset("mainnet", "BENJI", BENJI);
    expect(r.flags).toMatchObject({ required: true, revocable: true, clawbackEnabled: true });
    expect(r.admin).toMatchObject({ deployed: true, kind: "issuer", address: BENJI });
    expect(r.verdict).not.toBe("protected");
  });
});

describe("checkAsset on testnet", () => {
  it("calls the Habeas demo asset protected: verified build, back door closed, cases on record", async () => {
    const [code, issuer] = deployment.asset.split(":");
    const r = await checkAsset("testnet", code, issuer);
    expect(r.admin).toMatchObject({ kind: "habeas", address: deployment.habeas, wasmHash: deployment.wasm_sha256 });
    expect(r.habeas?.backDoor.closed).toBe(true);
    expect(r.habeas?.reviewer).toBe(deployment.reviewer);
    expect(r.habeas?.caseCount).toBeGreaterThanOrEqual(6);
    expect(r.habeas?.takenBackCount).toBeGreaterThanOrEqual(3);
    expect(r.verdict).toBe("protected");
  });

  it("doesn't trust a Habeas-like contract whose build isn't verified", async () => {
    // The first demo deployment, from a local build (deployments/archive/local-build).
    const r = await checkAsset("testnet", "DEMOUSD", "GB5PGGVSMLPYEMDKI7PIT4H2EOLCELWJJOMPQ4JHMSUMMI5VRZJMNETU");
    expect(r.admin.address).toBe("CD63RIFBMVZR7DYQB33MEPBXD4UQVJXBKV7RGTCOELQEZ55BV3LK6LQN");
    expect(r.admin.kind).toBe("contract");
    expect(r.verdict).not.toBe("protected");
  });

  it("explains an issuer account that doesn't exist", async () => {
    const nobody = Keypair.random().publicKey();
    await expect(checkAsset("testnet", "NOPE", nobody)).rejects.toThrow(/no record/);
  });

  it("explains an asset code the issuer never issued", async () => {
    await expect(checkAsset("testnet", "NOPE", deployment.issuer)).rejects.toThrow(/has no NOPE issued by this account/);
  });
});
