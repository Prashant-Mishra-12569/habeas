"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WalletError } from "@/lib/freighter";
import { type Signer, freighterSigner } from "@/lib/signer";
import type { Case } from "@/lib/types";
import { clock, useCountdown } from "@/lib/use-countdown";
import { useT } from "@/i18n/client";
import { Button } from "./Button";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);
  return json as T;
}

/** When a case can be settled by anyone, as unix seconds (0 = now). */
function settleAt(c: Case): number {
  if (c.status === "Upheld" || c.status === "Rejected") return 0;
  if (c.status === "Open") return c.answerBy + 1;
  return c.reviewBy + 1;
}

/**
 * What can happen to a case next: the holder can answer while the window is
 * open, and anyone can settle once the case can close. Habeas pays the fees.
 */
export function CaseActions({ c, now }: { c: Case; now: number }) {
  const t = useT();
  const A = t.caseActions;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [answer, setAnswer] = useState("");
  const isClosed = c.status === "Cleared" || c.status === "TakenBack";
  const left = useCountdown(isClosed ? null : settleAt(c), now);
  const canAnswer = c.status === "Open" && now <= c.answerBy;

  const run = (label: string, fn: () => Promise<void>) => async () => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof WalletError && e.kind === "missing" ? t.tryIt.wallet.missing : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (isClosed) return null;

  const settle = run(t.live.working, async () => {
    await post("/api/case/settle", { caseId: c.id });
    router.refresh();
  });
  const connect = run(t.tryIt.wallet.connecting, async () => setSigner(await freighterSigner()));
  const send = run(t.live.signing, async () => {
    const prepared = await post<{ entry: string; preimage: string; validUntil: number }>("/api/answer/prepare", { caseId: c.id, statement: answer });
    const { signature, signerAddress } = await signer!.signAuth(prepared.preimage);
    setBusy(t.live.working);
    await post("/api/answer/submit", { caseId: c.id, statement: answer, entry: prepared.entry, signature, validUntil: prepared.validUntil, signerAddress });
    router.refresh();
  });

  return (
    <section className="space-y-6" aria-live="polite">
      {left !== null && left > 0 ? (
        <p className="font-mono text-sm tabular text-muted">{A.closesIn(clock(left))}</p>
      ) : (
        <div>
          <p className="text-sm">{A.readyToSettle}</p>
          <Button className="mt-3" busy={busy !== null} onClick={settle}>
            {busy ?? t.live.settle}
          </Button>
        </div>
      )}

      {canAnswer && (
        <div className="rounded-[2px] border border-rule bg-sheet px-4 py-4 sm:px-5">
          <h2 className="text-lg">{A.answerTitle}</h2>
          <p className="mt-1 text-sm text-muted">{A.answerLead}</p>
          {!signer && (
            <Button variant="secondary" className="mt-3" busy={busy !== null} onClick={connect}>
              {busy ?? A.connect}
            </Button>
          )}
          {signer && signer.address !== c.holder && <p className="mt-3 text-sm text-taken">{A.notHolder}</p>}
          {signer && signer.address === c.holder && (
            <div className="mt-3 max-w-xl">
              <label htmlFor="case-answer" className="text-sm font-semibold">
                {t.tryIt.wallet.answerLabel}
              </label>
              <textarea
                id="case-answer"
                rows={3}
                maxLength={280}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="mt-1 block w-full rounded-[2px] border-2 border-field bg-transparent p-3 text-pen focus:border-pen focus:outline-none"
              />
              <Button className="mt-3" busy={busy !== null} onClick={send}>
                {busy ?? t.live.sendAnswer}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-[2px] border-l-4 border-taken bg-pink px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
