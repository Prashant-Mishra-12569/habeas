import type { Metadata } from "next";
import { TryLive } from "@/components/TryLive";
import { getDict } from "@/i18n/server";

export const metadata: Metadata = { title: "Try it live · Habeas" };

export default async function TryPage() {
  const { t } = await getDict();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-8 sm:pt-14">
      <h1 className="text-[clamp(2.1rem,8vw,3.24rem)]">{t.tryIt.title}</h1>
      <p className="mt-4 max-w-[60ch] sm:text-lg">{t.tryIt.lead}</p>
      <div className="mt-8 sm:mt-10">
        <TryLive />
      </div>
    </main>
  );
}
