"use client";

import type { ClawbackEvent } from "@/lib/mainnet-types";
import { formatDuration, formatTokens, formatUtc, shortAddress, shortHash, txUrl } from "@/lib/format";
import { useLang, useT } from "@/i18n/client";
import { CaseForm } from "./CaseForm";
import { Appear, Inked } from "./Inked";
import { PenCircle } from "./PenCircle";

/**
 * A real mainnet take back (clawback), written into the case form as if
 * someone were filling it in. The fields a fair process would need stay
 * empty, because the public record has nothing to put there, and get circled.
 */
export function EventForm({ e, fan = false }: { e: ClawbackEvent; fan?: boolean }) {
  const t = useT();
  const lang = useLang();
  const fields = {
    asset: e.assetCode,
    holder: shortAddress(e.holder, 6),
    amount: `${formatTokens(e.amount, lang)} ${e.assetCode}`,
    sent: formatUtc(e.sentAt, lang),
    taken: formatUtc(e.takenAt, lang),
    tx: shortHash(e.takeBackTx, 8),
  };
  // Each field starts when the previous one is written.
  let clock = 0.3;
  const at: Record<string, number> = {};
  for (const [k, v] of Object.entries(fields)) {
    at[k] = clock;
    clock += v.length * 0.022 + 0.12;
  }
  // The empty field gets circled, then a note goes in the margin beside it.
  const missing = (delay: number, note: string) => (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Appear delay={delay}>
        <PenCircle delay={delay + 0.15}>
          <span className="text-sm text-muted">{t.words.notProvided}</span>
        </PenCircle>
      </Appear>
      <Appear delay={delay + 0.75}>
        <span aria-hidden className="hand inline-block -rotate-3 text-[1.35rem]">
          {"\u2190"} {note}
        </span>
        <span className="sr-only">{note}</span>
      </Appear>
    </span>
  );

  return (
    <CaseForm
      fan={fan}
      title={t.event.title}
      subtitle={t.event.subtitle}
      rows={[
        { label: t.event.asset, value: <Inked text={fields.asset} delay={at.asset} />, mono: true },
        { label: t.event.holder, value: <Inked text={fields.holder} delay={at.holder} />, mono: true },
        { label: t.event.amount, value: <Inked text={fields.amount} delay={at.amount} />, mono: true },
        { label: t.event.sent, value: <Inked text={fields.sent} delay={at.sent} /> },
        { label: t.event.taken, value: <Inked text={fields.taken} delay={at.taken} /> },
        {
          label: t.event.tx,
          value: (
            <a className="underline decoration-1" href={txUrl(e.takeBackTx, "public")} target="_blank" rel="noreferrer">
              <Inked text={fields.tx} delay={at.tx} />
            </a>
          ),
          mono: true,
        },
        { label: t.event.reason, value: missing(clock + 0.2, t.event.noteWhy), wide: true },
        { label: t.event.rightToAnswer, value: missing(clock + 0.6, t.event.noteAsk), wide: true },
      ]}
      statusNote={
        <Appear delay={clock + 1.1}>
          <p className="text-sm">{t.event.note(formatDuration(e.secondsBetween, lang))}</p>
        </Appear>
      }
    />
  );
}
