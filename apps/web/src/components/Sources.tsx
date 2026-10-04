import type { Dict } from "@/i18n/dict";
import { USBDC_SOURCES } from "@/lib/sources";

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
      <path d="M3 1.5h5.5L11 4v8.5H3z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 6.5h4M5 8.5h4M5 10.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// Padded to a 24 px tap height (WCAG 2.2 target size), since these are list links.
const link = "inline-block py-1 text-pen underline decoration-1 underline-offset-2 hover:decoration-2";

/** Where the hero's story comes from, so anyone can check it. */
export function Sources({ t }: { t: Dict }) {
  const e = t.event;
  const s = USBDC_SOURCES;
  return (
    <div className="mt-4 border-t border-rule pt-3 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <DocIcon />
        {e.sources}
      </p>
      <ul className="mt-1 space-y-0.5">
        <li>
          <a className={link} href={s.bank} hrefLang="en" target="_blank" rel="noreferrer">
            {e.sourceBank}
          </a>
          {e.sourceBankNote && <span className="text-muted"> ({e.sourceBankNote})</span>}
        </li>
        <li>
          <a className={link} href={s.tellus} hrefLang="es" target="_blank" rel="noreferrer">
            {e.sourceTellus}
          </a>
          {e.sourceTellusNote && <span className="text-muted"> ({e.sourceTellusNote})</span>}
        </li>
        <li>
          {e.sourceHorizon}{" "}
          <a className={link} href={s.payment} target="_blank" rel="noreferrer">
            {e.sourcePayment}
          </a>
          ,{" "}
          <a className={link} href={s.clawback} target="_blank" rel="noreferrer">
            {e.sourceClawback}
          </a>
        </li>
      </ul>
    </div>
  );
}
