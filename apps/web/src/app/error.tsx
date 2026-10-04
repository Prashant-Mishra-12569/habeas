"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";
import { useT } from "@/i18n/client";

/** Shown when a page fails to render. Says what happened and what to do; never shows made-up data. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-12 sm:px-8 sm:pt-20">
      <div role="alert" className="rounded-[2px] border-l-4 border-taken bg-pink px-5 py-5">
        <h1 className="text-2xl sm:text-3xl">{t.crash.title}</h1>
        <p className="mt-3 max-w-[60ch]">{t.crash.body}</p>
        <Button className="mt-5" onClick={() => retry()}>
          {t.crash.retry}
        </Button>
        {error.digest && (
          <p className="mt-4 text-sm">
            {t.crash.id}: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  );
}
