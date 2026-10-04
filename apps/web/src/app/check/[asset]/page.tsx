import type { Metadata } from "next";
import { AnswerSheet } from "@/components/AnswerSheet";
import { CheckForm } from "@/components/CheckForm";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { checkAsset, parseAsset } from "@/lib/asset-check";
import { ReadError } from "@/lib/network";
import { getDict } from "@/i18n/server";
import { issuerFlags } from "@/lib/issuer-flags";
import { pageMeta } from "@/lib/site";

// Read from Stellar on every request; nothing is cached or stored.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: PageProps<"/check/[asset]">): Promise<Metadata> {
  const [{ asset }, { network: net }, { t, lang }] = await Promise.all([params, searchParams, getDict()]);
  const network = net === "testnet" ? "testnet" : "mainnet";
  const raw = decodeURIComponent(asset);
  const code = raw.split(/[-:]/)[0];
  const path = `/check/${asset}${network === "testnet" ? "?network=testnet" : ""}`;
  // The full check scans the issuer's history and can take seconds; metadata
  // waiting on it would arrive after the page has started streaming. The
  // issuer's settings are one fast read and answer the headline question.
  try {
    const { issuer } = parseAsset(raw);
    const f = await issuerFlags(network, issuer);
    return pageMeta({ title: t.meta.checkTitle(code), description: t.meta.checkDescription(code, f.revocable, f.clawback), path, lang });
  } catch {
    return pageMeta({ title: t.meta.checkTitle(code), description: t.meta.pages.check.description, path, lang, index: false });
  }
}

export default async function CheckResultPage({ params, searchParams }: PageProps<"/check/[asset]">) {
  const { t } = await getDict();
  const { asset } = await params;
  const { network: net } = await searchParams;
  const network = net === "testnet" ? "testnet" : "mainnet";
  const raw = decodeURIComponent(asset);

  let result: Awaited<ReturnType<typeof checkAsset>> | null = null;
  let error = "";
  try {
    const { code, issuer } = parseAsset(raw);
    result = await checkAsset(network, code, issuer);
  } catch (e) {
    error = e instanceof ReadError ? e.message : `Unexpected error: ${(e as Error).message}`;
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-8 sm:pt-14">
      {result ? <AnswerSheet r={result} /> : <ReadErrorNotice what={raw} message={error} />}
      <section className="mt-20">
        <h2 className="text-xl">{t.check.another}</h2>
        <div className="mt-6">
          <CheckForm initialNetwork={network} />
        </div>
      </section>
    </main>
  );
}
