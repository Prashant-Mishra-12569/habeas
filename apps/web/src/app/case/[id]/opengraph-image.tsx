import { DICTS } from "@/i18n/dict";
import { formatTokens } from "@/lib/format";
import { deployment, getCase } from "@/lib/habeas";
import { OG_COLORS as C, OG_SIZE, ogCard } from "@/lib/og";
import { SITE_URL } from "@/lib/site";

export const alt = "A Habeas case on Stellar testnet: its status, amount and reason";
export const size = OG_SIZE;
export const contentType = "image/png";
// The stamp follows the case as it moves.
export const dynamic = "force-dynamic";

const STAMP = { Cleared: C.cleared, TakenBack: C.taken } as Record<string, string>;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = DICTS.en;
  const asset = deployment.asset.split(":")[0];
  const footer = `${SITE_URL.replace(/^https?:\/\//, "")}/case/${id}`;
  const c = await getCase(Number(id)).catch(() => null);
  if (!c) {
    // No data, no claims: just the case number.
    return ogCard([<div key="n" style={{ display: "flex", fontSize: 80, fontWeight: 800, color: C.ink }}>Case #{id}</div>], footer);
  }
  const statement = c.statement.length > 120 ? `${c.statement.slice(0, 117)}…` : c.statement;
  return ogCard(
    [
      <div key="n" style={{ display: "flex", fontFamily: "Plex Mono", fontSize: 30, color: C.muted }}>
        Case #{c.id} · {asset} on Stellar testnet
      </div>,
      <div key="s" style={{ display: "flex", fontSize: 92, fontWeight: 800, letterSpacing: -2, color: STAMP[c.status] ?? C.pen, marginTop: 6 }}>
        {t.words.status[c.status]}
      </div>,
      <div key="a" style={{ display: "flex", fontSize: 34, color: C.ink, marginTop: 10 }}>
        {formatTokens(c.amount)} {asset} · Reason: {t.words.reason[c.reason]}
      </div>,
      statement && (
        <div key="q" style={{ display: "flex", fontSize: 26, color: C.muted, marginTop: 14, maxWidth: 980 }}>
          “{statement}”
        </div>
      ),
    ],
    footer,
  );
}
