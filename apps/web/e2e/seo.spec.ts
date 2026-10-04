// What search engines and link previews read: a title and description per
// page, a canonical link, a share image that actually renders, and the
// sitemap, robots and manifest files. Case and token pages describe real
// chain data.
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/check",
  "/try",
  "/evidence",
  "/developers",
  "/me",
  "/case/20",
  "/check/USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E",
];

test("every page has its own title, description, canonical link and share image", async ({ page, request }) => {
  test.setTimeout(180_000);
  const titles = new Set<string>();
  for (const path of PAGES) {
    await page.goto(path);
    const title = await page.title();
    const meta = (sel: string) => page.locator(sel).first().getAttribute("content");
    const description = await meta('meta[name="description"]');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    const image = await meta('meta[property="og:image"]');

    expect(title, path).toMatch(/Habeas/);
    expect(titles.has(title), `${path} repeats the title "${title}"`).toBe(false);
    titles.add(title);
    expect(description?.length ?? 0, `${path} description`).toBeGreaterThan(50);
    expect(description?.length ?? 0, `${path} description`).toBeLessThan(200);
    expect(new URL(canonical!).pathname, `${path} canonical`).toBe(path.split("?")[0]);
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");

    // The share image must render, from the path the page advertises.
    const img = await request.get(new URL(image!).pathname + new URL(image!).search);
    expect(img.status(), `${path} share image`).toBe(200);
    expect(img.headers()["content-type"]).toBe("image/png");
  }
});

test("case and token pages describe what's on the chain", async ({ page }) => {
  await page.goto("/case/20");
  await expect(page).toHaveTitle("Case #20: Taken back · Habeas");
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toMatch(/^400 DEMOUSD\. Reason: Suspected fraud\./);
  await page.goto("/check/USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E");
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toContain("Can the issuer freeze USBDCP? Yes. Can it be taken back (clawback)? Yes.");
});

test("the styleguide stays out of search results", async ({ page }) => {
  await page.goto("/styleguide");
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toMatch(/noindex/);
});

test("sitemap, robots, manifest and icons are served", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/check/USBDCP-");
  expect(sitemap).toContain("/case/20</loc>");
  expect(await (await request.get("/robots.txt")).text()).toMatch(/Disallow: \/api\/[\s\S]*Sitemap: /);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.icons.map((i: { purpose: string }) => i.purpose)).toContain("maskable");
  for (const path of ["/favicon.ico", "/icon.png", "/apple-icon.png", ...manifest.icons.map((i: { src: string }) => i.src)]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});

test("an unknown address gets a real 404 that search engines skip", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page isn't on file.");
  expect(await page.locator('meta[name="robots"]').first().getAttribute("content")).toMatch(/noindex/);
});
