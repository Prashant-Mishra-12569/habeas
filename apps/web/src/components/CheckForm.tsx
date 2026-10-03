"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { EXAMPLES, checkHref } from "@/lib/examples";
import { shortAddress } from "@/lib/format";
import { useT } from "@/i18n/client";
import { Button } from "./Button";

const ASSET = /^([A-Za-z0-9]{1,12})[-:](G[A-Z2-7]{55})$/;

/** Asset field on a form line, plus one-click real examples. */
export function CheckForm({ initial = "", initialNetwork = "mainnet" }: { initial?: string; initialNetwork?: "mainnet" | "testnet" }) {
  const t = useT();
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(initial);
  const [network, setNetwork] = useState(initialNetwork);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const m = ASSET.exec(value.trim());
          if (!m) {
            setError(t.check.hint);
            return;
          }
          setError(null);
          start(() => router.push(checkHref({ code: m[1], issuer: m[2], network })));
        }}
        className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <div>
          <label htmlFor={`${id}-asset`} className="text-sm font-semibold">
            {t.check.label}
          </label>
          <input
            id={`${id}-asset`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint`}
            placeholder="USDC-GA5Z…KZVN"
            className="mt-1 block min-h-12 w-full border-0 border-b-2 border-field bg-transparent px-0 font-mono text-pen placeholder:text-muted focus:border-pen focus:outline-none"
          />
          <p id={`${id}-hint`} className={`mt-2 text-sm ${error ? "text-taken" : "text-muted"}`}>
            {error ?? t.check.hint}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:pb-8">
          <fieldset className="flex rounded-[2px] border border-rule p-0.5 text-sm">
            <legend className="sr-only">{t.check.network}</legend>
            {(["mainnet", "testnet"] as const).map((n) => (
              <label
                key={n}
                className={`flex min-h-10 cursor-pointer items-center px-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--pen)] ${network === n ? "bg-ink font-semibold text-paper" : "text-muted"}`}
              >
                <input type="radio" className="sr-only" name={`${id}-net`} checked={network === n} onChange={() => setNetwork(n)} />
                {n === "mainnet" ? t.check.mainnet : t.check.testnet}
              </label>
            ))}
          </fieldset>
          <Button type="submit" busy={pending}>
            {t.check.submit}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-sm text-muted">{t.check.examples}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <li key={`${e.code}-${e.issuer}`}>
            <Link
              href={checkHref(e)}
              className="group inline-flex min-h-11 items-center gap-2 rounded-[2px] border border-rule bg-sheet px-3 text-sm hover:border-pen"
            >
              <span className="font-mono font-medium text-pen">{e.code}</span>
              <span className="text-muted">{t.check.exampleNote[e.code] ?? shortAddress(e.issuer)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
