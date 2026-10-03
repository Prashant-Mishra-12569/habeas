// Every page fits every screen: no sideways scroll, no console errors, and
// header controls big enough to tap. Pages read real Stellar data.
import { expect, test } from "@playwright/test";

const SIZES = [
  { name: "small phone", width: 320, height: 640, mobile: true },
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "tablet", width: 768, height: 1024, mobile: true },
  { name: "desktop", width: 1440, height: 900, mobile: false },
];

const PAGES = [
  "/",
  "/check",
  "/check/USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E",
  "/check/DEMOUSD-GAHOUYYJZNCK4NP4PCHWXUJDJ6LP6CT5MPFDIKHW3EJH5GFXYAFVOP7G?network=testnet",
  "/case/8",
  "/try",
  "/evidence",
];

for (const size of SIZES) {
  test.describe(`${size.name} (${size.width}px)`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      isMobile: size.mobile,
      hasTouch: size.mobile,
    });

    for (const path of PAGES) {
      test(`${path} fits and has no errors`, async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto(path, { waitUntil: "networkidle" });

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(clientWidth);

        // Language and theme switches must be at least 44 px tall.
        for (const box of await page.locator("header fieldset label, header button").evaluateAll((els) =>
          els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect().height),
        )) {
          expect(box).toBeGreaterThanOrEqual(44);
        }

        expect(errors, "console errors").toEqual([]);
      });
    }
  });
}
