import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Share cards (Open Graph / X), drawn like the site: a form sheet on paper
// with its canary and pink copies peeking out behind. Crawlers send no
// cookies, so the cards are in English on Paper.

export const OG_SIZE = { width: 1200, height: 630 };

const C = {
  paper: "#f7f8f4",
  sheet: "#fdfdfb",
  ink: "#1f2229",
  muted: "#50555e",
  rule: "#d6d9d0",
  pen: "#1f3a8f",
  canary: "#f1e8b8",
  pink: "#ebcfd3",
  cleared: "#2f6e4e",
  taken: "#9e2b33",
};
export const OG_COLORS = C;

// Read once per server instance. Each path is spelled out so the bundler
// ships just these files with the image routes.
const assets = Promise.all([
  readFile(join(process.cwd(), "assets", "fonts", "public-sans-latin-400-normal.woff")),
  readFile(join(process.cwd(), "assets", "fonts", "public-sans-latin-800-normal.woff")),
  readFile(join(process.cwd(), "assets", "fonts", "ibm-plex-mono-latin-500-normal.woff")),
  readFile(join(process.cwd(), "public", "brand", "habeas-mark.png")),
]);

/** Renders one card: the brand row on top, `lines` stacked in the middle, `footer` at the bottom. Satori needs real elements, not fragments, to stack them. */
export async function ogCard(lines: React.ReactNode[], footer: string) {
  const [regular, heavy, mono, mark] = await assets;
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.paper, padding: "44px 72px 64px 52px", fontFamily: "Public Sans" }}>
        <div style={{ position: "relative", display: "flex", flex: 1 }}>
          {/* The carbon copies, offset behind the sheet. */}
          <div style={{ position: "absolute", top: 20, left: 20, right: -20, bottom: -20, background: C.pink, borderRadius: 4, display: "flex" }} />
          <div style={{ position: "absolute", top: 10, left: 10, right: -10, bottom: -10, background: C.canary, borderRadius: 4, display: "flex" }} />
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: C.sheet,
              border: `2px solid ${C.rule}`,
              borderRadius: 4,
              padding: "26px 48px 34px",
            }}
          >
            {/* Perforation along the top edge. */}
            <div style={{ display: "flex", gap: 14, overflow: "hidden" }}>
              {Array.from({ length: 60 }, (_, i) => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: 5, background: C.rule }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- satori draws plain img elements */}
              <img src={markSrc} height={64} width={84} alt="" />
              <div style={{ fontSize: 40, fontWeight: 800, color: C.ink, letterSpacing: -1 }}>Habeas</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", paddingBottom: 8 }}>
              {lines}
            </div>
            <div style={{ display: "flex", borderTop: `3px solid ${C.ink}`, paddingTop: 18, fontSize: 26, color: C.muted }}>{footer}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Public Sans", data: regular, weight: 400, style: "normal" },
        { name: "Public Sans", data: heavy, weight: 800, style: "normal" },
        { name: "Plex Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
