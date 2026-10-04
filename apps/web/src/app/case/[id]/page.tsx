import type { Metadata } from "next";
import { CaseActions } from "@/components/CaseActions";
import { CaseTimeline } from "@/components/CaseTimeline";
import { CaseView } from "@/components/CaseView";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { contractUrl } from "@/lib/format";
import { deployment, getCase, type Case } from "@/lib/habeas";
import { ReadError } from "@/lib/network";
import { type Timeline, caseTimelineWithTx } from "@/lib/timeline";
import { getDict } from "@/i18n/server";

// Cases change as people act on them; always read the contract.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/case/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Case ${id} · Habeas` };
}

/** Everything the page shows, read from the contract at request time. */
async function load(id: string): Promise<{ c: Case | null; timeline: Timeline | null; now: number; error: string }> {
  try {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1) throw new ReadError("That isn't a case number.");
    const c = await getCase(n);
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
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-8 sm:pt-14">
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
