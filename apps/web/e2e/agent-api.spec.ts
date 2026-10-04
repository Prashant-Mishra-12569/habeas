// The paid agent check. Without payment: a 402 that asks for exactly 0.001
// testnet USDC to the published address. With payment (only when
// AGENT_SECRET, a testnet account holding testnet USDC, is set): a real x402
// payment on testnet, a signed answer, and a failed check that costs nothing.
import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { expect, test } from "@playwright/test";

const USBDCP = "USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E";
const PAY_TO = "GD2YGUUJU4LC75TFPODRSZVQEX472MVIFMN5XD77GZREWFCCSTBGG7U2";
const TESTNET_USDC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

// Written apart from the server's version on purpose, from the rule published at /api/v1/key.
const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`
      : JSON.stringify(v);

test("an unpaid request gets a 402 with the price", async ({ request }) => {
  const res = await request.get(`/api/v1/check/${USBDCP}`);
  expect(res.status()).toBe(402);
  const required = JSON.parse(Buffer.from(res.headers()["payment-required"], "base64").toString());
  expect(required.x402Version).toBe(2);
  expect(required.accepts).toEqual([
    expect.objectContaining({ scheme: "exact", network: "stellar:testnet", amount: "10000", asset: TESTNET_USDC, payTo: PAY_TO }),
  ]);
});

test.describe("paid", () => {
  test.skip(!process.env.AGENT_SECRET, "AGENT_SECRET is not set");
  test.setTimeout(3 * 60_000);

  test("pays on testnet and gets a signed answer; a bad request costs nothing", async ({ baseURL }) => {
    const signer = createEd25519Signer(process.env.AGENT_SECRET!, "stellar:testnet");
    const pay = wrapFetchWithPayment(fetch, new x402Client().register("stellar:testnet", new ExactStellarScheme(signer)));
    const key = (await (await fetch(`${baseURL}/api/v1/key`)).json()).signer as string;

    const res = await pay(`${baseURL}/api/v1/check/${USBDCP}`);
    expect(res.status).toBe(200);
    const receipt = decodePaymentResponseHeader(res.headers.get("PAYMENT-RESPONSE")!);
    expect(receipt.success).toBe(true);
    expect(receipt.transaction).toMatch(/^[0-9a-f]{64}$/);

    const { attestation, ...signed } = await res.json();
    expect(attestation.signer).toBe(key);
    expect(signed.result.verdict).toBe("used-without-process");
    expect(attestation.prefix).toBe("habeas-check-v1:");
    const digest = createHash("sha256").update(attestation.prefix + canonical(signed)).digest();
    expect(Keypair.fromPublicKey(key).verify(digest, Buffer.from(attestation.signature, "base64"))).toBe(true);

    // Not an asset: the server refuses after seeing the payment, so it is never collected.
    const bad = await pay(`${baseURL}/api/v1/check/not-an-asset`);
    expect(bad.status).toBe(400);
    expect(bad.headers.get("PAYMENT-RESPONSE")).toBeNull();
  });
});
