"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "habeas-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme | null) ?? "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function write(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  apply(theme);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  apply(read());
  return () => listeners.delete(listener);
}

/** Lets a viewer preview both themes. Remembered in this browser only. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  return (
    <fieldset className="flex items-center gap-1 text-sm">
      <legend className="sr-only">Colour theme</legend>
      {(["system", "light", "dark"] as const).map((t) => (
        <label
          key={t}
          className={`flex min-h-11 cursor-pointer items-center rounded-[3px] px-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)] ${theme === t ? "bg-canary font-semibold" : "text-muted"}`}
        >
          <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => write(t)} className="sr-only" />
          {t === "system" ? "Match device" : t === "light" ? "Light" : "Dark"}
        </label>
      ))}
    </fieldset>
  );
}
