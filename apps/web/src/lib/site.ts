import type { Metadata } from "next";
import type { Lang } from "@/i18n/dict";

/** The public address of the site, for canonical links, share cards and the sitemap. */
export const SITE_URL = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const REPO_URL = "https://github.com/Prashant-Mishra-12569/habeas";
export const X_HANDLE = "@0xprashantt";

/**
 * Title, description, canonical link and share card for one page. Setting
 * openGraph on a page replaces what it inherits, image included, so the site
 * card is named here; a route with its own opengraph-image file (cases,
 * token checks) still uses that one.
 */
export function pageMeta({
  title,
  description,
  path,
  lang,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  lang: Lang;
  index?: boolean;
}): Metadata {
  const images = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Habeas: a fair process before anyone takes your tokens" }];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Habeas",
      title,
      description,
      url: path,
      locale: lang === "es" ? "es_ES" : "en_US",
      alternateLocale: lang === "es" ? ["en_US"] : ["es_ES"],
      images,
    },
    twitter: { card: "summary_large_image", site: X_HANDLE, creator: X_HANDLE, title, description, images },
    robots: index ? undefined : { index: false, follow: true },
  };
}
