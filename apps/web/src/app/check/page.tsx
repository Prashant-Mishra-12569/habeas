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
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-8 sm:pt-14">
      <h1 className="text-3xl sm:text-4xl">{t.check.title}</h1>
      <p className="mt-3 max-w-[60ch] text-muted">{t.check.lead}</p>
      <div className="mt-10">
        <CheckForm />
      </div>
    </main>
  );
}
