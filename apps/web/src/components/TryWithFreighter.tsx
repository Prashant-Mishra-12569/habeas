"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { WalletError, connectFreighter, signAuth, signTx } from "@/lib/freighter";
import { formatTokens, shortAddress, shortHash, txUrl } from "@/lib/format";
import type { Status } from "@/lib/types";
import { useLang, useT } from "@/i18n/client";
import { Button } from "./Button";
import { TickBox } from "./TickBox";

type State = {
  exists: boolean;
  hasTrustline: boolean;
  balance: string | null;
  frozen: boolean;
  activeCase: number | null;
  caseStatus: Status | null;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);
  return json as T;
}

function TxLink({ hash, label }: { hash: string; label: string }) {
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="text-sm text-pen underline">
      {label} <span className="font-mono">{shortHash(hash, 4)}</span>
    </a>
  );
}

/**
 * Try it live with Freighter: accept DEMOUSD, get frozen by a real case, and
 * answer for free. Every step is a real testnet transaction.
 */
export function TryWithFreighter() {
  const t = useT();
  const w = t.tryIt.wallet;
  const lang = useLang();
  const [address, setAddress] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txs, setTxs] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState(w.answerDefault);

  const refresh = useCallback(async (addr: string) => setState(await post<State>("/api/demo/state", { address: addr })), []);

  const run = (label: string, fn: () => Promise<void>) => async () => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof WalletError) {
        setError(e.kind === "missing" ? w.missing : e.kind === "declined" ? w.declined : e.message);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setBusy(null);
    }
  };

  const connect = run(w.connecting, async () => {
    const addr = await connectFreighter();
    setAddress(addr);
    await refresh(addr);
  });

  const addTrust = run(w.connecting, async () => {
    const { xdr } = await post<{ xdr: string }>("/api/demo/trustline", { address });
    const signedXdr = await signTx(xdr, address!);
    const { hash } = await post<{ hash: string }>("/api/demo/trustline/submit", { signedXdr });
    setTxs((x) => ({ ...x, trust: hash }));
    await refresh(address!);
  });

  const start = run(w.starting, async () => {
    const r = await post<{ caseId: number; mintTx: string | null; openTx: string }>("/api/demo/start", { address });
    setTxs((x) => ({ ...x, ...(r.mintTx ? { mint: r.mintTx } : {}), open: r.openTx }));
    await refresh(address!);
  });

  const send = run(w.signing, async () => {
    const caseId = state!.activeCase!;
    const prepared = await post<{ entry: string; preimage: string; validUntil: number }>("/api/answer/prepare", { caseId, statement: answer });
    const { signature, signerAddress } = await signAuth(prepared.preimage, address!);
    setBusy(w.sending);
    const { hash } = await post<{ hash: string }>("/api/answer/submit", {
      caseId,
      statement: answer,
      entry: prepared.entry,
      signature,
      validUntil: prepared.validUntil,
      signerAddress,
    });
    setTxs((x) => ({ ...x, answer: hash }));
    await refresh(address!);
  });

  const s = state;
  const hasCase = Boolean(s?.activeCase);
  const answered = s?.caseStatus && s.caseStatus !== "Open";

  return (
    <section aria-labelledby="wallet-title" className="rounded-[2px] border border-rule bg-sheet">
      <div className="perforation mx-4 mt-3" aria-hidden />
      <div className="px-5 py-5">
        <h2 id="wallet-title" className="text-xl">
          {w.title}
        </h2>
        <p className="mt-2 max-w-[60ch] text-muted">{w.lead}</p>

        {!address && (
          <Button className="mt-5" busy={busy !== null} onClick={connect}>
            {busy ?? w.connect}
          </Button>
        )}

        {address && s && (
          <div className="mt-5 space-y-6">
            <p className="text-sm">
              {w.account}: <span className="font-mono text-pen">{shortAddress(address, 6)}</span>
              {s.balance !== null && (
                <>
                  {" · "}
                  <span className="font-mono tabular">{w.balance(formatTokens(s.balance, lang))}</span>
                  {s.frozen && <span className="ml-2 rounded-[2px] bg-pink px-1.5 text-ink">{w.frozenNow}</span>}
                </>
              )}
            </p>

            {!s.exists ? (
              <p className="text-sm">{w.noAccount}</p>
            ) : (
              <ol className="space-y-6">
                <li>
                  <TickBox checked={s.hasTrustline} label={`1. ${w.step1}`} />
                  <div className="mt-2 ml-7">
                    {s.hasTrustline ? (
                      <p className="text-sm text-muted">{w.trustDone}</p>
                    ) : (
                      <Button busy={busy !== null} onClick={addTrust}>
                        {busy ?? w.addTrust}
                      </Button>
                    )}
                    {txs.trust && <div className="mt-1"><TxLink hash={txs.trust} label={w.tx} /></div>}
                  </div>
                </li>

                <li>
                  <TickBox checked={hasCase} label={`2. ${w.step2}`} />
                  <div className="mt-2 ml-7">
                    {hasCase ? (
                      <p className="text-sm">{w.started(s.activeCase!)}</p>
                    ) : (
                      <Button busy={busy !== null} disabled={!s.hasTrustline} onClick={start}>
                        {busy === w.starting ? w.starting : w.start}
                      </Button>
                    )}
                    <div className="mt-1 flex flex-wrap gap-4">
                      {txs.mint && <TxLink hash={txs.mint} label="Mint" />}
                      {txs.open && <TxLink hash={txs.open} label={w.tx} />}
                    </div>
                  </div>
                </li>

                <li>
                  <TickBox checked={Boolean(answered)} label={`3. ${w.step3}`} />
                  <div className="mt-2 ml-7">
                    {hasCase && !answered && (
                      <div className="max-w-xl">
                        <label htmlFor="answer" className="text-sm font-semibold">
                          {w.answerLabel}
                        </label>
                        <textarea
                          id="answer"
                          rows={3}
                          maxLength={280}
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          aria-describedby="answer-hint"
                          className="mt-1 block w-full rounded-[2px] border-2 border-field bg-transparent p-3 text-pen focus:border-pen focus:outline-none"
                        />
                        <p id="answer-hint" className="mt-1 text-xs text-muted">
                          {w.answerHint}
                        </p>
                        <Button className="mt-3" busy={busy !== null} onClick={send}>
                          {busy === w.signing || busy === w.sending ? busy : w.send}
                        </Button>
                      </div>
                    )}
                    {answered && <p className="text-sm font-semibold text-cleared">{w.sent}</p>}
                    {txs.answer && <TxLink hash={txs.answer} label={w.tx} />}
                    {hasCase && (
                      <p className="mt-2 text-sm">
                        <Link className="text-pen underline" href={`/case/${s.activeCase}`}>
                          {w.viewCase} {s.activeCase}
                        </Link>
                      </p>
                    )}
                  </div>
                </li>
              </ol>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-[2px] border-l-4 border-taken bg-pink px-3 py-2 text-sm">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
