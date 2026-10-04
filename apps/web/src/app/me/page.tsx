import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { MyCases } from "@/components/RolePages";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  return pageMeta({ ...t.meta.pages.me, path: "/me", lang });
}

export default async function MePage() {
  const { t } = await getDict();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-8 sm:pt-14">
      <h1 className="text-[clamp(2.1rem,8vw,3.24rem)]">{t.roles.me.title}</h1>
      <p className="mt-3 max-w-[60ch] text-muted">{t.roles.me.lead}</p>
      <div className="mt-8">
        <MyCases />
      </div>
    </main>
  );
}
