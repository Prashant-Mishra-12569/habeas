import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { IssuerForm } from "@/components/RolePages";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { getConfig } from "@/lib/habeas";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  return pageMeta({ ...t.meta.pages.issuer, path: "/issuer", lang });
}
export const dynamic = "force-dynamic";

export default async function IssuerPage() {
  const { t } = await getDict();
  const config = await getConfig().catch((e: Error) => e);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-8 sm:pt-14">
      <h1 className="text-[clamp(2.1rem,8vw,3.24rem)]">{t.roles.issuer.title}</h1>
      <p className="mt-3 max-w-[60ch] text-muted">{t.roles.issuer.lead}</p>
      <div className="mt-8">
        {config instanceof Error ? <ReadErrorNotice what="the contract settings" message={config.message} /> : <IssuerForm issuer={config.issuer} />}
      </div>
    </main>
  );
}
