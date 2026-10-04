import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { LangProvider } from "@/i18n/client";
import { getDict, getTheme } from "@/i18n/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.meta.title, description: t.meta.description };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ lang, t }, theme] = await Promise.all([getDict(), getTheme()]);
  return (
    // Browser extensions (password managers, Bitdefender's anti-tracker and
    // others) add attributes to <html> and <body> before React loads. This
    // only silences those two elements, one level deep; mismatches inside our
    // own components still surface.
    <html lang={lang} data-theme={theme} className={`${publicSans.variable} ${plexMono.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <LangProvider lang={lang}>
          <SiteHeader t={t} theme={theme} />
          <div className="flex-1">{children}</div>
          <SiteFooter t={t} />
        </LangProvider>
      </body>
    </html>
  );
}
