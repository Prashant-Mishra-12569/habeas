import { ButtonLink } from "@/components/Button";
import { CheckForm } from "@/components/CheckForm";
import { EventForm } from "@/components/EventForm";
import { HowItWorks } from "@/components/HowItWorks";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { deployment, getCase } from "@/lib/habeas";
import { getUsbdcEvent } from "@/lib/mainnet";
import { ReadError } from "@/lib/network";
import { getDict } from "@/i18n/server";

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
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-6xl px-4 pt-24 sm:px-8">
      <h2 id={`${id}-title`} className="text-2xl sm:text-3xl">
        {title}
      </h2>
      {lead && <p className="mt-3 max-w-[60ch] text-muted">{lead}</p>}
      <div className="mt-10">{children}</div>
    </section>
  );
}

export default async function Home() {
  const { t } = await getDict();
  const [event, story] = await Promise.all([attempt(getUsbdcEvent), attempt(() => getCase(STORY_CASE))]);
  const asset = deployment.asset.split(":")[0];
  const [, today, withHabeas] = t.home.compareCols;

  return (
    <main>
      {/* Hero: the problem, shown with a real take back from mainnet. */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 pt-14 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-16 lg:pt-20">
        <div className="lg:pt-6">
          <h1 className="text-4xl sm:text-5xl">{t.home.h1}</h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed">{t.home.lead}</p>
          <p className="mt-4 max-w-[52ch] text-lg leading-relaxed">{t.home.lead2}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/check">{t.nav.check}</ButtonLink>
            <ButtonLink href="/try" variant="secondary">
              {t.nav.try}
            </ButtonLink>
          </div>
        </div>
        <figure>
          {event.ok ? <EventForm e={event.data} /> : <ReadErrorNotice what="the mainnet take back" message={event.message} />}
          <figcaption className="mt-1 max-w-[52ch] text-sm text-muted">{t.event.caption}</figcaption>
        </figure>
      </section>

      {/* The same take back, as two copies of one form. */}
      <Section id="compare" title={t.home.compareTitle}>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { name: today, col: 1, tone: "bg-pink/60", ink: "text-muted" },
            { name: withHabeas, col: 2, tone: "bg-sheet", ink: "text-pen" },
          ].map((copy) => (
            <div key={copy.name} className={`rounded-[2px] border border-rule ${copy.tone}`}>
              <div className="perforation mx-4 mt-3" aria-hidden />
              <h3 className="px-5 pt-3 pb-3 text-lg">{copy.name}</h3>
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

      <Section id="check" title={t.home.checkTitle} lead={t.home.checkLead}>
        <div className="max-w-3xl">
          <CheckForm />
        </div>
      </Section>

      <Section id="builders" title={t.home.buildersTitle} lead={t.home.buildersLead}>
        <ul className="grid gap-px overflow-hidden rounded-[2px] border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: `${REPO}/tree/main/contracts/habeas`, label: t.home.builders.contract, detail: "Rust · soroban-sdk 28" },
            { href: "/evidence", label: t.home.builders.evidence, detail: "testnet" },
            { href: LAB_URL, label: t.home.builders.build, detail: `wasm ${deployment.wasm_sha256.slice(0, 8)}…` },
            { href: `${REPO}/blob/main/docs/SPEC-cases.md`, label: t.home.builders.spec, detail: "SPEC-cases.md" },
          ].map((l) => (
            <li key={l.label} className="bg-sheet">
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
