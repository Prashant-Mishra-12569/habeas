import type { Metadata } from "next";
import deployment from "@/config/testnet.json";
import lock from "@/config/testnet-lock.json";
import run from "@/config/testnet-run.json";
import { accountUrl, contractUrl, formatDuration, formatUtc, shortAddress, shortHash, txUrl } from "@/lib/format";
import { USBDC_EVENT } from "@/lib/mainnet";
import { getDict } from "@/i18n/server";

export const metadata: Metadata = { title: "Evidence · Habeas" };

const LAB_URL = `https://lab.stellar.org/smart-contracts/contract-explorer?$=network$id=testnet&label=Testnet&horizonUrl=https:////horizon-testnet.stellar.org&rpcUrl=https:////soroban-testnet.stellar.org&passphrase=Test%20SDF%20Network%20/;%20September%202015;&smartContracts$explorer$contractId=${deployment.habeas};;`;

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-all font-mono text-pen underline decoration-1">
      {children}
    </a>
  );
}

/** A full address on wide screens, shortened on phones; the link always has the full one. */
function Addr({ href, value }: { href: string; value: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={value} className="font-mono text-pen underline decoration-1">
      <span className="sm:hidden">{shortAddress(value, 8)}</span>
      <span className="hidden break-all sm:inline">{value}</span>
    </a>
  );
}

function Block({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="text-2xl">{title}</h2>
      {lead && <p className="mt-2 max-w-[64ch] text-muted">{lead}</p>}
      <div className="mt-6 rounded-[2px] border border-rule bg-sheet">
        <div className="perforation mx-4 mt-3" aria-hidden />
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-rule px-4 py-3 last:border-b-0 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function EvidencePage() {
  const { t, lang } = await getDict();
  const e = t.evidence;
  const [code, issuer] = deployment.asset.split(":");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-8 sm:pt-14">
      <h1 className="text-3xl sm:text-4xl">{e.title}</h1>
      <p className="mt-3 max-w-[64ch]">{e.lead}</p>

      <Block title={e.deployTitle}>
        <dl>
          <Row label={e.rows.habeas}>
            <Addr href={contractUrl(deployment.habeas)} value={deployment.habeas} />
          </Row>
          <Row label={e.rows.wasm}>
            <span className="break-all font-mono">{deployment.wasm_sha256}</span>
          </Row>
          <Row label={e.rows.built}>
            <a className="text-pen underline" href={deployment.wasm_source}>
              {e.builtBy}
            </a>
            {" · "}
            <a className="text-pen underline" href={LAB_URL}>
              {e.lab}
            </a>
          </Row>
          <Row label={e.rows.asset}>
            <span className="font-mono">{code}</span>
          </Row>
          <Row label={e.rows.sac}>
            <Addr href={contractUrl(deployment.sac)} value={deployment.sac} />
          </Row>
          <Row label={e.rows.issuer}>
            <Addr href={accountUrl(issuer)} value={issuer} />
          </Row>
          <Row label={e.rows.reviewer}>
            <Addr href={accountUrl(deployment.reviewer)} value={deployment.reviewer} />
          </Row>
          <Row label={e.rows.relayer}>
            <Addr href={accountUrl(deployment.relayer)} value={deployment.relayer} />
          </Row>
          <Row label={e.rows.windows}>
            {formatDuration(deployment.answer_window_secs, lang)} / {formatDuration(deployment.review_window_secs, lang)}
          </Row>
        </dl>
      </Block>

      <Block title={e.runTitle} lead={e.runLead(formatUtc(run.ran_at, lang))}>
        <ol>
          {run.steps.map((s, i) => (
            <li key={s.hash} className="grid grid-cols-[1.5rem_1fr_auto] gap-2 border-b border-rule px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[2rem_1fr_auto] sm:gap-3 sm:px-5">
              <span className="font-mono text-muted tabular">{i + 1}</span>
              <span>
                {s.label}
                {s.label.startsWith("Holder A tries") && <span className="block text-muted">{e.meantToFail}</span>}
              </span>
              <Ext href={txUrl(s.hash)}>{shortHash(s.hash, 4)}</Ext>
            </li>
          ))}
        </ol>
      </Block>
      <p className="mt-2 text-xs text-muted">{e.labelsNote}</p>

      <Block title={e.refusedTitle}>
        <dl>
          {run.refusals.map((r) => (
            <Row key={r.label} label={r.label}>
              <span className="font-mono">{r.error}</span>
            </Row>
          ))}
        </dl>
      </Block>

      <Block title={e.lockTitle} lead={e.lockLead}>
        <ol>
          {lock.steps.map((s) => (
            <li key={s.hash} className="flex justify-between gap-4 border-b border-rule px-4 py-3 text-sm last:border-b-0 sm:px-5">
              <span>{s.label}</span>
              <Ext href={txUrl(s.hash)}>{shortHash(s.hash, 4)}</Ext>
            </li>
          ))}
        </ol>
      </Block>

      <Block title={e.mainnetTitle} lead={e.mainnetLead}>
        <dl>
          <Row label="Payment, 24,000 USBDCP">
            <Ext href={`https://horizon.stellar.org/operations/${USBDC_EVENT.paymentOp}`}>{USBDC_EVENT.paymentOp}</Ext>
          </Row>
          <Row label="Clawback, 24,000 USBDCP">
            <Ext href={`https://horizon.stellar.org/operations/${USBDC_EVENT.clawbackOp}`}>{USBDC_EVENT.clawbackOp}</Ext>
          </Row>
        </dl>
      </Block>
    </main>
  );
}
