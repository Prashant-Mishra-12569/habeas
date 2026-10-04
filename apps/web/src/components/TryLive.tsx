"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WalletError } from "@/lib/freighter";
import { formatTokens, shortAddress, shortHash, txUrl } from "@/lib/format";
import { type Signer, forgetTestWallet, freighterSigner, hasTestWallet, testWalletSigner } from "@/lib/signer";
import type { Timeline } from "@/lib/timeline-types";
import type { Case } from "@/lib/types";
import { clock, useCountdown } from "@/lib/use-countdown";
import { useLang, useT } from "@/i18n/client";
import { Button } from "./Button";
import { CaseTimeline } from "./CaseTimeline";
import { TickBox } from "./TickBox";

type Account = { exists: boolean; hasTrustline: boolean; balance: string | null; frozen: boolean; activeCase: number | null };
type CaseView = { case: Case; timeline: Timeline | null; now: number };

const SESSION = "habeas-try";
const closed = (c: Case) => c.status === "Cleared" || c.status === "TakenBack";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);
  return json as T;
}

function remember(first: number | null, second: number | null) {
  try {
    sessionStorage.setItem(SESSION, JSON.stringify({ first, second }));
  } catch {}
}

function recall(): { first: number | null; second: number | null } {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION) ?? "") as { first: number | null; second: number | null };
  } catch {
    return { first: null, second: null };
  }
}

function TxLink({ hash, label }: { hash: string; label: string }) {
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="inline-block py-1 text-sm text-pen underline">
      {label} <span className="font-mono">{shortHash(hash, 4)}</span>
    </a>
  );
}

/** Try it live: a real case on testnet, with or without a wallet, both endings. */
export function TryLive() {
  const t = useT();
  const L = t.live;
  const lang = useLang();
  const [signer, setSigner] = useState<Signer | null>(null);
  const [acct, setAcct] = useState<Account | null>(null);
  const [first, setFirst] = useState<CaseView | null>(null);
  const [second, setSecond] = useState<CaseView | null>(null);
  const [txs, setTxs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState(t.tryIt.wallet.answerDefault);
  const [copied, setCopied] = useState(false);

  const loadCase = (id: number) => post<CaseView>("/api/case/state", { caseId: id });
  const loadAccount = (address: string) => post<Account>("/api/demo/state", { address });

  async function setUp(s: Signer) {
    setSigner(s);
    let a = await loadAccount(s.address);
    if (s.kind === "temp") {
      // A test wallet gets everything it needs without asking.
      if (!a.exists) {
        await post("/api/demo/fund", { address: s.address });
        a = await loadAccount(s.address);
      }
      if (!a.hasTrustline) {
        const { xdr } = await post<{ xdr: string }>("/api/demo/trustline", { address: s.address });
        const { hash } = await post<{ hash: string }>("/api/demo/trustline/submit", { signedXdr: await s.signTx(xdr) });
        setTxs((x) => ({ ...x, trust: hash }));
        a = await loadAccount(s.address);
      }
    }
    setAcct(a);
    // Pick up where this visitor left off.
    const saved = recall();
    const firstId = saved.first ?? a.activeCase;
    if (firstId) setFirst(await loadCase(firstId));
    if (saved.second) setSecond(await loadCase(saved.second));
  }

  // A test wallet from earlier in this tab resumes on its own.
  useEffect(() => {
    if (!hasTestWallet()) return;
    let cancelled = false;
    // Async, so the first render matches the server's (which can't see the tab's storage).
    Promise.resolve()
      .then(() => setBusy(L.settingUp))
      .then(() => testWalletSigner())
      .then((s) => (cancelled ? undefined : setUp(s)))
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (label: string, fn: () => Promise<void>) => async () => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof WalletError) {
        setError(e.kind === "missing" ? t.tryIt.wallet.missing : e.kind === "declined" ? t.tryIt.wallet.declined : e.message);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setBusy(null);
    }
  };

  const startWith = (kind: "temp" | "freighter") =>
    run(kind === "temp" ? L.settingUp : t.tryIt.wallet.connecting, async () => {
      await setUp(kind === "temp" ? await testWalletSigner() : await freighterSigner());
    });

  const addTrust = run(L.signing, async () => {
    const { xdr } = await post<{ xdr: string }>("/api/demo/trustline", { address: signer!.address });
    const { hash } = await post<{ hash: string }>("/api/demo/trustline/submit", { signedXdr: await signer!.signTx(xdr) });
    setTxs((x) => ({ ...x, trust: hash }));
    setAcct(await loadAccount(signer!.address));
  });

  const openCase = (which: "first" | "second") =>
    run(L.working, async () => {
      const r = await post<{ caseId: number; mintTx: string | null; openTx: string }>("/api/demo/start", { address: signer!.address });
      if (r.mintTx) setTxs((x) => ({ ...x, mint: r.mintTx! }));
      const view = await loadCase(r.caseId);
      if (which === "first") {
        setFirst(view);
        remember(r.caseId, null);
      } else {
        setSecond(view);
        remember(first?.case.id ?? null, r.caseId);
      }
      setAcct(await loadAccount(signer!.address));
    });

  const sendAnswer = run(L.signing, async () => {
    const caseId = first!.case.id;
    const prepared = await post<{ entry: string; preimage: string; validUntil: number }>("/api/answer/prepare", { caseId, statement: answer });
    const { signature, signerAddress } = await signer!.signAuth(prepared.preimage);
    setBusy(L.working);
    await post("/api/answer/submit", { caseId, statement: answer, entry: prepared.entry, signature, validUntil: prepared.validUntil, signerAddress });
    setFirst(await loadCase(caseId));
  });

  const askReviewer = run(L.working, async () => {
    await post("/api/demo/review", { caseId: first!.case.id });
    setFirst(await loadCase(first!.case.id));
  });

  const settle = (which: "first" | "second") =>
    run(L.working, async () => {
      const view = which === "first" ? first! : second!;
      await post("/api/case/settle", { caseId: view.case.id });
      const updated = await loadCase(view.case.id);
      if (which === "first") setFirst(updated);
      else setSecond(updated);
      setAcct(await loadAccount(signer!.address));
    });

  const secondLeft = useCountdown(second && !closed(second.case) ? second.case.answerBy + 1 : null, second?.now ?? null);

  // ----------------------------------------------------------------- choose
  if (!signer) {
    return (
      <div>
        <h2 className="text-xl">{L.choose}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-[2px] border border-rule bg-sheet p-5">
            <h3 className="text-lg">{L.noWallet}</h3>
            <p className="mt-1 flex-1 text-sm text-muted">{L.noWalletDesc}</p>
            <Button className="mt-4 self-start" busy={busy !== null} onClick={startWith("temp")}>
              {busy === L.settingUp ? busy : L.noWalletStart}
            </Button>
          </div>
          <div className="flex flex-col rounded-[2px] border border-rule bg-sheet p-5">
            <h3 className="text-lg">{L.withFreighter}</h3>
            <p className="mt-1 flex-1 text-sm text-muted">{L.withFreighterDesc}</p>
            <p className="mt-2 hidden rounded-[2px] bg-canary px-3 py-2 text-xs pointer-coarse:block">{t.tryIt.wallet.mobileNote}</p>
            <Button variant="secondary" className="mt-4 self-start" busy={busy !== null} onClick={startWith("freighter")}>
              {busy === t.tryIt.wallet.connecting ? busy : t.tryIt.wallet.connect}
            </Button>
          </div>
        </div>
        {error && <ErrorLine text={error} />}
      </div>
    );
  }

  // ------------------------------------------------------------------ steps
  const c = first?.case;
  const done = [
    Boolean(acct?.hasTrustline),
    Boolean(c),
    Boolean(c && c.answeredAt > 0),
    Boolean(c && c.decidedAt > 0),
    Boolean(c && closed(c)),
  ];
  const current = done.indexOf(false);
  const answerClosed = Boolean(c && c.status === "Open" && first!.now > c.answerBy);
  const opened = first?.timeline?.steps.find((s) => s.kind === "opened")?.tx;
  const stepTx: (string | undefined)[] = [
    txs.trust,
    opened ?? undefined,
    first?.timeline?.steps.find((s) => s.kind === "answered")?.tx ?? undefined,
    first?.timeline?.steps.find((s) => s.kind === "decided")?.tx ?? undefined,
    first?.timeline?.steps.find((s) => s.kind === "settled")?.tx ?? undefined,
  ];
  const label = busy ?? "";

  const action = (i: number) => {
    if (!acct) return null;
    switch (i) {
      case 0:
        if (!acct.exists) return <p className="text-sm">{t.tryIt.wallet.noAccount}</p>;
        return (
          <Button busy={busy !== null} onClick={addTrust}>
            {busy ? label : signer.kind === "temp" ? L.getTokens : L.addTrust}
          </Button>
        );
      case 1:
        return (
          <Button busy={busy !== null} onClick={openCase("first")}>
            {busy ? label : L.freezeMe}
          </Button>
        );
      case 2:
        if (answerClosed) {
          return (
            <>
              <p className="text-sm">{L.canSettle}</p>
              <Button className="mt-2" busy={busy !== null} onClick={settle("first")}>
                {busy ? label : L.settle}
              </Button>
            </>
          );
        }
        return (
          <div className="max-w-xl">
            <label htmlFor="answer" className="text-sm font-semibold">
              {t.tryIt.wallet.answerLabel}
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
              {t.tryIt.wallet.answerHint}
            </p>
            <Button className="mt-3" busy={busy !== null} onClick={sendAnswer}>
              {busy ? label : L.sendAnswer}
            </Button>
          </div>
        );
      case 3:
        return (
          <Button busy={busy !== null} onClick={askReviewer}>
            {busy ? label : L.askReviewer}
          </Button>
        );
      case 4:
        return (
          <Button busy={busy !== null} onClick={settle("first")}>
            {busy ? label : L.settle}
          </Button>
        );
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[2px] border border-rule bg-sheet px-4 py-3 text-sm">
        <p>
          <span className="text-muted">{signer.kind === "temp" ? L.testWallet : L.yourWallet}: </span>
          <span className="font-mono text-pen">{shortAddress(signer.address, 6)}</span>
        </p>
        {acct?.balance !== null && acct?.balance !== undefined && (
          <p>
            <span className="text-muted">{L.balance}: </span>
            <span className="font-mono tabular">{formatTokens(acct.balance, lang)} DEMOUSD</span>
            {acct.frozen && <span className="ml-2 rounded-[2px] bg-pink px-1.5 text-ink">{t.tryIt.wallet.frozenNow}</span>}
          </p>
        )}
      </div>
      {signer.kind === "temp" && (
        <p className="mt-2 text-xs text-muted">
          {L.testWalletNote}{" "}
          <button
            type="button"
            className="inline-block py-1 text-pen underline"
            onClick={() => {
              forgetTestWallet();
              remember(null, null);
              window.location.reload();
            }}
          >
            {L.forget}
          </button>
        </p>
      )}

      <ol className="mt-8 space-y-6">
        {L.steps.map(([title, body], i) => {
          const isCurrent = i === current;
          return (
            <li key={title} className={!done[i] && !isCurrent ? "opacity-60" : ""} aria-current={isCurrent ? "step" : undefined}>
              <TickBox checked={done[i]} label={`${i + 1}. ${title}`} tone={i === 4 && done[i] ? (c?.status === "Cleared" ? "cleared" : "taken") : "pen"} />
              <div className="mt-2 ml-0 sm:ml-7">
                {isCurrent && <p className="mb-3 max-w-[60ch] text-sm text-muted">{body}</p>}
                {isCurrent && action(i)}
                {done[i] && stepTx[i] && <TxLink hash={stepTx[i]!} label={t.tryIt.wallet.tx} />}
                {i === 1 && done[i] && txs.mint && <TxLink hash={txs.mint} label="Mint" />}
              </div>
            </li>
          );
        })}
      </ol>

      {c && closed(c) && first?.timeline && (
        <div className="mt-10 space-y-8">
          <p className={`text-xl font-extrabold tracking-tight ${c.status === "Cleared" ? "text-cleared" : "text-taken"}`}>
            {c.status === "Cleared" ? L.clearedTitle : L.takenTitle(formatTokens(c.taken, lang))}
          </p>
          <CaseTimeline c={c} timeline={first.timeline} />
          <CaseLinks id={c.id} copied={copied} onCopy={() => setCopied(true)} />

          {/* The other ending. */}
          <section className="rounded-[2px] border border-rule bg-sheet px-4 py-5 sm:px-5" aria-labelledby="ending2">
            <div className="perforation -mt-2 mb-4" aria-hidden />
            <h2 id="ending2" className="text-xl">
              {L.ending2Title}
            </h2>
            <p className="mt-2 max-w-[60ch] text-sm text-muted">{L.ending2Desc}</p>
            {!second && (
              <Button className="mt-4" busy={busy !== null} onClick={openCase("second")}>
                {busy ? label : L.ending2Start}
              </Button>
            )}
            {second && !closed(second.case) && (
              <div className="mt-4" aria-live="polite">
                {secondLeft !== null && secondLeft > 0 ? (
                  <p className="font-mono text-lg tabular">{L.waiting(clock(secondLeft))}</p>
                ) : (
                  <>
                    <p className="text-sm">{L.canSettle}</p>
                    <Button className="mt-3" busy={busy !== null} onClick={settle("second")}>
                      {busy ? label : L.settle}
                    </Button>
                  </>
                )}
              </div>
            )}
            {second && closed(second.case) && second.timeline && (
              <div className="mt-5 space-y-6">
                <p className="text-lg font-extrabold tracking-tight text-taken">{L.takenTitle(formatTokens(second.case.taken, lang))}</p>
                <CaseTimeline c={second.case} timeline={second.timeline} />
                <CaseLinks id={second.case.id} copied={copied} onCopy={() => setCopied(true)} />
              </div>
            )}
          </section>
        </div>
      )}

      {error && <ErrorLine text={error} />}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-5 rounded-[2px] border-l-4 border-taken bg-pink px-3 py-2 text-sm">
      {text}
    </p>
  );
}

function CaseLinks({ id, copied, onCopy }: { id: number; copied: boolean; onCopy: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={`/case/${id}`} className="inline-flex min-h-11 items-center text-pen underline">
        {t.live.openCase(id)}
      </Link>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${window.location.origin}/case/${id}`);
            onCopy();
          } catch {}
        }}
      >
        {copied ? t.live.copied : t.live.copyLink}
      </Button>
    </div>
  );
}
