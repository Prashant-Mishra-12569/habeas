import { PageHeader } from "@/components/PageHeader";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { MyCases } from "@/components/RolePages";
import { TelegramAlerts } from "@/components/TelegramAlerts";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  return pageMeta({ ...t.meta.pages.me, path: "/me", lang });
}

export default async function MePage() {
  const { t } = await getDict();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-10 sm:px-8 sm:pt-16">
      <PageHeader title={t.roles.me.title} lead={t.roles.me.lead} note={t.notes.me} />
      <div className="mt-10">
        <MyCases />
      </div>
      <TelegramAlerts className="mt-12" title={t.telegram.title} body={t.telegram.bodyAny} button={t.telegram.button} />
    </main>
  );
}
