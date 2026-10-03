import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import deployment from "@/config/testnet.json";
import { checkHref } from "@/lib/examples";
import { getDict } from "@/i18n/server";

export const metadata: Metadata = { title: "Try it live · Habeas" };

// Placeholder until the Try it live flow ships. Honest about it, no fake demo.
export default async function TryPage() {
  const { t } = await getDict();
  const [code, issuer] = deployment.asset.split(":");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-14 sm:px-8">
      <h1 className="text-3xl sm:text-4xl">{t.tryIt.title}</h1>
      <p className="mt-4 max-w-[60ch] text-lg">{t.tryIt.lead}</p>
      <p className="mt-8 max-w-[60ch] text-muted">{t.tryIt.soon}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <ButtonLink href="/evidence">{t.tryIt.evidence}</ButtonLink>
        <ButtonLink href={checkHref({ code, issuer, network: "testnet" })} variant="secondary">
          {t.tryIt.demo}
        </ButtonLink>
      </div>
    </main>
  );
}
