import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { getDict } from "@/i18n/server";
import { Button } from "@/components/Button";
import { CaseReplay } from "@/components/CaseReplay";
import { EventForm } from "@/components/EventForm";
import { PenCircle } from "@/components/PenCircle";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { Replayable } from "@/components/Replayable";
import { TickBox } from "@/components/TickBox";
import { caseTimeline, deployment, getCase } from "@/lib/habeas";
import { contractUrl } from "@/lib/format";
import { getUsbdcEvent } from "@/lib/mainnet";
import { ReadError } from "@/lib/network";

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getDict();
  return pageMeta({ ...t.meta.pages.styleguide, path: "/styleguide", lang, index: false });
}
// Everything below is read from Stellar on each request.
export const dynamic = "force-dynamic";

async function attempt<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (e) {
    return { ok: false as const, message: e instanceof ReadError ? e.message : (e as Error).message };
  }
}

const COLORS = [
  { name: "Page", token: "paper", paper: "#F7F8F4", carbon: "#0F1120", use: "Form white / carbon sheet" },
  { name: "Form", token: "sheet", paper: "#FDFDFB", carbon: "#181B2E", use: "The form itself" },
  { name: "Ink", token: "ink", paper: "#1F2229", carbon: "#E8EAF4", use: "Text" },
  { name: "Muted", token: "muted", paper: "#50555E", carbon: "#A4A9C0", use: "Labels, help text" },
  { name: "Ballpoint", token: "pen", paper: "#1F3A8F", carbon: "#AFBCFF", use: "Actions and filled-in values" },
  { name: "Canary copy", token: "canary", paper: "#F1E8B8", carbon: "#2E2812", use: "Waiting states" },
  { name: "Pink copy", token: "pink", paper: "#EBCFD3", carbon: "#331F29", use: "Frozen, missing" },
  { name: "Cleared", token: "cleared", paper: "#2F6E4E", carbon: "#8FD6B0", use: "Cleared" },
  { name: "Taken back", token: "taken", paper: "#9E2B33", carbon: "#F4A3AA", use: "Only a completed take back" },
  { name: "Field line", token: "field", paper: "#6A6F64", carbon: "#80869F", use: "Input borders, 3:1" },
];

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-t border-rule py-12">
      <h2 className="text-2xl">{title}</h2>
      {intro && <p className="mt-2 max-w-[64ch] text-muted">{intro}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default async function StyleguidePage() {
  const [event, cleared, takenBack] = await Promise.all([attempt(getUsbdcEvent), attempt(() => getCase(3)), attempt(() => getCase(4))]);
  const asset = deployment.asset.split(":")[0];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-12 sm:px-8">
      <h1 className="text-3xl sm:text-4xl">Styleguide</h1>
      <p className="mt-3 max-w-[64ch]">
        The carbon-copy form set. Paper is the white original; Carbon turns the page into the carbon sheet itself. Use the switches at the top to see both, in English or Spanish. Every form here is filled with real data: a mainnet take back and two testnet cases.
      </p>

      <Section
        id="logo"
        title="Logo"
        intro="One source file (public/brand/habeas-logo.png); scripts/make-brand.mjs makes every size from it. On Carbon the navy pillars are lifted so the H still reads on the dark page. The mark sits next to the name, never instead of it."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "On Paper", bg: "#F7F8F4", src: "/brand/habeas-mark.png", ink: "#1F2229" },
            { label: "On Carbon", bg: "#0F1120", src: "/brand/habeas-mark-carbon.png", ink: "#E8EAF4" },
          ].map((v) => (
            <figure key={v.label} className="rounded-[2px] border border-rule p-6" style={{ background: v.bg }}>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a fixed swatch, not content */}
                <img src={v.src} alt="" className="h-16 w-auto" />
                <span className="text-3xl font-extrabold tracking-[-0.03em]" style={{ color: v.ink }}>
                  Habeas
                </span>
              </div>
              <figcaption className="mt-4 text-sm" style={{ color: v.ink }}>
                {v.label}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          Files: favicon.ico (16, 32, 48), icon.png (512), apple-icon.png (180, on paper), manifest icons 192 and 512 plus a maskable 512, a 640 px avatar for the Telegram bot.
        </p>
      </Section>

      <Section id="motion" title="The main animation" intro="A real take back from mainnet fills itself in. The two fields a fair process needs stay empty and get circled in pen.">
        <div className="max-w-2xl">
          {event.ok ? (
            <Replayable>
              <EventForm e={event.data} />
            </Replayable>
          ) : (
            <ReadErrorNotice what="the mainnet take back" message={event.message} />
          )}
        </div>
      </Section>

      <Section id="states" title="A case in every state" intro="Status is a row of tick boxes, filled in ballpoint. The copies slide out again on each change.">
        <div className="space-y-14">
          {cleared.ok ? <CaseReplay c={cleared.data} steps={caseTimeline(cleared.data)} asset={asset} /> : <ReadErrorNotice what="case 3" message={cleared.message} />}
          {takenBack.ok ? <CaseReplay c={takenBack.data} steps={caseTimeline(takenBack.data)} asset={asset} /> : <ReadErrorNotice what="case 4" message={takenBack.message} />}
          <p className="text-sm text-muted">
            Read from contract{" "}
            <a className="font-mono text-pen underline" href={contractUrl(deployment.habeas)} target="_blank" rel="noreferrer">
              {deployment.habeas.slice(0, 8)}…
            </a>{" "}
            on testnet.
          </p>
        </div>
      </Section>

      <Section id="marks" title="Pen marks" intro="Ticks and circles are revealed by a moving clip (transform only), so they draw like a pen without animating the stroke.">
        <div className="flex flex-wrap items-center gap-8">
          <TickBox checked label="Ticked" />
          <TickBox checked={false} label="Empty" />
          <TickBox checked tone="cleared" label="Cleared" />
          <TickBox checked tone="taken" label="Taken back" />
          <PenCircle>
            <span className="text-sm text-muted">Not provided</span>
          </PenCircle>
        </div>
      </Section>

      <Section id="colors" title="Colours" intro="Paper / Carbon. Copies stay pale; strong colour only marks state. Every text pair passes WCAG AA on every surface.">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COLORS.map((c) => (
            <li key={c.token} className="flex items-center gap-4">
              <span className="h-14 w-14 shrink-0 rounded-[2px] border border-rule" style={{ background: `var(--${c.token})` }} />
              <span>
                <span className="block font-semibold">{c.name}</span>
                <span className="block font-mono text-xs text-muted">
                  {c.paper} / {c.carbon}
                </span>
                <span className="block text-sm text-muted">{c.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title="Type" intro="Public Sans 800 for headings (approved), 400 for reading. IBM Plex Mono only for addresses, fingerprints, case numbers and amounts.">
        <p className="text-5xl">Your tokens can be frozen and taken.</p>
        <p className="mt-4 text-2xl font-bold">How a case works</p>
        <p className="mt-4 max-w-[64ch]">Body text, 17 px, line height 1.55. Banks and funds that issue tokens on Stellar can freeze them or take them back.</p>
        <p className="mt-2 font-mono text-sm">CD5XGBA4…EZUU · 400 DEMOUSD · 4d21f27c…fdf0a7f1</p>
      </Section>

      <Section id="buttons" title="Buttons" intro="Every button names exactly what happens. At least 44 px tall. No arrows.">
        <div className="flex flex-wrap gap-3">
          <Button>Freeze and open case</Button>
          <Button>Send my answer</Button>
          <Button variant="secondary">Uphold</Button>
          <Button variant="secondary">Reject</Button>
          <Button>Settle case</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button busy>Sending your answer…</Button>
          <Button disabled>Settle case</Button>
          <Button variant="quiet">Check a token</Button>
        </div>
      </Section>
    </main>
  );
}
