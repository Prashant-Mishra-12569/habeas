// Full-page screenshots of every page on phones, tablets and desktop, to
// check layouts by eye. Reduced motion, so forms show their final state.
//
// Usage: node e2e/screens.mjs <outDir> [baseUrl] [--lang es] [--theme carbon] [--only 320,390] [--pages /,/try]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const out = args[0];
const base = args[1] && !args[1].startsWith("--") ? args[1] : "http://localhost:3000";
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const lang = opt("lang") ?? "en";
const theme = opt("theme") ?? "paper";

const DEVICES = [
  { name: "320", width: 320, height: 568, mobile: true }, // iPhone SE (1st gen), small Androids
  { name: "360", width: 360, height: 800, mobile: true }, // common Android
  { name: "390", width: 390, height: 844, mobile: true }, // iPhone 14/15
  { name: "412", width: 412, height: 915, mobile: true }, // Pixel
  { name: "768", width: 768, height: 1024, mobile: true }, // iPad portrait
  { name: "1024", width: 1024, height: 768, mobile: false }, // iPad landscape, small laptop
  { name: "1440", width: 1440, height: 900, mobile: false },
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

const only = opt("only")?.split(",");
const pages = opt("pages")?.split(",") ?? PAGES;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const d of DEVICES.filter((d) => !only || only.includes(d.name))) {
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: 1,
    isMobile: d.mobile,
    hasTouch: d.mobile,
    reducedMotion: "reduce",
  });
  await ctx.addCookies([
    { name: "lang", value: lang, url: base },
    { name: "theme", value: theme, url: base },
  ]);
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => problems.push(e.message.slice(0, 160)));
  for (const p of pages) {
    problems.length = 0;
    await page.goto(base + p, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(800);
    // In dev, Next shows hydration and other errors as an "Issue" badge.
    const issue = await page.evaluate(() => {
      const root = document.querySelector("nextjs-portal")?.shadowRoot;
      if (!root) return "";
      const t = [...root.querySelectorAll("*")].filter((e) => e.children.length === 0 && !["STYLE", "SCRIPT"].includes(e.tagName)).map((e) => e.textContent.trim()).join(" ");
      return /Issue/.test(t) ? t.slice(0, 120) : "";
    });
    if (issue) problems.push(`dev overlay: ${issue}`);
    // Report anything wider than the screen, the usual cause of sideways scroll.
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      return {
        scrollW: document.documentElement.scrollWidth,
        w,
        wide: [...document.querySelectorAll("body *")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && (r.right > w + 0.5 || r.left < -0.5);
          })
          .slice(0, 5)
          .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} [${Math.round(e.getBoundingClientRect().left)},${Math.round(e.getBoundingClientRect().right)}]`),
        smallTargets: [...document.querySelectorAll("a, button, label, input, textarea, select")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            const inText = e.tagName === "A" && e.closest("p, li, dd, figcaption");
            return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44) && !inText && getComputedStyle(e).position !== "absolute";
          })
          .slice(0, 5)
          .map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
      };
    });
    const file = `${out}/${d.name}${p.replace(/[/?=]/g, "_").slice(0, 40) || "_home"}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const flag = over.scrollW > over.w || over.wide.length ? "OVERFLOW" : "ok";
    console.log(`${d.name.padEnd(5)} ${p.slice(0, 28).padEnd(28)} ${flag} ${over.wide.join(" | ")}${over.smallTargets.length ? `  small: ${over.smallTargets.join(" | ")}` : ""}${problems.length ? `  ERRORS: ${problems.join(" || ")}` : ""}`);
  }
  await ctx.close();
}
await browser.close();
