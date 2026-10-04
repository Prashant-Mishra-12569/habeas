// Makes every logo size the site needs from the one source file, so a new
// logo is a single replace and a re-run:
//
//   node scripts/make-brand.mjs
//
// Source: public/brand/habeas-logo.png (transparent background, any size).
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const at = (p) => new URL(p, root).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PAPER = "#f7f8f4";
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// The source has wide transparent margins; work from the mark itself.
const mark = await sharp(at("public/brand/habeas-logo.png")).trim().png().toBuffer();

/** The mark centred in a square, filling `fill` of its width or height. */
async function square(size, { fill = 0.92, background = CLEAR } = {}) {
  const inner = Math.round(size * fill);
  const fitted = await sharp(mark).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
  const { width, height } = await sharp(fitted).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: fitted, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    .png()
    .toBuffer();
}

/** A .ico holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

// 256-colour PNGs with dithering: a quarter of the size, and the glow still reads smoothly.
const small = (buf) => sharp(buf).png({ palette: true, quality: 92, effort: 10, dither: 1 }).toBuffer();

const out = async (path, raw) => {
  const buf = path.endsWith(".png") ? await small(raw) : raw;
  mkdirSync(at(path.replace(/[^/]+$/, "")), { recursive: true });
  writeFileSync(at(path), buf);
  const { width, height } = await sharp(buf).metadata().catch(() => ({}));
  console.log(`${path}${width ? ` ${width}x${height}` : ""} ${(buf.length / 1024).toFixed(1)} KB`);
};

// Browser tab: small sizes fill the square, since every pixel counts there.
await out("src/app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await square(size, { fill: 1 }) })))));
await out("src/app/icon.png", await square(512));
// iOS fills transparency with black, so the home-screen icon sits on paper.
await out("src/app/apple-icon.png", await square(180, { fill: 0.78, background: PAPER }));
// Web app manifest: plain icons, and a maskable one with the mark inside the safe circle.
await out("public/brand/icon-192.png", await square(192));
await out("public/brand/icon-512.png", await square(512));
await out("public/brand/icon-maskable-512.png", await square(512, { fill: 0.62, background: PAPER }));
/**
 * The mark for Carbon: its navy pillars would vanish on the dark page, so
 * dark pixels are lifted toward a cool slate. Gold and highlights stay as
 * they are.
 */
async function forCarbon(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [tr, tg, tb] = [110, 124, 168];
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (l >= 120) continue;
    const t = ((120 - l) / 120) * 0.5;
    data[i] = Math.round(data[i] + (tr - data[i]) * t);
    data[i + 1] = Math.round(data[i + 1] + (tg - data[i + 1]) * t);
    data[i + 2] = Math.round(data[i + 2] + (tb - data[i + 2]) * t);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

// The mark for the header, footer and share images (trimmed, no margin).
const headerMark = await sharp(mark).resize({ height: 192 }).png().toBuffer();
await out("src/assets/habeas-mark.png", headerMark);
await out("src/assets/habeas-mark-carbon.png", await forCarbon(headerMark));
const bigMark = await sharp(mark).resize({ width: 640 }).png().toBuffer();
await out("public/brand/habeas-mark.png", bigMark);
await out("public/brand/habeas-mark-carbon.png", await forCarbon(bigMark));
// Telegram crops profile photos to a circle.
await out("../alerts/brand/bot-avatar.png", await square(640, { fill: 0.66, background: PAPER }));
