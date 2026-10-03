import { getDict } from "@/i18n/server";

/** Shown while the check reads Stellar: an empty form, never placeholder data. */
export default async function Loading() {
  const { t } = await getDict();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-14 sm:px-8" aria-busy="true">
      <p className="text-lg text-muted" role="status">
        {t.loading}
      </p>
      <div className="mt-10 rounded-[2px] border border-rule bg-sheet">
        <div className="perforation mx-4 mt-3" aria-hidden />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid gap-2 border-b border-rule px-5 py-5 last:border-b-0 md:grid-cols-[2fr_3fr]">
            <span className="h-3 w-2/3 rounded-[1px] bg-rule" />
            <span className="h-3 w-1/3 rounded-[1px] bg-rule opacity-60" />
          </div>
        ))}
      </div>
    </main>
  );
}
