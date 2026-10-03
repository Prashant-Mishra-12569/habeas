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
}: {
  label: string;
  value: V;
  options: { value: V; label: string; lang?: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <fieldset className="flex items-center rounded-[2px] border border-rule p-0.5 text-sm">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          lang={o.lang}
          className={`flex min-h-10 min-w-11 cursor-pointer items-center justify-center rounded-[1px] px-2.5 transition-colors duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--pen)] ${
            value === o.value ? "bg-ink text-paper font-semibold" : "text-muted hover:text-ink"
          }`}
        >
          <input type="radio" className="sr-only" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

/** Language and theme switches. English and Paper unless the visitor changes them. */
export function Prefs({ initialTheme }: { initialTheme: Theme }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [, start] = useTransition();
  const [theme, setTheme] = useState<Theme>(initialTheme);

  return (
    <div className="flex items-center gap-2">
      <Segmented<Lang>
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
      <Segmented<Theme>
        label={t.prefs.theme}
        value={theme}
        options={[
          { value: "paper", label: t.prefs.paper },
          { value: "carbon", label: t.prefs.carbon },
        ]}
        onChange={(v) => {
          setCookie("theme", v);
          document.documentElement.dataset.theme = v;
          setTheme(v);
        }}
      />
    </div>
  );
}
