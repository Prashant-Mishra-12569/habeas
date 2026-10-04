# Habeas alerts (Telegram)

A Telegram bot that tells you when something happens to a case: your tokens were frozen, your answer is on record, the reviewer decided, the case closed. It reads the Habeas contract's events from Stellar RPC every 20 seconds; nothing is sent from the contract itself.

| Command | What it does |
| --- | --- |
| `/watch G…` | Start watching an address (up to 5 per chat) |
| `/stop G…` | Stop watching it; `/stop` alone stops all |
| `/cases` | The latest cases for your addresses and where they stand |
| `/start` | What the bot does |

Who hears what:

- **Holder** (the address in the case): every step. Frozen with the reason and the deadline, answer on record, reviewer's decision, closed (Cleared or Taken back), withdrawn, emergency take back.
- **Reviewer:** when a holder answers and a decision is needed, with the deadline. If the reviewer stays silent, the holder wins by default, so this is the alert that matters most.
- **Issuer:** when a holder answers, when the reviewer decides and when a case closes.

A chat watching more than one of these gets one message per event. Messages follow the person's Telegram language (Spanish or English).

## Create the bot (once)

1. In Telegram, open **@BotFather** (it has a blue check mark) and press **Start**.
2. Send `/newbot`.
3. Name it `Habeas alerts`.
4. Pick a username ending in `bot`, for example `habeas_alerts_bot`. If it's taken, try `habeas_case_alerts_bot`.
5. BotFather replies with a token (numbers, a colon, letters). Treat it like a password: don't paste it in chats, issues or commits.
6. Copy `.env.example` to `.env` in this folder and paste the token after `TELEGRAM_BOT_TOKEN=`. `.env` is git-ignored.
7. Optional, for a finished look: send `/setuserpic`, pick the bot and upload `brand/bot-avatar.png` from this folder (the Habeas mark, sized for Telegram's round crop). `/setdescription` and `/setabouttext` take a sentence like "Tells you when a Habeas case about your Stellar address is opened, decided or closed."

## Run

```bash
npm install
```

```bash
npm start
```

Then open your bot in Telegram, press **Start** and send `/watch` with your address from [Try it live](https://habeas-stellar.vercel.app/try).

The bot keeps who-watches-what and its place in the event stream in `data/state.json`, so a restart doesn't resend old alerts. RPC keeps events for about 7 days; after a longer outage the bot starts again from the latest ledger.

Set `PORT` to also answer health checks over HTTP (`GET /` returns the last poll time and any error), for hosts that expect a web service.

## Without Telegram

```bash
node src/main.ts --dry-run --watch GAS6L6UQUB4PMX2XZTHPM33ITBBQKQEUNOUSNCPMOFJBQHOC4R7G4N2R --from-ledger 5014120 --once
```

Prints the messages a watcher of that address (here, the demo reviewer) would have received from real testnet events since that ledger, then stops. The ledger must be within RPC's last ~7 days; leave `--from-ledger` and `--once` out to follow new events live. Add `--lang es` for Spanish.

## Tests

```bash
npm test
```

Real events from testnet cases 19 and 20 (saved in `src/fixtures/events.json`, because RPC drops events after about a week) go through decoding, the message text and who hears about them; one test reads the live contract.
