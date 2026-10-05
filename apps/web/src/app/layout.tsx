import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Kalam, Public_Sans } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { SmoothScroll } from "@/components/SmoothScroll";
import { LangProvider } from "@/i18n/client";
import { getDict, getTheme } from "@/i18n/server";
import { REPO_URL, SITE_URL, pageMeta } from "@/lib/site";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin", "latin-ext"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Ballpoint handwriting, only for notes written in the margin of a form.
const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  const base = pageMeta({ title: t.meta.title, description: t.meta.description, path: "/", lang });
  return {
    ...base,
    // Each page sets its own canonical link.
    alternates: undefined,
    metadataBase: new URL(SITE_URL),
    // Pages set their own short title; this adds the name after it.
    title: { default: t.meta.title, template: "%s · Habeas" },
    applicationName: "Habeas",
    authors: [{ name: "Prashant Mishra", url: "https://github.com/Prashant-Mishra-12569" }],
    creator: "Prashant Mishra",
    publisher: "Prashant Mishra",
    keywords: ["Stellar", "clawback", "freeze", "stablecoin", "Soroban", "token holder rights", "due process", "x402", "USBDC"],
    category: "finance",
    // Amounts, ledgers and case numbers are not phone numbers.
    formatDetection: { telephone: false, address: false, email: false },
    other: { "source-code": REPO_URL },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme();
  return { themeColor: theme === "carbon" ? "#0c0c0e" : "#f7f8f4", colorScheme: theme === "carbon" ? "dark" : "light" };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ lang, t }, theme] = await Promise.all([getDict(), getTheme()]);
  return (
    // Browser extensions (password managers, Bitdefender's anti-tracker and
    // others) add attributes to <html> and <body> before React loads. This
    // only silences those two elements, one level deep; mismatches inside our
    // own components still surface.
    <html lang={lang} data-theme={theme} className={`${publicSans.variable} ${plexMono.variable} ${kalam.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <LangProvider lang={lang}>
          <SmoothScroll>
            <a
              href="#main"
              className="sr-only z-50 rounded-[2px] bg-ink px-4 py-3 font-semibold text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
              {t.nav.skip}
            </a>
            <SiteHeader t={t} theme={theme} />
            <div id="main" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </div>
            <SiteFooter t={t} />
          </SmoothScroll>
        </LangProvider>
      </body>
    </html>
  );
}
