import { CheckForm } from "@/components/CheckForm";
import { getDict } from "@/i18n/server";

export default async function CheckPage() {
  const { t } = await getDict();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-14 sm:px-8">
      <h1 className="text-3xl sm:text-4xl">{t.check.title}</h1>
      <p className="mt-3 max-w-[60ch] text-muted">{t.check.lead}</p>
      <div className="mt-10">
        <CheckForm />
      </div>
    </main>
  );
}
