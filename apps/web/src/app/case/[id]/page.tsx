import type { Metadata } from "next";
import { cache } from "react";
import { CaseActions } from "@/components/CaseActions";
import { CaseTimeline } from "@/components/CaseTimeline";
import { CaseView } from "@/components/CaseView";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { contractUrl, formatTokens } from "@/lib/format";
import { deployment, getCase, type Case } from "@/lib/habeas";
import { ReadError } from "@/lib/network";
import { type Timeline, caseTimelineWithTx } from "@/lib/timeline";
import { getDict } from "@/i18n/server";
import { pageMeta } from "@/lib/site";

// Cases change as people act on them; always read the contract.
export const dynamic = "force-dynamic";

/** One contract read per request, shared by the page and its metadata. */
const caseById = cache((n: number) => getCase(n));

export async function generateMetadata({ params }: PageProps<"/case/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { t, lang } = await getDict();
  const path = `/case/${id}`;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return pageMeta({ title: t.meta.caseUnknown(id), description: t.meta.description, path, lang, index: false });
  try {
    const c = await caseById(n);
    const asset = deployment.asset.split(":")[0];
    return pageMeta({
      title: t.meta.caseTitle(id, t.words.status[c.status]),
      description: t.meta.caseDescription(`${formatTokens(c.amount, lang)} ${asset}`, t.words.reason[c.reason], t.words.statusLine[c.status]),
      path,
      lang,
    });
  } catch {
    // The page itself shows the honest error; the metadata just stays generic.
    return pageMeta({ title: t.meta.caseUnknown(id), description: t.meta.description, path, lang, index: false });
  }
}

/** Everything the page shows, read from the contract at request time. */
async function load(id: string): Promise<{ c: Case | null; timeline: Timeline | null; now: number; error: string }> {
  try {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1) throw new ReadError("That isn't a case number.");
    const c = await caseById(n);
    // The timeline is extra detail; the case itself still shows if it fails.
    const timeline = await caseTimelineWithTx(c).catch(() => null);
    return { c, timeline, now: Math.floor(Date.now() / 1000), error: "" };
  } catch (e) {
    return { c: null, timeline: null, now: 0, error: e instanceof ReadError ? e.message : (e as Error).message };
  }
}

export default async function CasePage({ params }: PageProps<"/case/[id]">) {
  const { t } = await getDict();
  const { id } = await params;
  const asset = deployment.asset.split(":")[0];
  const { c, timeline, now, error } = await load(id);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-8 sm:pt-16">
      {c ? (
        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
          <div>
            <CaseView c={c} asset={asset} />
            <p className="mt-2 text-sm text-muted">
              <a className="font-mono text-pen underline" href={contractUrl(deployment.habeas)} target="_blank" rel="noreferrer">
                {deployment.habeas.slice(0, 8)}…
              </a>{" "}
              · testnet
            </p>
          </div>
          <div className="space-y-10">
            <CaseActions c={c} now={now} />
            {timeline && <CaseTimeline c={c} timeline={timeline} />}
          </div>
        </div>
      ) : (
        <ReadErrorNotice what={`${t.form.case} ${id}`} message={error} />
      )}
    </main>
  );
}
