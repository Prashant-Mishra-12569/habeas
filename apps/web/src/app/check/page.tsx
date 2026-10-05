import { PageHeader } from "@/components/PageHeader";
import type { Metadata } from "next";
import { CheckForm } from "@/components/CheckForm";
import { getDict } from "@/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  return pageMeta({ ...t.meta.pages.check, path: "/check", lang });
}

export default async function CheckPage() {
  const { t } = await getDict();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-10 sm:px-8 sm:pt-16">
      <PageHeader title={t.check.title} lead={t.check.lead} note={t.notes.check} />
      <div className="mt-10 sm:mt-14">
        <CheckForm />
      </div>
    </main>
  );
}
