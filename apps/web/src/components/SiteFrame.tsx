import Image from "next/image";
import Link from "next/link";
import mark from "@/assets/habeas-mark.png";
import markCarbon from "@/assets/habeas-mark-carbon.png";
import type { Theme } from "@/i18n/server";
import type { Dict } from "@/i18n/dict";
import { Prefs } from "./Prefs";
import { telegramLink } from "@/lib/telegram";

/**
 * The Habeas mark. Decorative next to the name, so it has no alt text of its
 * own. Carbon gets a variant with lighter pillars (scripts/make-brand.mjs);
 * CSS picks one, so the server and browser render the same markup.
 */
export function Mark({ className = "h-7 w-auto" }: { className?: string }) {
  return (
    <>
      <Image src={mark} alt="" unoptimized loading="eager" className={`${className} carbon:hidden`} />
      <Image src={markCarbon} alt="" unoptimized loading="eager" className={`${className} hidden carbon:block`} />
    </>
  );
}

/**
 * The mark and the name, the name printed with a slight carbon-copy
 * misregistration: canary and pink copies a pixel or two off behind it.
 */
export function Wordmark({ label }: { label: string }) {
  return (
    <Link href="/" aria-label={label} className="inline-flex min-h-11 shrink-0 items-center gap-2 text-xl font-extrabold tracking-[-0.03em]">
      <Mark />
      {/* The copies are shadows, so the link reads "Habeas" once. */}
      {/* On the narrowest phones only the mark shows; the link keeps its name. */}
      <span translate="no" className="[text-shadow:1px_1px_0_var(--canary),2px_2px_0_var(--pink)] max-[359px]:sr-only">Habeas</span>
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
    <div className="sticky top-0 z-40 border-b border-transparent bg-[color-mix(in_oklab,var(--paper)_80%,transparent)] backdrop-blur-md backdrop-saturate-150">
    <header className="mx-auto w-full max-w-6xl px-4 pt-3 pb-2 sm:px-8 sm:pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-8">
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
      <nav aria-label="Main" className="mt-1 md:hidden">
        <ul className="-ml-2 flex flex-wrap text-sm">
          {nav.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="inline-flex min-h-11 items-center px-2 text-muted hover:text-ink">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
    </div>
  );
}

export function SiteFooter({ t }: { t: Dict }) {
  return (
    <footer className="mx-auto mt-24 w-full max-w-6xl px-4 pb-10 sm:px-8">
      <div className="perforation" aria-hidden />
      <p className="mt-12 max-w-[16ch] text-[clamp(2.4rem,7.5vw,5.2rem)] leading-[1] font-extrabold tracking-[-0.04em]">{t.footer.motto.replace(/^Habeas\.\s*/, "")}</p>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-rule pt-6">
        <div>
          <p className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <Mark className="h-6 w-auto" />
            Habeas
          </p>
          <p className="mt-1 max-w-[60ch] text-sm text-muted">{t.footer.built}</p>
        </div>
        <ul className="flex flex-wrap gap-x-5 text-sm">
          {[
            { href: "/me", label: t.footer.links.me },
            { href: "/issuer", label: t.footer.links.issuer },
            { href: "/review", label: t.footer.links.review },
            { href: "/evidence", label: t.nav.evidence },
            { href: "/developers", label: t.footer.links.developers },
          ].map((l) => (
            <li key={l.href}>
              <Link className="inline-flex min-h-11 items-center underline" href={l.href}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a className="inline-flex min-h-11 items-center underline" href={telegramLink()} target="_blank" rel="noreferrer">
              {t.telegram.footer}
            </a>
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
