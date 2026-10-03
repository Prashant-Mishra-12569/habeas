"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "./Button";

/** Shown instead of data when a read from Stellar fails. Never fake data. */
export function ReadErrorNotice({ what, message }: { what: string; message: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="alert" className="rounded-[3px] border-l-4 border-taken bg-pink px-4 py-3">
      <p className="font-semibold">We couldn&apos;t load {what}.</p>
      <p className="mt-1 text-sm">{message} Nothing is shown in its place, because we only show data read from Stellar.</p>
      <Button variant="secondary" className="mt-3" busy={pending} onClick={() => start(() => router.refresh())}>
        {pending ? "Trying again…" : "Try again"}
      </Button>
    </div>
  );
}
