// Accessibility on every page, with axe (the engine behind Lighthouse's
// accessibility score): WCAG 2.x A and AA rules, in both themes and both
// languages on a phone, and on desktop, where the "how a case works" steps
// change with scrolling. Lighthouse alone checks one phone size in one theme.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/check",
  "/check/USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E",
  "/case/19",
  "/try",
  "/evidence",
  "/developers",
  "/me",
  "/issuer",
  "/review",
];

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false };
const VARIANTS = [
  { theme: "paper", lang: "en", device: PHONE, name: "phone" },
  { theme: "carbon", lang: "es", device: PHONE, name: "phone" },
  { theme: "paper", lang: "en", device: DESKTOP, name: "desktop" },
];

for (const v of VARIANTS) {
  test.describe(`${v.name}, ${v.theme}, ${v.lang}`, () => {
    test.use({ ...v.device, reducedMotion: "reduce" });

    for (const path of PAGES) {
      test(`${path} has no WCAG A/AA violations`, async ({ page, context, baseURL }) => {
        await context.addCookies([
          { name: "theme", value: v.theme, url: baseURL! },
          { name: "lang", value: v.lang, url: baseURL! },
        ]);
        await page.goto(path, { waitUntil: "networkidle" });
        // Rows fade in one after another; measure contrast once they've landed, not mid-fade.
        await page.waitForFunction(() =>
          document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
        );
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const summary = violations.map((x) => `${x.id} (${x.impact}): ${x.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
        expect(summary).toEqual([]);
      });
    }
  });
}
