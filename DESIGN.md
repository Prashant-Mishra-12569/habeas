# DESIGN.md: Habeas

How the Habeas website looks and moves. Agents and people changing the UI read this first. Tokens live in `apps/web/src/app/globals.css`; copy lives in `apps/web/src/i18n/dict.ts`.

## Idea

**The carbon-copy form set.** Old paper forms came as a white original with canary and pink copies, so every party kept the same record. A Habeas case is exactly that, on Stellar: the issuer, the holder and the reviewer all hold the same record. Every visual choice comes from paperwork: ruled rows, perforated tear lines, tick boxes, ballpoint ink, margin notes, tally marks.

Not courtroom paperwork: no seals, round stamps, "EXHIBIT" labels or gavel imagery.

## Themes

| Token | Paper (light, default) | Carbon (dark) | Use |
| --- | --- | --- | --- |
| `--paper` | `#f7f8f4` | `#0c0c0e` | Page |
| `--sheet` | `#fdfdfb` | `#141416` | Forms and panels |
| `--ink` | `#1f2229` | `#eeebe3` | Text |
| `--muted` | `#50555e` | `#a19d94` | Secondary text |
| `--rule` | `#d6d9d0` | `#26262a` | Form lines |
| `--field` | `#6a6f64` | `#77736b` | Input lines, empty boxes (3:1) |
| `--pen` | `#1f3a8f` ballpoint blue | `#e6cc7e` gold leaf | Ink: actions, links, filled-in values, handwriting |
| `--canary` | `#f1e8b8` | `#4b4127` | Second copy |
| `--pink` | `#ebcfd3` | `#4b2d33` | Third copy |
| `--cleared` | `#2f6e4e` | `#8ad3a9` | Cleared, unfrozen |
| `--taken` | `#9e2b33` | `#f19aa2` | Taken back (use rarely) |

- Strong colour only marks state. Copies stay pale on Paper and dim on Carbon.
- Both themes have a soft lamp light from the top right and a static paper grain. No gradients on surfaces, no glow on panels.
- Carbon is near-black with a warm undertone and gold ink (the gold of the Habeas mark). Never navy.
- Every text pair passes WCAG AA in both themes.

## Type

- **Public Sans** for everything people read. Headings 800, tracking -0.03 to -0.04em, `text-wrap: balance`.
- **IBM Plex Mono** only for data: addresses, hashes, case numbers, amounts, asset codes.
- **Kalam** only for handwritten margin notes, in `--pen`, rotated -2 to -3 degrees, a few words long.
- Scale 1.25 from a 17px body. Page titles `clamp(2.5rem, 8.5vw, 4.6rem)`. Lines under 72 characters.
- Sentence case everywhere (a deliberate choice over Title Case). No all-caps eyebrow labels.

## Components

- **CaseForm**: the form sheet with perforation, title rule (2px ink), label/value rows, tick-box status. The canary and pink copies sit offset behind it; `fan` swings them out for the hero.
- **PageHeader**: every inner page opens with a big title, a ballpoint stroke drawn under it and one margin note.
- **TickBox**: ballpoint tick wiped in with a clip. Status is shown as ticks, not badges.
- **PenCircle**: circles a missing value the way an auditor would.
- **Tally**: take backs drawn as groups of five pen strokes.
- **EvidenceBoard**: tabs (row on phones, column on desktop) opening one compact panel; endings as a grid with one tick per stage, each linking to its transaction.
- Buttons: primary = pen fill; secondary = 2px pen outline; quiet = underlined pen text. 44px minimum height. Corners 2-3px.

## Motion

Library: `motion` (formerly framer-motion). Smooth wheel scrolling: `lenis` (touch keeps native scrolling).

Every animation is part of the paperwork story, never decoration:
- Hero: the form fills itself in with the real mainnet take back; empty fields get circled and annotated; the set lifts off the page on scroll.
- Tally marks are drawn when the record scrolls into view.
- A statement lights up word by word as you read it.
- "One case, three copies": a pinned stage where the set splits into three identical copies.
- "How a case works": an ink line draws down the steps while a real case changes state.
- State changes slide a carbon copy out from under the form.

Rules: transform and opacity only (SVG strokes may use pathLength); 200-900ms; ease `cubic-bezier(0.22, 1, 0.36, 1)`; no bouncy springs; no fade-up on every section; everything has a reduced-motion path that renders the final state.

## Layout

- Mobile first. Checked at 320, 360, 390, 768, 1024 and 1440px. No sideways scroll (grid columns get `min-w-0`).
- Left-aligned text. Content width up to `max-w-6xl`.
- Long pages get two columns on desktop (evidence board, token result with a sticky summary, developers).
- Sticky frosted header; anchors land below it (`scroll-padding-top`).

## Copy

Plain words for someone who has never used crypto: freeze, take back (clawback), reviewer, unfreeze, fingerprint of the file, Cleared, Taken back. Active voice. Errors say what happened and what to do. No hype words. English and Spanish.

## Honesty rules

Every number on screen comes from Stellar or from the code (with a test keeping it true). The U.S. Bank example is described as a legitimate pilot, with sources linked under it.
