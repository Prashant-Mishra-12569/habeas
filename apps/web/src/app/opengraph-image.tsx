import { OG_COLORS as C, OG_SIZE, ogCard } from "@/lib/og";
import { SITE_URL } from "@/lib/site";

export const alt = "Habeas: a fair process before anyone takes your tokens";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return ogCard(
    [
      <div key="h" style={{ display: "flex", fontSize: 62, fontWeight: 800, color: C.ink, lineHeight: 1.06, letterSpacing: -1.5, maxWidth: 960 }}>
        Your tokens can be frozen and taken. You should know why.
      </div>,
      <div key="p" style={{ display: "flex", fontSize: 29, color: C.muted, marginTop: 20 }}>
        A public reason, a deadline to answer and a neutral reviewer, on Stellar.
      </div>,
    ],
    SITE_URL.replace(/^https?:\/\//, ""),
  );
}
