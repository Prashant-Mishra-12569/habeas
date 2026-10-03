"use client";

import type { Case } from "@/lib/types";
import { caseRows, caseStages } from "@/lib/case-rows";
import { useLang, useT } from "@/i18n/client";
import { CaseForm } from "./CaseForm";

/** A case as it stands now, on the carbon-copy form. */
export function CaseView({ c, asset }: { c: Case; asset: string }) {
  const t = useT();
  const lang = useLang();
  const closed = c.status === "Cleared" || c.status === "TakenBack";
  return (
    <CaseForm
      title={<span className="font-mono">{t.form.case} {c.id}</span>}
      subtitle={`${asset} ${t.form.on} testnet`}
      rows={caseRows(c, asset, t, lang)}
      status={c.status}
      stages={caseStages(c)}
      outcomeLine={closed ? t.words.endedBy[c.endedBy] : null}
    />
  );
}
