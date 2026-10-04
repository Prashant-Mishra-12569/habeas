import type { MetadataRoute } from "next";
import web from "@/config/testnet-web.json";
import { EXAMPLES, checkHref } from "@/lib/examples";
import { SITE_URL } from "@/lib/site";

/** Public pages worth finding in search: the main pages, the example token checks and the recorded demo cases. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  });
  return [
    page("/", 1, "weekly"),
    page("/check", 0.9, "monthly"),
    page("/try", 0.9, "monthly"),
    page("/evidence", 0.8, "weekly"),
    page("/developers", 0.7, "monthly"),
    ...EXAMPLES.map((e) => page(checkHref(e), 0.6, "daily")),
    ...web.cases.map((c) => page(`/case/${c.id}`, 0.4, "monthly")),
  ];
}
