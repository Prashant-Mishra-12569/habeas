import { ButtonLink } from "@/components/Button";
import { getDict } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getDict();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-12 sm:px-8 sm:pt-20">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">{t.notFound.title}</h1>
      <p className="mt-3 max-w-[60ch]">{t.notFound.body}</p>
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
