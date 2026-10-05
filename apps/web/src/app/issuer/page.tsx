import { PageHeader } from "@/components/PageHeader";
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
    <main className="mx-auto w-full max-w-4xl px-4 pt-10 sm:px-8 sm:pt-16">
      <PageHeader title={t.roles.issuer.title} lead={t.roles.issuer.lead} note={t.notes.issuer} />
      <div className="mt-10">
        {config instanceof Error ? <ReadErrorNotice what="the contract settings" message={config.message} /> : <IssuerForm issuer={config.issuer} />}
      </div>
    </main>
  );
}
