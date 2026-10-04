// Signed answers for the paid agent check: the signature covers exactly the
// fields a buyer gets, in a stable order, and any change breaks it.
import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import { ATTEST_PREFIX, attest, canonicalJson } from "./attest";

const digest = (signed: unknown) => createHash("sha256").update(ATTEST_PREFIX + canonicalJson(signed)).digest();

describe("canonicalJson", () => {
  it("sorts keys at every level and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: "x" }, u: undefined })).toBe('{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it("gives the same text whatever order the keys were built in", () => {
    expect(canonicalJson({ x: 1, y: null })).toBe(canonicalJson({ y: null, x: 1 }));
  });
});

describe("attest", () => {
  // A throwaway key made for this test; never a real one.
  const key = Keypair.random();
  beforeAll(() => {
    process.env.HABEAS_ATTEST_SECRET = key.secret();
  });

  it("signs what the buyer receives, and only that", () => {
    const { signed, attestation } = attest({ resource: "DEMOUSD-G", network: "testnet", result: { verdict: "protected", flags: { revocable: true } } });
    expect(attestation.signer).toBe(key.publicKey());
    expect(attestation.signedAt).toBe(signed.signedAt);
    const sig = Buffer.from(attestation.signature, "base64");
    expect(Keypair.fromPublicKey(key.publicKey()).verify(digest(signed), sig)).toBe(true);

    // The buyer gets the fields back as JSON, in whatever order; the check still passes.
    const roundTrip = JSON.parse(JSON.stringify({ result: signed.result, signedAt: signed.signedAt, network: signed.network, resource: signed.resource }));
    expect(Keypair.fromPublicKey(key.publicKey()).verify(digest(roundTrip), sig)).toBe(true);

    // Change one fact and the signature no longer matches.
    const tampered = { ...signed, result: { verdict: "no-powers", flags: { revocable: true } } };
    expect(Keypair.fromPublicKey(key.publicKey()).verify(digest(tampered), sig)).toBe(false);
  });
});
