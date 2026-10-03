import "server-only";
import { cookies } from "next/headers";
import { DICTS, LANGS, type Lang } from "./dict";

export type Theme = "paper" | "carbon";

/** English unless the visitor picked Spanish. */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return (LANGS as readonly string[]).includes(v ?? "") ? (v as Lang) : "en";
}

/** Paper (light) unless the visitor picked Carbon. */
export async function getTheme(): Promise<Theme> {
  return (await cookies()).get("theme")?.value === "carbon" ? "carbon" : "paper";
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}
