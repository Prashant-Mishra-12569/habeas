// The whole Try it live flow, as a visitor without a wallet, on real testnet:
// get test tokens, get frozen, answer for free, the reviewer decides, settle
// (Cleared), then the second ending: stay silent and see the tokens taken
// back. Needs the demo keys on the server (apps/web/.env.example); skipped
// when they're missing.
import { expect, test } from "@playwright/test";

const hasKeys = Boolean(process.env.RELAYER_SECRET && process.env.HABEAS_ISSUER_SECRET && process.env.HABEAS_REVIEWER_SECRET) || !process.env.CI;

test.describe("Try it live without a wallet", () => {
  test.skip(!hasKeys, "demo keys are not configured");
  test.setTimeout(10 * 60_000);

  for (const size of [
    { name: "phone", width: 390, height: 844, mobile: true },
  ]) {
    test(`a real case, both endings (${size.name})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile });
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const chain = { timeout: 120_000 };

      await page.goto("/try");
      await page.getByRole("button", { name: "Start without a wallet" }).click();

      // Funding and the trustline happen on their own for a test wallet.
      await expect(page.getByText("Test wallet:")).toBeVisible(chain);
      await page.getByRole("button", { name: "Freeze me: open a test case" }).click(chain);
      await expect(page.getByText("Frozen", { exact: true })).toBeVisible(chain);

      await page.getByRole("button", { name: "Send my answer" }).click(chain);
      await page.getByRole("button", { name: "Ask the reviewer to decide" }).click(chain);
      await page.getByRole("button", { name: "Settle case" }).click(chain);
      await expect(page.getByText("Cleared. Your DEMOUSD is unfrozen and nothing was taken.")).toBeVisible(chain);

      // Every step of the first case has its transaction.
      const timeline = page.getByRole("region", { name: "What happened" }).first();
      await expect(timeline.getByRole("link")).toHaveCount(4, chain);

      // The other ending: open a case and stay silent until the window closes.
      await page.getByRole("button", { name: "Open a case I won't answer" }).click(chain);
      await expect(page.getByText(/The answer window closes in \d+:\d\d/)).toBeVisible(chain);
      await page.getByRole("button", { name: "Settle case" }).click({ timeout: 5 * 60_000 });
      await expect(page.getByText(/Taken back: 400 DEMOUSD went back to the issuer/)).toBeVisible(chain);

      expect(errors).toEqual([]);
      await ctx.close();
    });
  }
});
