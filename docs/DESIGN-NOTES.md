# Design notes from the reference sites (Oct 3, 2026)

Looked at for structure and clarity, not looks.

## Borrow

1. **Try it before reading** (Local402). Their first section is "try it", with free testnet payments from a demo wallet, no setup. Our "Try it live" should be reachable from the first screen, and "without a wallet" must really be zero setup.
2. **"Today vs with us" table** (Local402). One table with one row per thing that changes. Ours: "Today on Stellar" vs "With Habeas": reason given, deadline to answer, who decides, what happens if nobody acts, can you check it.
3. **Proof right next to every claim** (AegisOS). Each guarantee has its own transaction link beside it, not in a separate appendix. Every number on our home page should link to the transaction it came from.
4. **Mainnet proof as its own section** (Local402). Our version: the real USBDC event, read live from mainnet Horizon.
5. **Honest test framing** (AegisOS says "a hostile seller (ours, simulated for the test)"). Our demo copy should say plainly which parts are demo actors (demo issuer, demo reviewer) and which are real (the chain, the transactions).
6. **EN / ES toggle in the header** on both sites. Ours too, from day one.
7. stellar.org itself just published "A Bank-Issued Stablecoin Moves Real Money on Stellar" (Sep 9) and "Practical Confidential Stablecoins: An Issuer-Controlled Architecture" (Sep 24). Issuer powers are on SDF's mind, so link these from the "why now" part of the README and deck, not the site's hero.

## Avoid

1. **Looking like AegisOS.** It already uses a legal "case file" theme: a "CASE FILE 2026-09-26" header, "EXHIBIT C" labels, a round "verified" stamp, mono all-caps labels on a light page. Habeas must not drift into courtroom paperwork. Our metaphor is the **carbon-copy form set** (white, canary, pink copies, ballpoint-blue handwriting in fields), not exhibits and seals. No circular stamps, no "EXHIBIT", no mono all-caps eyebrows.
2. **Numbered all-caps section eyebrows** ("01 — PRUÉBALO", "02 — THE PROBLEM"). Both top entries do this, so it already reads as a template. We use plain sentence-case headings.
3. **One accented word in the headline** (Local402's italic "tu moneda"). Already on our avoid list.
4. **Raw errors on the page.** Local402's calculator showed "Failed to fetch" while I looked. Every network call of ours gets a sentence that says what happened and a Retry button.
5. **Hosting that sleeps.** AgentAllowance's console on Render's free tier stayed blank for 15+ seconds, twice. A judge leaves in less. The site goes on Vercel; the Telegram worker is the only thing allowed on a sleeping host, and the site must not depend on it.
6. **Dark terminal look.** Local402 is dark with terminal panes, like most agent projects. Our light form-white page will stand out next to them; keep it.
