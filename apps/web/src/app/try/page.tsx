import { PageHeader } from "@/components/PageHeader";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { TryLive } from "@/components/TryLive";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  return pageMeta({ ...t.meta.pages.try, path: "/try", lang });
}

export default async function TryPage() {
  const { t } = await getDict();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-10 sm:px-8 sm:pt-16">
      <PageHeader title={t.tryIt.title} lead={t.tryIt.lead} note={t.notes.try} />
      <div className="mt-10 sm:mt-14">
        <TryLive />
      </div>
    </main>
  );
}
