import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import { CheckForm } from "@/components/CheckForm";
import { EventForm } from "@/components/EventForm";
import { HowItWorks } from "@/components/HowItWorks";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { Sources } from "@/components/Sources";
import { Suspense } from "react";
import Link from "next/link";
import { Tally, type TallyData } from "@/components/Tally";
import { checkAsset } from "@/lib/asset-check";
import { EXAMPLES, checkHref } from "@/lib/examples";
import { CASE_ENDINGS, CONTRACT_TESTS } from "@/lib/proof";
import type { Dict } from "@/i18n/dict";
import { caseCount, deployment, getCase } from "@/lib/habeas";
import { getUsbdcEvent } from "@/lib/mainnet";
import { ReadError } from "@/lib/network";
import { getDict } from "@/i18n/server";
import { REPO_URL, SITE_URL, pageMeta } from "@/lib/site";

// Everything on this page is read from Stellar on each request.
export const dynamic = "force-dynamic";

const LAB_URL = `https://lab.stellar.org/smart-contracts/contract-explorer?$=network$id=testnet&label=Testnet&horizonUrl=https:////horizon-testnet.stellar.org&rpcUrl=https:////soroban-testnet.stellar.org&passphrase=Test%20SDF%20Network%20/;%20September%202015;&smartContracts$explorer$contractId=${deployment.habeas};;`;
const REPO = "https://github.com/Prashant-Mishra-12569/habeas";
/** A closed case on the demo contract that went the full way: answered, decided, cleared. */
const STORY_CASE = 3;

async function attempt<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (e) {
    return { ok: false as const, message: e instanceof ReadError ? e.message : (e as Error).message };
  }
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-8 sm:pt-24">
      <h2 id={`${id}-title`} className="text-[1.75rem] sm:text-3xl">
        {title}
      </h2>
      {lead && <p className="mt-3 max-w-[60ch] text-muted">{lead}</p>}
      <div className="mt-8 sm:mt-10">{children}</div>
    </section>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  return { ...pageMeta({ title: t.meta.title, description: t.meta.description, path: "/", lang }), title: { absolute: t.meta.title } };
}

/** What search engines read about the site (schema.org). */
function StructuredData({ description, lang }: { description: string; lang: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Habeas",
    url: SITE_URL,
    description,
    image: `${SITE_URL}/brand/habeas-mark.png`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    inLanguage: lang,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: { "@type": "Person", name: "Prashant Mishra", url: "https://github.com/Prashant-Mishra-12569", sameAs: ["https://x.com/0xprashantt"] },
    sameAs: [REPO_URL],
  };
  // "<" escaped so the JSON can never close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll("<", "\\u003c") }} />;
}

/** Sum of decimal token amounts, exactly (Stellar amounts have 7 decimals). */
function sumAmounts(amounts: (string | null)[]): string {
  const stroops = amounts.reduce((acc, a) => {
    if (!a) return acc;
    const [whole, frac = ""] = a.split(".");
    return acc + BigInt(whole) * 10_000_000n + BigInt((frac + "0000000").slice(0, 7));
  }, 0n);
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** The USBDCP issuer's take backs, counted from its full history on mainnet. */
async function TallySection() {
  const ex = EXAMPLES[0];
  const read = await attempt(() => checkAsset("mainnet", ex.code, ex.issuer));
  if (!read.ok) return <ReadErrorNotice what="the USBDCP history" message={read.message} />;
  const c = read.data;
  const dates = c.history.takeBacks.map((op) => op.at).sort();
  const d: TallyData = {
    code: ex.code,
    href: checkHref(ex),
    takeBacks: c.history.takeBacks.length,
    total: sumAmounts(c.history.takeBacks.map((op) => op.amount)),
    first: dates[0] ?? null,
    last: dates.at(-1) ?? null,
    reasons: c.reasons.length,
    scanned: c.history.scanned,
    complete: c.history.complete,
  };
  return <Tally d={d} />;
}

/** What's running on testnet, with the one live number read from the contract. */
async function Proof({ t }: { t: Dict }) {
  const count = await attempt(caseCount);
  const items = [
    { n: count.ok ? String(count.data) : "—", label: t.home.proof.cases },
    { n: String(CASE_ENDINGS.length), label: t.home.proof.endings },
    { n: String(CONTRACT_TESTS), label: t.home.proof.tests },
    { n: deployment.wasm_sha256.slice(0, 6), label: t.home.proof.build, mono: true },
  ];
  return (
    <div>
      <dl className="grid grid-cols-2 border-t-2 border-ink lg:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={it.label}
            className={`flex flex-col-reverse justify-end border-b border-rule py-5 pr-4 ${["", "border-l pl-4 lg:pl-6", "lg:border-l lg:pl-6", "border-l pl-4 lg:pl-6"][i]}`}
          >
            <dt className="mt-2 max-w-[24ch] text-sm text-muted">{it.label}</dt>
            <dd
              className={`leading-none text-pen tabular ${
                it.mono ? "font-mono text-[clamp(1.6rem,4.6vw,2.4rem)] font-medium" : "text-[clamp(2rem,6vw,3rem)] font-extrabold tracking-[-0.03em]"
              }`}
            >
              {it.n}
            </dd>
          </div>
        ))}
      </dl>
      <Link href="/evidence" className="mt-5 inline-flex min-h-11 items-center font-semibold text-pen underline decoration-2 underline-offset-4">
        {t.home.proofLink}
      </Link>
    </div>
  );
}

export default async function Home() {
  const { t, lang } = await getDict();
  const [event, story] = await Promise.all([attempt(getUsbdcEvent), attempt(() => getCase(STORY_CASE))]);
  const asset = deployment.asset.split(":")[0];
  const [, today, withHabeas] = t.home.compareCols;

  return (
    <main className="overflow-x-clip">
      <StructuredData description={t.meta.description} lang={lang} />
      {/* Hero: the problem, shown with a real take back from mainnet. */}
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-8 sm:gap-12 sm:px-8 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-16 lg:pt-20">
        <div className="lg:pt-6">
          <h1 className="text-[clamp(2.25rem,9.2vw,4.05rem)]">{t.home.h1}</h1>
          <p className="mt-5 max-w-[52ch] sm:mt-6 sm:text-lg sm:leading-relaxed">{t.home.lead}</p>
          <p className="mt-3 max-w-[52ch] sm:mt-4 sm:text-lg sm:leading-relaxed">{t.home.lead2}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/check">{t.nav.check}</ButtonLink>
            <ButtonLink href="/try" variant="secondary">
              {t.nav.try}
            </ButtonLink>
          </div>
        </div>
        <figure>
          {event.ok ? <EventForm e={event.data} fan /> : <ReadErrorNotice what="the mainnet take back" message={event.message} />}
          <figcaption className="mt-1 max-w-[52ch] text-sm text-muted">
            {t.event.caption}
            <Sources t={t} />
          </figcaption>
        </figure>
      </section>

      {/* The issuer's whole record, counted live: what's there, and what isn't. */}
      <Section id="record" title={t.tally.title}>
        <Suspense fallback={<p className="text-muted">{t.tally.sheetSub}…</p>}>
          <TallySection />
        </Suspense>
      </Section>

      {/* The same take back, as two copies of one form. */}
      <Section id="compare" title={t.home.compareTitle}>
        {/* Phones: one sheet, each row answered both ways, so they can be compared at a glance. */}
        <div className="rounded-[2px] border border-rule bg-sheet md:hidden">
          <div className="perforation mx-4 mt-3" aria-hidden />
          <dl>
            {t.home.compareRows.map((row) => (
              <div key={row[0]} className="border-b border-rule px-4 py-3 last:border-b-0">
                <dt className="font-semibold">{row[0]}</dt>
                <dd className="mt-2 grid grid-cols-[5.75rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <span className="text-muted">{t.home.compareShort[0]}</span>
                  <span className="smudge">{row[1]}</span>
                  <span className="font-semibold text-ink">{t.home.compareShort[1]}</span>
                  <span className="font-medium text-pen">{row[2]}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {/* Wider screens: two copies of the same form, side by side. */}
        <div className="hidden gap-6 md:grid md:grid-cols-2">
          {[
            { name: today, col: 1, tone: "bg-pink/60 -rotate-[0.6deg]", ink: "smudge" },
            { name: withHabeas, col: 2, tone: "bg-sheet", ink: "text-pen" },
          ].map((copy) => (
            <div key={copy.name} className={`rounded-[2px] border border-rule ${copy.tone}`}>
              <div className="perforation mx-4 mt-3" aria-hidden />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-5 pt-3 pb-3">
                <h3 className="text-lg">{copy.name}</h3>
                {copy.col === 1 && (
                  <p className="hand -rotate-2 text-xl" aria-hidden>
                    {t.home.compareTodayNote}
                  </p>
                )}
              </div>
              <div className="mx-5 border-t-2 border-ink" />
              <dl>
                {t.home.compareRows.map((row) => (
                  <div key={row[0]} className="border-b border-rule px-5 py-3 last:border-b-0">
                    <dt className="text-xs text-muted">{row[0]}</dt>
                    <dd className={`mt-1 ${copy.ink} ${copy.col === 2 ? "font-medium" : ""}`}>{row[copy.col]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      {/* How a case works, with a real case changing state as you scroll. */}
      <Section id="how" title={t.home.howTitle}>
        {story.ok ? <HowItWorks c={story.data} asset={asset} /> : <ReadErrorNotice what={`case ${STORY_CASE}`} message={story.message} />}
      </Section>

      <Section id="proof" title={t.home.proofTitle} lead={t.home.proofLead}>
        <Proof t={t} />
      </Section>

      <Section id="check" title={t.home.checkTitle} lead={t.home.checkLead}>
        <div className="max-w-3xl">
          <CheckForm />
        </div>
      </Section>

      <Section id="builders" title={t.home.buildersTitle} lead={t.home.buildersLead}>
        <ul className="grid gap-px overflow-hidden rounded-[2px] border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-5">
          {[
            { href: "/developers", label: t.home.builders.api, detail: "GET /api/v1/check · 0.001 USDC" },
            { href: `${REPO}/tree/main/contracts/habeas`, label: t.home.builders.contract, detail: "Rust · soroban-sdk 28" },
            { href: "/evidence", label: t.home.builders.evidence, detail: "testnet" },
            { href: LAB_URL, label: t.home.builders.build, detail: `wasm ${deployment.wasm_sha256.slice(0, 8)}…` },
            { href: `${REPO}/blob/main/docs/SPEC-cases.md`, label: t.home.builders.spec, detail: "SPEC-cases.md" },
          ].map((l) => (
            <li key={l.label} className="bg-sheet sm:last:col-span-2 lg:last:col-span-1">
              <a href={l.href} className="flex min-h-24 flex-col justify-between gap-3 p-5 hover:bg-paper">
                <span className="font-semibold text-pen underline decoration-1">{l.label}</span>
                <span className="font-mono text-xs text-muted">{l.detail}</span>
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
