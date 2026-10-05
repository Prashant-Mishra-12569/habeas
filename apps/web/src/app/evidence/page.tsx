import { PageHeader } from "@/components/PageHeader";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import deployment from "@/config/testnet.json";
import wallet from "@/config/testnet-freighter.json";
import lock from "@/config/testnet-lock.json";
import run from "@/config/testnet-run.json";
import web from "@/config/testnet-web.json";
import x402 from "@/config/testnet-x402.json";
import { EvidenceBoard, type ListRow, type MatrixRow, type Panel, type TxLink } from "@/components/EvidenceBoard";
import { accountUrl, contractUrl, formatDuration, formatUtc, shortAddress } from "@/lib/format";
import { USBDC_EVENT } from "@/lib/mainnet";
import { evidenceSteps } from "@/lib/evidence";
import { getDict } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  return pageMeta({ ...t.meta.pages.evidence, path: "/evidence", lang });
}

const LAB_URL = `https://lab.stellar.org/smart-contracts/contract-explorer?$=network$id=testnet&label=Testnet&horizonUrl=https:////horizon-testnet.stellar.org&rpcUrl=https:////soroban-testnet.stellar.org&passphrase=Test%20SDF%20Network%20/;%20September%202015;&smartContracts$explorer$contractId=${deployment.habeas};;`;

const tx = (hash: string): TxLink => ({ hash, url: `https://stellar.expert/explorer/testnet/tx/${hash}` });
const steps = (list: { label: string; hash: string }[]): ListRow[] => list.map((s) => ({ label: s.label, link: tx(s.hash) }));

/** Which tick-box stage each website step fills. */
const STAGE = { opened: 0, answered: 1, decided: 2, settled: 3, withdrawn: 3, emergency: 3 } as const;

export default async function EvidencePage() {
  const { t, lang } = await getDict();
  const e = t.evidence;
  const b = e.board;
  const [code, issuer] = deployment.asset.split(":");
  const scripted = evidenceSteps(run);

  // Every ending, from the scripted run: one row per case.
  const endings: MatrixRow[] = Object.entries(run.cases).map(([key, c]) => ({
    key,
    title: b.endingNames[c.ended_by] ?? c.ended_by,
    caseId: c.id,
    outcome: c.status as MatrixRow["outcome"],
    stages: scripted.stages[key].map((h) => (h ? tx(h) : null)) as MatrixRow["stages"],
  }));

  // Cases run through the website, the same way.
  const siteCases: MatrixRow[] = web.cases.map((c) => {
    const stages: TxLink[] = [null, null, null, null];
    for (const s of c.steps) stages[STAGE[s.kind as keyof typeof STAGE]] = tx(s.hash);
    return {
      key: String(c.id),
      title: c.label,
      caseId: c.id,
      outcome: c.status as MatrixRow["outcome"],
      stages: stages as MatrixRow["stages"],
    };
  });

  const panels: Panel[] = [
    {
      id: "endings",
      tab: b.tabs.endings,
      figure: `${endings.length}/6`,
      claim: b.claims.endings,
      lead: e.runLead(formatUtc(run.ran_at, lang)),
      matrix: endings,
      lists: [{ title: b.setup, rows: steps(scripted.setup) }],
    },
    {
      id: "refused",
      tab: b.tabs.refused,
      figure: String(run.refusals.length + scripted.onChainRefusals.length),
      claim: b.claims.refused,
      lists: [
        { title: e.refusedTitle, rows: run.refusals.map((r) => ({ label: r.label, value: r.error, mono: true })) },
        { rows: scripted.onChainRefusals.map((s) => ({ label: s.label, note: e.meantToFail, link: tx(s.hash) })) },
      ],
    },
    {
      id: "website",
      tab: b.tabs.website,
      figure: String(siteCases.length),
      claim: b.claims.website,
      lead: e.webLead,
      matrix: siteCases,
    },
    {
      id: "wallet",
      tab: b.tabs.wallet,
      figure: `#${wallet.case_id}`,
      claim: b.claims.wallet,
      lead: e.walletLead,
      lists: [{ rows: steps(wallet.steps) }],
    },
    {
      id: "lock",
      tab: b.tabs.lock,
      figure: String(lock.steps.length),
      claim: b.claims.lock,
      lead: e.lockLead,
      lists: [{ rows: steps(lock.steps) }],
    },
    {
      id: "agents",
      tab: b.tabs.agents,
      figure: String(x402.paid.length),
      claim: b.claims.agents,
      lead: e.x402Lead,
      lists: [
        {
          rows: [
            { label: e.x402Rows.payTo, value: shortAddress(x402.treasury, 6), href: accountUrl(x402.treasury) },
            { label: e.x402Rows.signer, value: shortAddress(x402.attest_key, 6), href: accountUrl(x402.attest_key) },
            { label: e.x402Rows.agent, value: shortAddress(x402.agent, 6), href: accountUrl(x402.agent) },
          ],
        },
        { title: b.setup, rows: steps(x402.setup) },
        { title: e.x402Title, rows: steps(x402.paid) },
      ],
      footer: { label: e.x402Live, href: "/developers" },
    },
    {
      id: "contract",
      tab: b.tabs.contract,
      figure: deployment.wasm_sha256.slice(0, 6),
      claim: b.claims.contract,
      lists: [
        {
          rows: [
            { label: e.rows.habeas, value: shortAddress(deployment.habeas, 6), href: contractUrl(deployment.habeas) },
            { label: e.rows.wasm, value: deployment.wasm_sha256, mono: true },
            { label: e.rows.built, value: e.builtBy, href: deployment.wasm_source },
            { label: e.lab, value: "Stellar Lab", href: LAB_URL },
            { label: e.rows.asset, value: code, mono: true },
            { label: e.rows.sac, value: shortAddress(deployment.sac, 6), href: contractUrl(deployment.sac) },
            { label: e.rows.issuer, value: shortAddress(issuer, 6), href: accountUrl(issuer) },
            { label: e.rows.reviewer, value: shortAddress(deployment.reviewer, 6), href: accountUrl(deployment.reviewer) },
            { label: e.rows.relayer, value: shortAddress(deployment.relayer, 6), href: accountUrl(deployment.relayer) },
            {
              label: e.rows.windows,
              value: `${formatDuration(deployment.answer_window_secs, lang)} / ${formatDuration(deployment.review_window_secs, lang)}`,
            },
          ],
        },
      ],
    },
    {
      id: "mainnet",
      tab: b.tabs.mainnet,
      figure: "2",
      claim: b.claims.mainnet,
      lead: e.mainnetLead,
      lists: [
        {
          rows: [
            { label: "Payment, 24,000 USBDCP", value: USBDC_EVENT.paymentOp, href: `https://horizon.stellar.org/operations/${USBDC_EVENT.paymentOp}`, mono: true },
            { label: "Clawback, 24,000 USBDCP", value: USBDC_EVENT.clawbackOp, href: `https://horizon.stellar.org/operations/${USBDC_EVENT.clawbackOp}`, mono: true },
          ],
        },
      ],
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-8 sm:pt-16">
      <PageHeader title={e.title} lead={e.lead} note={t.notes.evidence} />
      <div className="mt-8 sm:mt-10">
        <EvidenceBoard panels={panels} />
      </div>
      <p className="mt-4 text-xs text-muted">{e.labelsNote}</p>
    </main>
  );
}
