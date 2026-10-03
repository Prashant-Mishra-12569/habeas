"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DICTS, type Lang } from "./dict";

const LangContext = createContext<Lang>("en");

/** Set once in the root layout from the visitor's language cookie. */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
export const useT = () => DICTS[useContext(LangContext)];
