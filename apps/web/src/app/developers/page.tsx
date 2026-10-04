import type { Metadata } from "next";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { Addr, Block, Ext, Row } from "@/components/Sheet";
import { ATTEST_PREFIX, attestPublicKey } from "@/lib/attest";
import { accountUrl, formatTokens, formatUtc, shortAddress, shortHash, txUrl } from "@/lib/format";
import { paidChecks } from "@/lib/paid-checks";
import { X402_FACILITATOR, X402_NETWORK, X402_PAY_TO } from "@/lib/x402";
import type { Verdict } from "@/lib/asset-check-types";
import { getDict } from "@/i18n/server";

export const metadata: Metadata = { title: "For developers · Habeas" };
// The paid checks list is read from Stellar on each request.
export const dynamic = "force-dynamic";

const REPO = "https://github.com/Prashant-Mishra-12569/habeas";
const VERDICTS: Verdict[] = ["protected", "not-used", "used-without-process", "no-powers"];

function Code({ children, label }: { children: string; label: string }) {
  return (
    <pre aria-label={label} tabIndex={0} className="overflow-x-auto px-4 py-4 font-mono text-[0.8125rem] leading-6 sm:px-5">
      <code>{children}</code>
    </pre>
  );
}

export default async function DevelopersPage() {
  const { t, lang } = await getDict();
  const d = t.dev;

  let signer: { ok: true; key: string } | { ok: false; message: string };
  try {
    signer = { ok: true, key: attestPublicKey() };
  } catch (e) {
    signer = { ok: false, message: (e as Error).message };
  }
  const paid = await paidChecks().then(
    (data) => ({ ok: true as const, data }),
    (e: Error) => ({ ok: false as const, message: e.message }),
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-8 sm:pt-14">
      <h1 className="text-3xl sm:text-4xl">{d.title}</h1>
      <p className="mt-3 max-w-[64ch]">{d.lead}</p>

      <Block title={d.requestTitle}>
        <dl>
          <Row label={d.rows.endpoint}>
            <span className="font-mono">
              GET /api/v1/check/CODE-ISSUER
              <wbr />
              ?network=testnet
            </span>
          </Row>
          <Row label={d.rows.network}>{d.networkValue}</Row>
          <Row label={d.rows.price}>
            {d.priceValue} <span className="font-mono text-muted">({X402_NETWORK}, exact)</span>
          </Row>
          <Row label={d.rows.payTo}>
            <Addr href={accountUrl(X402_PAY_TO)} value={X402_PAY_TO} />
          </Row>
          <Row label={d.rows.facilitator}>
            <a className="text-pen underline" href={X402_FACILITATOR.replace(/\/facilitator$/, "")}>
              {d.facilitatorValue}
            </a>
          </Row>
          <Row label={d.rows.failed}>{d.failedValue}</Row>
        </dl>
      </Block>
      <p className="mt-3 max-w-[64ch] text-sm text-muted">{d.noPayment}</p>

      <Block title={d.answerTitle} lead={d.answerLead}>
        <dl>
          {VERDICTS.map((v) => (
            <Row key={v} label={t.check.verdict[v]}>
              <span className="font-mono">{v}</span>
              <span className="mt-1 block text-muted">{t.check.verdictLine[v]}</span>
            </Row>
          ))}
        </dl>
      </Block>

      <Block title={d.signedTitle} lead={d.signedLead}>
        <dl>
          <Row label={d.signRows.key}>
            {signer.ok ? (
              <>
                <Addr href={accountUrl(signer.key)} value={signer.key} />
                <a className="mt-1 block text-pen underline" href="/api/v1/key">
                  {d.keyLink}
                </a>
              </>
            ) : (
              <span role="alert">{signer.message}</span>
            )}
          </Row>
          <Row label={d.signRows.message}>
            <span className="font-mono">{`sha256("${ATTEST_PREFIX}" + json({ resource, network, result, signedAt }))`}</span>
          </Row>
          <Row label={d.signRows.canonical}>{d.canonicalValue}</Row>
        </dl>
      </Block>

      <Block title={d.tryTitle} lead={d.tryLead}>
        <Code label={d.tryTitle}>
          {`git clone ${REPO}
cd habeas/examples && npm install
AGENT_SECRET=S... node agent-check.ts USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E`}
        </Code>
      </Block>
      <p className="mt-3 text-sm">
        <a className="inline-flex min-h-11 items-center text-pen underline" href={`${REPO}/blob/main/examples/agent-check.ts`}>
          {d.tryScript}
        </a>
      </p>

      <Block title={d.paidTitle} lead={d.paidLead}>
        {!paid.ok ? (
          <div className="p-4">
            <ReadErrorNotice what={d.paidWhat} message={paid.message} />
          </div>
        ) : paid.data.checks.length === 0 ? (
          <p className="px-4 py-3 text-sm sm:px-5">{d.paidNone}</p>
        ) : (
          <ol>
            {paid.data.checks.map((c) => (
              <li key={c.tx} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-rule px-4 py-3 text-sm last:border-b-0 sm:px-5">
                <span className="tabular">{formatUtc(c.at, lang)}</span>
                <Ext href={txUrl(c.tx)}>{shortHash(c.tx, 4)}</Ext>
                <span className="text-muted">
                  {formatTokens(c.amount, lang)} USDC{" "}
                  <a className="font-mono underline" href={accountUrl(c.from)} target="_blank" rel="noreferrer">
                    {d.paidFrom(shortAddress(c.from, 4))}
                  </a>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Block>
    </main>
  );
}
