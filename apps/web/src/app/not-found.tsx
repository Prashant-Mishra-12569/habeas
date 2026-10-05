import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";
import { getDict } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getDict();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-12 sm:px-8 sm:pt-20">
      <PageHeader kicker="404" title={t.notFound.title} lead={t.notFound.body} note={t.notes.notFound} />
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/">{t.notFound.home}</ButtonLink>
        <ButtonLink href="/check" variant="secondary">
          {t.nav.check}
        </ButtonLink>
        <ButtonLink href="/try" variant="secondary">
          {t.nav.try}
        </ButtonLink>
      </div>
    </main>
  );
}
