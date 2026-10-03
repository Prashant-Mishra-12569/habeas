import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { CaseReplay } from "@/components/CaseReplay";
import { EventForm } from "@/components/EventForm";
import { ReadErrorNotice } from "@/components/ReadErrorNotice";
import { Replayable } from "@/components/Replayable";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReadError, caseTimeline, deployment, getCase } from "@/lib/habeas";
import { contractUrl } from "@/lib/format";
import { getUsbdcEvent } from "@/lib/mainnet";

export const metadata: Metadata = { title: "Styleguide · Habeas" };
// Everything below is read from Stellar on each request.
export const dynamic = "force-dynamic";

async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, message: e instanceof ReadError ? e.message : `Unexpected error: ${(e as Error).message}` };
  }
}

const COLORS = [
  { name: "Form white", token: "paper", light: "#F7F8F4", dark: "#17191E", use: "Page background" },
  { name: "Graphite", token: "ink", light: "#1F2229", dark: "#F7F8F4", use: "Text and headings" },
  { name: "Muted", token: "muted", light: "#50555E", dark: "#A9ADB5", use: "Labels, help text" },
  { name: "Ballpoint blue", token: "pen", light: "#1F3A8F", dark: "#9DB0EE", use: "Actions, links, filled-in values" },
  { name: "Canary copy", token: "canary", light: "#F1E8B8", dark: "#2A2817", use: "Waiting for an answer or decision" },
  { name: "Pink copy", token: "pink", light: "#EBCFD3", dark: "#2C1F22", use: "Frozen, missing" },
  { name: "Cleared green", token: "cleared", light: "#2F6E4E", dark: "#7DC09C", use: "Cleared, unfrozen" },
  { name: "Taken-back red", token: "taken", light: "#9E2B33", dark: "#EE9AA1", use: "Only a completed take back" },
  { name: "Rule gray", token: "rule", light: "#D6D9D0", dark: "#3A3E46", use: "Form lines (decorative)" },
  { name: "Field line", token: "field", light: "#6A6F64", dark: "#7A7F88", use: "Input borders (3:1 on every copy)" },
];

const SCALE = [
  { cls: "text-4xl", px: "52", sample: "Your tokens can be frozen and taken." },
  { cls: "text-3xl", px: "41", sample: "You should know why." },
  { cls: "text-2xl", px: "33", sample: "How a case works" },
  { cls: "text-xl", px: "27", sample: "The holder answers" },
  { cls: "text-lg", px: "21", sample: "Case 3" },
];

const WORDS = [
  ["deauthorize, revoke", "freeze"],
  ["clawback", "take back (first time: “take back (clawback)”)"],
  ["arbiter", "reviewer"],
  ["restore authorization", "unfreeze"],
  ["evidence hash", "fingerprint of the file"],
  ["outcome: restored / clawback", "Cleared / Taken back"],
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
  const [event, cleared, takenBack] = await Promise.all([
    attempt(getUsbdcEvent),
    attempt(() => getCase(3)),
    attempt(() => getCase(4)),
  ]);
  const asset = deployment.asset.split(":")[0];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <p className="text-lg font-bold">Habeas</p>
        <ThemeToggle />
      </header>

      <div className="pb-12">
        <h1 className="text-3xl sm:text-4xl">Styleguide</h1>
        <p className="mt-3 max-w-[64ch]">
          The look of Habeas before any real page is built. The idea is the carbon-copy form: old paper forms came as a white original with yellow and pink copies, so every party kept the same record. Habeas does that on Stellar. Nothing on this page is made up: the forms below are filled with a real mainnet take back and real testnet cases.
        </p>
      </div>

      <Section
        id="motion"
        title="The main animation"
        intro="The home page opens with this. A real take back (clawback) from Stellar mainnet fills itself into the form. The two fields a fair process needs stay empty, because the public record has nothing to put there."
      >
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

      <Section
        id="states"
        title="A case in every state"
        intro="Two real cases on the Habeas testnet contract, replayed step by step from their own timestamps. Each time the state changes, the carbon copies slide out from under the form."
      >
        <div className="space-y-14">
          <div>
            <h3 className="mb-4 text-lg">The holder answers and is cleared</h3>
            {cleared.ok ? (
              <CaseReplay c={cleared.data} steps={caseTimeline(cleared.data)} asset={asset} network="testnet" />
            ) : (
              <ReadErrorNotice what="case 3" message={cleared.message} />
            )}
          </div>
          <div>
            <h3 className="mb-4 text-lg">The reviewer upholds and the tokens are taken back</h3>
            {takenBack.ok ? (
              <CaseReplay c={takenBack.data} steps={caseTimeline(takenBack.data)} asset={asset} network="testnet" />
            ) : (
              <ReadErrorNotice what="case 4" message={takenBack.message} />
            )}
          </div>
          <p className="text-sm text-muted">
            Read from contract{" "}
            <a className="font-mono text-pen underline" href={contractUrl(deployment.habeas)} target="_blank" rel="noreferrer">
              {deployment.habeas.slice(0, 8)}…
            </a>{" "}
            on Stellar testnet.
          </p>
        </div>
      </Section>

      <Section
        id="colors"
        title="Colours"
        intro="Copies stay pale and a little dusty, never bright. Strong colour only marks state: blue is an action, green is cleared, red is taken back and appears rarely. Every text pair passes WCAG AA in both themes."
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COLORS.map((c) => (
            <li key={c.token} className="flex items-center gap-4">
              <span className="h-14 w-14 shrink-0 rounded-[3px] border border-rule" style={{ background: `var(--${c.token})` }} />
              <span>
                <span className="block font-semibold">{c.name}</span>
                <span className="block font-mono text-xs text-muted">
                  {c.light} / {c.dark}
                </span>
                <span className="block text-sm text-muted">{c.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="type"
        title="Type"
        intro="Public Sans for everything people read: it was made for public-service websites. IBM Plex Mono only for real data: addresses, fingerprints, case numbers, amounts. Scale ratio 1.25 from a 17 px body."
      >
        <div className="space-y-4">
          {SCALE.map((s) => (
            <div key={s.cls} className="flex items-baseline gap-4 border-b border-rule pb-3">
              <span className="w-12 shrink-0 font-mono text-xs text-muted">{s.px}px</span>
              <p className={`${s.cls} font-bold leading-tight tracking-[-0.015em]`}>{s.sample}</p>
            </div>
          ))}
          <p className="max-w-[64ch] pt-2">
            Body text, 17 px with a line height of 1.55. Banks and funds that issue tokens on Stellar can freeze them or take them back. That&apos;s sometimes needed: fraud happens, mistakes happen.
          </p>
          <p className="font-mono text-sm">Mono: addresses, fingerprints, case numbers and amounts only.</p>
        </div>

        <h3 className="mt-12 text-lg">Pick a heading face</h3>
        <p className="mt-1 text-muted">Body text stays Public Sans either way.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <figure className="rounded-[3px] border border-rule p-5">
            <p className="text-2xl font-extrabold tracking-[-0.02em]">Your tokens can be frozen and taken. You should know why.</p>
            <figcaption className="mt-3 text-sm text-muted">A. Public Sans 800 (current)</figcaption>
          </figure>
          <figure className="rounded-[3px] border border-rule p-5">
            <p className="font-alt text-2xl font-bold tracking-[-0.02em]">Your tokens can be frozen and taken. You should know why.</p>
            <figcaption className="mt-3 text-sm text-muted">B. Schibsted Grotesk 700, more newspaper and forms</figcaption>
          </figure>
        </div>
      </Section>

      <Section id="buttons" title="Buttons" intro="Every button names exactly what happens, and the success message repeats the same verb. At least 44 px tall. No arrows.">
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
        <p className="mt-3 text-sm text-muted">Busy, disabled and a quiet link. Press Tab to see the focus ring.</p>
      </Section>

      <Section id="fields" title="Form fields" intro="Fields look like lines on a form. Errors say what happened and what to do.">
        <div className="grid max-w-2xl gap-8">
          <label className="block">
            <span className="text-sm font-semibold">Holder&apos;s address</span>
            <span className="block text-sm text-muted">Starts with G or C.</span>
            <input
              className="mt-2 block min-h-11 w-full border-0 border-b-2 border-field bg-transparent px-0 font-mono text-pen placeholder:text-muted focus:border-pen"
              placeholder="G…"
            />
          </label>
          <div>
            <label htmlFor="sg-answer" className="text-sm font-semibold">
              Your answer
            </label>
            <textarea
              id="sg-answer"
              aria-describedby="sg-answer-error"
              aria-invalid
              rows={3}
              className="mt-2 block w-full rounded-[3px] border-2 border-taken bg-transparent p-3 text-pen"
            />
            <p id="sg-answer-error" className="mt-2 text-sm text-taken">
              Your answer window closed on Oct 9 at 14:00 UTC. The issuer can now settle the case.
            </p>
          </div>
          <p className="text-muted">Empty state: “No cases for this address. That&apos;s good news.”</p>
        </div>
      </Section>

      <Section id="words" title="Words on screen" intro="Written for someone who has never used crypto. Plain, active, sentence case. English and Spanish.">
        <table className="w-full max-w-2xl text-left text-sm">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="py-2 pr-4 font-semibold">Not this</th>
              <th className="py-2 font-semibold">This</th>
            </tr>
          </thead>
          <tbody>
            {WORDS.map(([a, b]) => (
              <tr key={a} className="border-b border-rule">
                <td className="py-2 pr-4 text-muted">{a}</td>
                <td className="py-2">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </main>
  );
}
