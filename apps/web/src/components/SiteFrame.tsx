import Link from "next/link";
import type { Theme } from "@/i18n/server";
import type { Dict } from "@/i18n/dict";
import { Prefs } from "./Prefs";

/**
 * The name, printed with a slight carbon-copy misregistration: canary and
 * pink copies sit a pixel or two off behind the original.
 */
export function Wordmark({ label }: { label: string }) {
  return (
    <Link href="/" aria-label={label} className="inline-flex min-h-11 items-center text-xl font-extrabold tracking-[-0.03em]">
      <span className="relative">
        <span aria-hidden className="absolute left-[3px] top-[3px] select-none text-[color:var(--pink)]">
          Habeas
        </span>
        <span aria-hidden className="absolute left-[1.5px] top-[1.5px] select-none text-[color:var(--canary)]">
          Habeas
        </span>
        <span className="relative">Habeas</span>
      </span>
    </Link>
  );
}

export function SiteHeader({ t, theme }: { t: Dict; theme: Theme }) {
  const nav = [
    { href: "/check", label: t.nav.check },
    { href: "/try", label: t.nav.try },
    { href: "/evidence", label: t.nav.evidence },
  ];
  return (
    <header className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Wordmark label={t.nav.home} />
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex gap-6 text-sm">
              {nav.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="inline-flex min-h-11 items-center text-muted hover:text-ink">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <Prefs initialTheme={theme} />
      </div>
      <nav aria-label="Main" className="mt-2 md:hidden">
        <ul className="flex gap-5 text-sm">
          {nav.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="inline-flex min-h-11 items-center text-muted hover:text-ink">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function SiteFooter({ t }: { t: Dict }) {
  return (
    <footer className="mx-auto mt-24 w-full max-w-6xl px-4 pb-10 sm:px-8">
      <div className="perforation" aria-hidden />
      <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-lg font-extrabold tracking-tight">{t.footer.motto}</p>
          <p className="mt-1 max-w-[60ch] text-sm text-muted">{t.footer.built}</p>
        </div>
        <ul className="flex flex-wrap gap-5 text-sm">
          <li>
            <Link className="inline-flex min-h-11 items-center underline" href="/evidence">
              {t.nav.evidence}
            </Link>
          </li>
          <li>
            <a className="inline-flex min-h-11 items-center underline" href="https://github.com/Prashant-Mishra-12569/habeas">
              {t.nav.code}
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
