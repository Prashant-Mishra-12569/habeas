import { PageHeader } from "@/components/PageHeader";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { ReviewQueue } from "@/components/RolePages";
import { getConfig } from "@/lib/habeas";
import { reviewQueue } from "@/lib/wallet-tx";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  return pageMeta({ ...t.meta.pages.review, path: "/review", lang });
}
export const dynamic = "force-dynamic";

async function load() {
  try {
    const [config, cases] = await Promise.all([getConfig(), reviewQueue()]);
    return { config, cases, now: Math.floor(Date.now() / 1000), error: "" };
  } catch (e) {
    return { config: null, cases: [], now: 0, error: (e as Error).message };
  }
}

export default async function ReviewPage() {
  const { t } = await getDict();
  const { config, cases, now, error } = await load();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-10 sm:px-8 sm:pt-16">
      <PageHeader title={t.roles.review.title} lead={t.roles.review.lead} note={t.notes.review} />
      <div className="mt-10">
        {config ? <ReviewQueue cases={cases} reviewer={config.reviewer} now={now} /> : <ReadErrorNotice what="the review queue" message={error} />}
      </div>
    </main>
  );
}
