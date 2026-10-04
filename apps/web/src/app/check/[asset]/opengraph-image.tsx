import { parseAsset } from "@/lib/asset-check";
import { shortAddress } from "@/lib/format";
import { NotFoundError, horizon, type Network } from "@/lib/network";
import { OG_COLORS as C, OG_SIZE, ogCard } from "@/lib/og";
import { SITE_URL } from "@/lib/site";

export const alt = "Can this Stellar token be frozen or taken back? The issuer's settings, read live";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

type Flags = { flags: { auth_revocable: boolean; auth_clawback_enabled: boolean } };

/** Share images get no query string, so look on mainnet first, then testnet. */
async function issuerFlags(issuer: string): Promise<{ network: Network; flags: Flags["flags"] } | null> {
  for (const network of ["mainnet", "testnet"] as const) {
    try {
      return { network, flags: (await horizon<Flags>(network, `/accounts/${issuer}`)).flags };
    } catch (e) {
      if (!(e instanceof NotFoundError)) return null;
    }
  }
  return null;
}

function Answer({ q, yes }: { q: string; yes: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 18, fontSize: 36, color: C.ink, marginTop: 10 }}>
      <div style={{ display: "flex", width: 560 }}>{q}</div>
      <div style={{ display: "flex", fontWeight: 800, color: yes ? C.taken : C.cleared }}>{yes ? "Yes" : "No"}</div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params;
  const footer = `Full history and verdict: ${SITE_URL.replace(/^https?:\/\//, "")}/check`;
  let parsed: { code: string; issuer: string } | null = null;
  try {
    parsed = parseAsset(decodeURIComponent(asset));
  } catch {
    // Not an asset: fall through to the plain card.
  }
  const found = parsed ? await issuerFlags(parsed.issuer) : null;
  return ogCard(
    [
      <div key="t" style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 14 }}>
        <div style={{ display: "flex", fontSize: 88, fontWeight: 800, letterSpacing: -2, color: C.ink }}>{parsed?.code ?? "Check a token"}</div>
        {parsed && (
          <div style={{ display: "flex", fontFamily: "Plex Mono", fontSize: 28, color: C.muted }}>
            {shortAddress(parsed.issuer, 6)}
            {found ? ` · ${found.network}` : ""}
          </div>
        )}
      </div>,
      ...(found
        ? [
            <Answer key="f" q="Can the issuer freeze it?" yes={found.flags.auth_revocable} />,
            <Answer key="c" q="Can it be taken back (clawback)?" yes={found.flags.auth_clawback_enabled} />,
          ]
        : [
            <div key="u" style={{ display: "flex", fontSize: 36, color: C.ink, marginTop: 12 }}>
              Can it be frozen or taken back? Read live from Stellar.
            </div>,
          ]),
    ],
    footer,
  );
}
