import type { Metadata } from "next";
import { cache } from "react";
import { AnswerSheet } from "@/components/AnswerSheet";
import { CheckForm } from "@/components/CheckForm";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { checkAsset, parseAsset } from "@/lib/asset-check";
import { ReadError } from "@/lib/network";
import { getDict } from "@/i18n/server";
import { pageMeta } from "@/lib/site";

// Read from Stellar on every request; nothing is cached or stored.
export const dynamic = "force-dynamic";

/** One check per request, shared by the page and its metadata. */
const check = cache((network: "mainnet" | "testnet", raw: string) => {
  const { code, issuer } = parseAsset(raw);
  return checkAsset(network, code, issuer);
});

export async function generateMetadata({ params, searchParams }: PageProps<"/check/[asset]">): Promise<Metadata> {
  const [{ asset }, { network: net }, { t, lang }] = await Promise.all([params, searchParams, getDict()]);
  const network = net === "testnet" ? "testnet" : "mainnet";
  const raw = decodeURIComponent(asset);
  const code = raw.split(/[-:]/)[0];
  const path = `/check/${asset}${network === "testnet" ? "?network=testnet" : ""}`;
  try {
    const r = await check(network, raw);
    return pageMeta({ title: t.meta.checkTitle(r.code), description: t.meta.checkDescription(t.check.verdict[r.verdict], t.check.verdictLine[r.verdict]), path, lang });
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
    result = await check(network, raw);
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
