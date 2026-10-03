import type { Metadata } from "next";
import { CaseView } from "@/components/CaseView";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { contractUrl } from "@/lib/format";
import { deployment, getCase, type Case } from "@/lib/habeas";
import { ReadError } from "@/lib/network";
import { getDict } from "@/i18n/server";

// Cases change as people act on them; always read the contract.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/case/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Case ${id} · Habeas` };
}

export default async function CasePage({ params }: PageProps<"/case/[id]">) {
  const { t } = await getDict();
  const { id } = await params;
  const asset = deployment.asset.split(":")[0];
  let c: Case | null = null;
  let error = "";
  try {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1) throw new ReadError("That isn't a case number.");
    c = await getCase(n);
  } catch (e) {
    error = e instanceof ReadError ? e.message : (e as Error).message;
  }
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-8 sm:pt-14">
      {c ? <CaseView c={c} asset={asset} /> : <ReadErrorNotice what={`${t.form.case} ${id}`} message={error} />}
      <p className="mt-4 text-sm text-muted">
        <a className="font-mono text-pen underline" href={contractUrl(deployment.habeas)} target="_blank" rel="noreferrer">
          {deployment.habeas.slice(0, 8)}…
        </a>{" "}
        · testnet
      </p>
    </main>
  );
}
