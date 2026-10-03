"use client";

import type { ClawbackEvent } from "@/lib/mainnet-types";
import { formatDuration, formatTokens, formatUtc, shortAddress, shortHash, txUrl } from "@/lib/format";
import { CaseForm } from "./CaseForm";
import { Appear, Inked } from "./Inked";

const NotProvided = () => (
  <span className="inline-block rounded-[2px] bg-pink px-1.5 text-sm text-ink">Not provided</span>
);

/**
 * A real mainnet take back (clawback), written into the case form as if
 * someone were filling it in. The fields a fair process would need stay
 * empty, because the public record has nothing to put there.
 */
export function EventForm({ e }: { e: ClawbackEvent }) {
  const amount = `${formatTokens(e.amount)} ${e.assetCode}`;
  let t = 0.3;
  const next = (text: string) => {
    const d = t;
    t += text.length * 0.022 + 0.12;
    return d;
  };
  const fields = {
    asset: e.assetCode,
    holder: shortAddress(e.holder, 6),
    amount,
    sent: formatUtc(e.sentAt),
    taken: formatUtc(e.takenAt),
    tx: shortHash(e.takeBackTx, 8),
  };
  const d = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, next(v)])) as Record<keyof typeof fields, number>;
  return (
    <CaseForm
      title="Take back (clawback) on Stellar"
      subtitle="Mainnet, read live from the public record"
      rows={[
        { label: "Asset", value: <Inked text={fields.asset} delay={d.asset} />, mono: true },
        { label: "Holder", value: <Inked text={fields.holder} delay={d.holder} />, mono: true },
        { label: "Amount taken back", value: <Inked text={fields.amount} delay={d.amount} />, mono: true },
        { label: "Sent to the holder", value: <Inked text={fields.sent} delay={d.sent} /> },
        { label: "Taken back", value: <Inked text={fields.taken} delay={d.taken} /> },
        {
          label: "Transaction",
          value: (
            <a className="underline decoration-1 underline-offset-2" href={txUrl(e.takeBackTx, "public")} target="_blank" rel="noreferrer">
              <Inked text={fields.tx} delay={d.tx} />
            </a>
          ),
          mono: true,
        },
        { label: "Reason", value: <Appear delay={t + 0.2}><NotProvided /></Appear>, wide: true },
        { label: "Right to answer", value: <Appear delay={t + 0.5}><NotProvided /></Appear>, wide: true },
      ]}
      statusNote={
        <Appear delay={t + 0.8}>
          <p className="text-sm">
            Taken back {formatDuration(e.secondsBetween)} after the tokens arrived. The record shows what happened, not why, and the holder had no way to answer.
          </p>
        </Appear>
      }
    />
  );
}
