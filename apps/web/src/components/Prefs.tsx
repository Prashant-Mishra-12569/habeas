"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Lang } from "@/i18n/dict";
import type { Theme } from "@/i18n/server";
import { useLang, useT } from "@/i18n/client";

const YEAR = 60 * 60 * 24 * 365;
const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${value}; path=/; max-age=${YEAR}; samesite=lax`;
};

function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: V;
  options: { value: V; label: string; lang?: string }[];
  onChange: (v: V) => void;
  className?: string;
}) {
  return (
    <fieldset className={`items-center rounded-[2px] border border-rule p-0.5 text-sm ${className}`}>
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          lang={o.lang}
          className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[1px] px-2.5 transition-colors duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--pen)] ${
            value === o.value ? "bg-ink font-semibold text-paper" : "text-muted hover:text-ink"
          }`}
        >
          <input type="radio" className="sr-only" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

/** A sheet of paper: outlined for Paper, filled for Carbon. */
function SheetIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M5 2.5h7l3.5 3.5v11.5H5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 2.5V6h3.5" fill="none" stroke={filled ? "var(--paper)" : "currentColor"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Language and theme switches. English and Paper unless the visitor changes them. */
export function Prefs({ initialTheme }: { initialTheme: Theme }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [, start] = useTransition();
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const applyTheme = (v: Theme) => {
    setCookie("theme", v);
    document.documentElement.dataset.theme = v;
    setTheme(v);
  };
  const next: Theme = theme === "paper" ? "carbon" : "paper";

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Segmented<Lang>
        className="flex"
        label={t.prefs.language}
        value={lang}
        options={[
          { value: "en", label: "EN", lang: "en" },
          { value: "es", label: "ES", lang: "es" },
        ]}
        onChange={(l) => {
          setCookie("lang", l);
          document.documentElement.lang = l;
          start(() => router.refresh());
        }}
      />
      {/* Phones: one button that flips the theme. */}
      <button
        type="button"
        onClick={() => applyTheme(next)}
        aria-label={`${t.prefs.theme}: ${theme === "paper" ? t.prefs.paper : t.prefs.carbon}. ${t.prefs.switchTo(next === "paper" ? t.prefs.paper : t.prefs.carbon)}`}
        className="flex h-12 w-12 items-center justify-center rounded-[2px] border border-rule text-ink sm:hidden"
      >
        <SheetIcon filled={theme === "carbon"} />
      </button>
      {/* Wider screens: both choices, named. */}
      <Segmented<Theme>
        className="hidden sm:flex"
        label={t.prefs.theme}
        value={theme}
        options={[
          { value: "paper", label: t.prefs.paper },
          { value: "carbon", label: t.prefs.carbon },
        ]}
        onChange={applyTheme}
      />
    </div>
  );
}
