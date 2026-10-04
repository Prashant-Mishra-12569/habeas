"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { formatDay, formatTokens, formatUtc, shortAddress, shortHash } from "@/lib/format";
import { post } from "@/lib/post";
import type { Signer } from "@/lib/signer";
import type { Case, Reason } from "@/lib/types";
import { useLang, useT } from "@/i18n/client";
import { Button } from "./Button";
import { WalletPicker } from "./WalletPicker";

const field =
  "mt-1 block min-h-11 w-full border-0 border-b-2 border-field bg-transparent px-0 text-pen placeholder:text-muted focus:border-pen focus:outline-none";
const STATUS_TONE: Record<string, string> = {
  Open: "bg-pink",
  Answered: "bg-canary",
  Upheld: "bg-canary",
  Rejected: "bg-canary",
  Cleared: "text-cleared font-semibold",
  TakenBack: "text-taken font-semibold",
};

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-4 rounded-[2px] border-l-4 border-taken bg-pink px-3 py-2 text-sm">
      {text}
    </p>
  );
}

/** Signs a server-built Habeas call with the wallet and submits it. */
async function signAndSubmit(signer: Signer, body: Record<string, unknown>) {
  const { xdr } = await post<{ xdr: string }>("/api/tx/build", { ...body, source: signer.address });
  return post<{ hash: string; value: unknown }>("/api/tx/submit", { signedXdr: await signer.signTx(xdr) });
}

// ------------------------------------------------------------------ /me

export function MyCases() {
  const t = useT();
  const lang = useLang();
  const [signer, setSigner] = useState<Signer | null>(null);
  const [cases, setCases] = useState<Case[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSigner = async (s: Signer) => {
    setSigner(s);
    try {
      setCases((await post<{ cases: Case[] }>("/api/cases/for", { address: s.address })).cases);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <WalletPicker signer={signer} onSigner={onSigner} />
      {cases && cases.length === 0 && <p className="mt-8 text-muted">{t.roles.me.empty}</p>}
      {cases && cases.length > 0 && (
        <ul className="mt-8 divide-y divide-rule rounded-[2px] border border-rule bg-sheet">
          {cases.map((c) => (
            <li key={c.id}>
              <Link href={`/case/${c.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper sm:px-5">
                <span className="font-mono font-medium text-pen underline">{t.roles.me.open(c.id)}</span>
                <span className="font-mono text-sm tabular">{formatTokens(c.amount, lang)} DEMOUSD</span>
                <span className="text-sm text-muted">{formatDay(c.openedAt, lang)}</span>
                <span className={`rounded-[2px] px-1.5 text-sm ${STATUS_TONE[c.status]}`}>{t.words.status[c.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {error && <ErrorLine text={error} />}
    </div>
  );
}

// -------------------------------------------------------------- /issuer

const REASONS: Reason[] = ["Fraud", "SanctionsOrder", "SentByMistake", "CourtOrder", "Other"];

export function IssuerForm({ issuer }: { issuer: string }) {
  const t = useT();
  const I = t.roles.issuer;
  const id = useId();
  const [signer, setSigner] = useState<Signer | null>(null);
  const [holder, setHolder] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<Reason>("Fraud");
  const [statement, setStatement] = useState("");
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<number | null>(null);

  // The file never leaves the device: only its SHA-256 is computed here.
  const onFile = async (file: File | undefined) => {
    if (!file) return setFileHash(null);
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    setFileHash(Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(""));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) return;
    setBusy(true);
    setError(null);
    try {
      const r = await signAndSubmit(signer, { method: "open_case", holder: holder.trim(), amount: Number(amount), reason, statement, fileHash });
      setOpened(Number(r.value));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="max-w-[64ch] rounded-[2px] bg-canary px-4 py-3 text-sm">{I.note(shortAddress(issuer, 6))}</p>
      <div className="mt-6">
        <WalletPicker signer={signer} onSigner={setSigner} />
      </div>
      <form onSubmit={submit} className="mt-8 grid max-w-2xl gap-7">
        <label className="block">
          <span className="text-sm font-semibold">{I.holder}</span>
          <span className="block text-sm text-muted">{I.holderHint}</span>
          <input required value={holder} onChange={(e) => setHolder(e.target.value)} spellCheck={false} placeholder="G…" className={`${field} font-mono`} />
        </label>
        <div className="grid gap-7 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold">{I.amount}</span>
            <span className="block text-sm text-muted">{I.amountHint}</span>
            <input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="400" className={`${field} font-mono`} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">{I.reason}</span>
            <select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className={`${field} cursor-pointer`}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t.words.reason[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-semibold">{I.statement}</span>
          <span className="block text-sm text-muted">{I.statementHint}</span>
          <textarea
            required
            maxLength={280}
            rows={3}
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            className="mt-2 block w-full rounded-[2px] border-2 border-field bg-transparent p-3 text-pen focus:border-pen focus:outline-none"
          />
        </label>
        <div>
          <label htmlFor={`${id}-file`} className="text-sm font-semibold">
            {I.file}
          </label>
          <p className="text-sm text-muted">{I.fileHint}</p>
          <input id={`${id}-file`} required type="file" onChange={(e) => onFile(e.target.files?.[0])} className="mt-2 block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-[2px] file:border-2 file:border-pen file:bg-transparent file:px-4 file:font-semibold file:text-pen" />
          {fileHash && (
            <p className="mt-2 text-sm">
              <span className="text-muted">{I.fingerprint}: </span>
              <span className="break-all font-mono text-pen">{fileHash}</span>
            </p>
          )}
        </div>
        <div>
          <Button type="submit" busy={busy} disabled={!signer || !fileHash}>
            {I.submit}
          </Button>
          {opened !== null && (
            <p className="mt-3 text-sm font-semibold text-cleared">
              {I.done(opened)}{" "}
              <Link href={`/case/${opened}`} className="text-pen underline">
                {t.live.openCase(opened)}
              </Link>
            </p>
          )}
          {error && <ErrorLine text={error} />}
        </div>
      </form>
    </div>
  );
}

// -------------------------------------------------------------- /review

export function ReviewQueue({ cases, reviewer, now }: { cases: Case[]; reviewer: string; now: number }) {
  const t = useT();
  const R = t.roles.review;
  const lang = useLang();
  const router = useRouter();
  const [signer, setSigner] = useState<Signer | null>(null);
  const [statements, setStatements] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<number, boolean>>({});

  const decide = (c: Case, uphold: boolean) => async () => {
    if (!signer) return;
    setBusy(c.id);
    setError(null);
    try {
      await signAndSubmit(signer, { method: "decide", caseId: c.id, uphold, statement: statements[c.id] ?? "" });
      setDone((d) => ({ ...d, [c.id]: uphold }));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Anyone can close a case that's ready; the relayer pays.
  const settle = (c: Case) => async () => {
    setBusy(c.id);
    setError(null);
    try {
      await post("/api/case/settle", { caseId: c.id });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <p className="max-w-[64ch] rounded-[2px] bg-canary px-4 py-3 text-sm">{R.note(shortAddress(reviewer, 6))}</p>
      <div className="mt-6">
        <WalletPicker signer={signer} onSigner={setSigner} />
      </div>
      {error && <ErrorLine text={error} />}
      {cases.length === 0 && <p className="mt-8 text-muted">{R.empty}</p>}
      <ul className="mt-8 space-y-6">
        {cases.map((c) => {
          const waiting = c.status === "Answered" && now <= c.reviewBy && done[c.id] === undefined;
          return (
            <li key={c.id} className="rounded-[2px] border border-rule bg-sheet px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/case/${c.id}`} className="font-mono text-lg font-medium text-pen underline">
                  {t.form.case} {c.id}
                </Link>
                <span className={`rounded-[2px] px-1.5 text-sm ${STATUS_TONE[c.status]}`}>{t.words.status[c.status]}</span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">{t.form.publicReason}</dt>
                  <dd>“{c.statement}”</dd>
                </div>
                <div>
                  <dt className="text-muted">{t.form.holdersAnswer}</dt>
                  <dd>{c.holderStatement ? `“${c.holderStatement}”` : t.form.answeredNoStatement}</dd>
                </div>
                <div>
                  <dt className="text-muted">{R.issuerFile}</dt>
                  <dd className="font-mono">{shortHash(c.issuerFile, 8)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{R.holderFile}</dt>
                  <dd className="font-mono">{c.holderFile ? shortHash(c.holderFile, 8) : R.none}</dd>
                </div>
                {c.status === "Answered" && (
                  <div>
                    <dt className="text-muted">{R.decideBy}</dt>
                    <dd>{formatUtc(c.reviewBy, lang)}</dd>
                  </div>
                )}
              </dl>
              {waiting ? (
                <div className="mt-4">
                  <label className="block">
                    <span className="text-sm font-semibold">{R.statement}</span>
                    <textarea
                      rows={2}
                      maxLength={280}
                      value={statements[c.id] ?? ""}
                      onChange={(e) => setStatements((s) => ({ ...s, [c.id]: e.target.value }))}
                      className="mt-1 block w-full rounded-[2px] border-2 border-field bg-transparent p-3 text-pen focus:border-pen focus:outline-none"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button variant="secondary" busy={busy === c.id} disabled={!signer} onClick={decide(c, true)}>
                      {R.uphold}
                    </Button>
                    <Button variant="secondary" busy={busy === c.id} disabled={!signer} onClick={decide(c, false)}>
                      {R.reject}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm">
                    {done[c.id] !== undefined ? (done[c.id] ? R.upheld : R.rejected) : c.status === "Answered" ? R.silent : R.decided}
                  </p>
                  {done[c.id] === undefined && (
                    <Button className="mt-3" busy={busy === c.id} onClick={settle(c)}>
                      {t.live.settle}
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
