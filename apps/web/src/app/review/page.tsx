import type { Metadata } from "next";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { ReviewQueue } from "@/components/RolePages";
import { getConfig } from "@/lib/habeas";
import { reviewQueue } from "@/lib/wallet-tx";
import { getDict } from "@/i18n/server";

export const metadata: Metadata = { title: "Review queue · Habeas" };
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
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-8 sm:pt-14">
      <h1 className="text-[clamp(2.1rem,8vw,3.24rem)]">{t.roles.review.title}</h1>
      <p className="mt-3 max-w-[60ch] text-muted">{t.roles.review.lead}</p>
      <div className="mt-8">
        {config ? <ReviewQueue cases={cases} reviewer={config.reviewer} now={now} /> : <ReadErrorNotice what="the review queue" message={error} />}
      </div>
    </main>
  );
}
