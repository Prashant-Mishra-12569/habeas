// Habeas Telegram alerts.
//
//   npm start                      the bot (needs TELEGRAM_BOT_TOKEN in .env)
//   npm run dry-run -- --watch G…  no Telegram: prints the messages a watcher
//                                  of G… would get, from --from-ledger N
//                                  (default: now); --once stops after catching up
//
// Reads events from Stellar RPC every POLL_SECONDS and messages the chats
// watching the holder, the reviewer or the issuer. Set PORT to also answer
// health checks over HTTP (for hosts that expect a web service).
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { StrKey } from "@stellar/stellar-sdk";
import { Bot, GrammyError } from "grammy";
import deployment from "../../../deployments/testnet.json" with { type: "json" };
import { messagesFor, type Outgoing, type Roles } from "./dispatch.ts";
import { cursorLedger, eventsSince, type CaseEvent } from "./events.ts";
import { formatAmount, formatUtc, langFor, replies, STATUS, type Lang } from "./messages.ts";
import { Habeas, type CaseRecord } from "./stellar.ts";
import { Store, MAX_ADDRESSES } from "./store.ts";

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    watch: { type: "string", multiple: true, default: [] },
    lang: { type: "string", default: "en" },
    "from-ledger": { type: "string" },
    once: { type: "boolean", default: false },
  },
});

const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
const SITE = (process.env.SITE_URL ?? "https://habeas-stellar.vercel.app").replace(/\/$/, "");
const POLL_MS = Number(process.env.POLL_SECONDS ?? 20) * 1000;
const DATA = process.env.DATA_DIR ?? fileURLToPath(new URL("../data", import.meta.url));
const ASSET = deployment.asset.split(":")[0];
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const dry = args["dry-run"];

const habeas = new Habeas(RPC_URL, deployment.habeas);
const store = new Store(dry ? null : `${DATA}/state.json`);
// The deployment record says who the issuer and reviewer are; refreshed from the contract below.
let roles: Roles = { issuer: deployment.issuer, reviewer: deployment.reviewer };
const health = { startedAt: new Date().toISOString(), lastPoll: "", lastError: "", sent: 0 };

const scrub = (msg: string) => (TOKEN ? msg.replaceAll(TOKEN, "<token>") : msg);
const log = (...parts: unknown[]) => console.log(new Date().toISOString(), ...parts.map((p) => (typeof p === "string" ? scrub(p) : p)));
const now = () => Math.floor(Date.now() / 1000);
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const isAddress = (a: string) => StrKey.isValidEd25519PublicKey(a) || StrKey.isValidContract(a);

if (dry) {
  const lang = langFor(args.lang);
  for (const a of args.watch) {
    if (!isAddress(a)) throw new Error(`Not a Stellar address: ${a}`);
    store.watch(0, a, lang);
  }
} else if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is missing. Copy apps/alerts/.env.example to .env and paste the token from @BotFather.");
  process.exit(1);
}

const bot = dry ? null : new Bot(TOKEN);

async function send({ chatId, text }: Outgoing) {
  if (!bot) {
    console.log(`\n--- to chat ${chatId} ---\n${text}`);
    return;
  }
  try {
    await bot.api.sendMessage(chatId, text, { link_preview_options: { is_disabled: true } });
    health.sent++;
  } catch (e) {
    // 403: the person blocked the bot or left; stop writing to them.
    if (e instanceof GrammyError && e.error_code === 403) store.forget(chatId);
    else log("send failed", chatId, (e as Error).message);
  }
}

async function deliver(ev: CaseEvent) {
  let caseRecord: CaseRecord | undefined;
  if (ev.kind === "case_opened") {
    // The issuer's own words live in the case record, not the event. Without them the alert still goes out.
    caseRecord = await habeas.getCase(ev.caseId).catch(() => undefined);
  }
  const out = messagesFor(ev, store, roles, { asset: ASSET, site: SITE, now: now(), caseRecord });
  for (const m of out) await send(m);
  if (out.length) log(`${ev.kind} #${ev.caseId}: ${out.length} message(s)`);
}

async function poll() {
  let from: { cursor: string } | { startLedger: number };
  if (store.cursor) from = { cursor: store.cursor };
  else from = { startLedger: args["from-ledger"] ? Number(args["from-ledger"]) : await habeas.latestLedger() };
  let res;
  try {
    res = await eventsSince(habeas.server, habeas.contractId, from);
  } catch (e) {
    // RPC keeps about 7 days of events. After a longer outage, start again from now rather than fail forever.
    if (store.cursor && /cursor|range|ledger/i.test((e as Error).message)) {
      log(`cursor ${store.cursor} no longer usable (${(e as Error).message}); starting from the latest ledger`);
      res = await eventsSince(habeas.server, habeas.contractId, { startLedger: await habeas.latestLedger() });
    } else throw e;
  }
  for (const ev of res.events) {
    await deliver(ev);
    store.setCursor(ev.id);
  }
  store.setCursor(res.cursor);
  health.lastPoll = new Date().toISOString();
  return cursorLedger(res.cursor);
}

async function refreshRoles() {
  try {
    roles = await habeas.config();
  } catch (e) {
    log("couldn't read the contract config; keeping", roles, (e as Error).message);
  }
}

async function loop() {
  for (let n = 0; ; n++) {
    if (n % 30 === 0) await refreshRoles();
    try {
      const ledger = await poll();
      health.lastError = "";
      if (args.once) {
        log(`caught up to ledger ${ledger}`);
        return;
      }
    } catch (e) {
      health.lastError = (e as Error).message;
      log("poll failed, will retry:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

function lang(ctx: { from?: { language_code?: string } }): Lang {
  return langFor(ctx.from?.language_code);
}

if (bot) {
  bot.command(["start", "help"], (ctx) => ctx.reply(replies[lang(ctx)].help(ASSET, SITE), { link_preview_options: { is_disabled: true } }));

  bot.command("watch", async (ctx) => {
    const t = replies[lang(ctx)];
    const address = ctx.match.trim().toUpperCase();
    if (!address) return ctx.reply(t.watchHow);
    if (!isAddress(address)) return ctx.reply(t.notAddress);
    const result = store.watch(ctx.chat.id, address, lang(ctx));
    if (result === "full") return ctx.reply(t.tooMany(MAX_ADDRESSES));
    const lines = [t.watching(short(address))];
    if (address === roles.reviewer) lines.push(t.isReviewer);
    if (address === roles.issuer) lines.push(t.isIssuer);
    try {
      const active = await habeas.activeCase(address);
      if (active !== null) {
        const c = await habeas.getCase(active);
        lines.push(t.activeNow(active, STATUS[lang(ctx)][c.status] ?? c.status));
      }
    } catch {
      // The watch is saved either way; the active-case line is extra.
    }
    return ctx.reply(lines.join("\n\n"));
  });

  bot.command("stop", (ctx) => {
    const t = replies[lang(ctx)];
    const address = ctx.match.trim().toUpperCase();
    if (!address) return ctx.reply(store.stop(ctx.chat.id) ? t.stoppedAll : t.noneWatched);
    return ctx.reply(store.stop(ctx.chat.id, address) ? t.stopped(short(address)) : t.notWatching);
  });

  bot.command("cases", async (ctx) => {
    const l = lang(ctx);
    const t = replies[l];
    const addresses = store.addresses(ctx.chat.id);
    if (!addresses.length) return ctx.reply(t.noneWatched);
    try {
      const blocks: string[] = [];
      for (const a of addresses) {
        const ids = (await habeas.casesFor(a)).slice(-5).reverse();
        if (!ids.length) {
          blocks.push(t.noCases(short(a)));
          continue;
        }
        const cases = await Promise.all(ids.map((id) => habeas.getCase(id)));
        const lines = cases.map((c) =>
          t.caseLine(c.id, STATUS[l][c.status] ?? c.status, `${formatAmount(c.amount, l)} ${ASSET}`, formatUtc(c.openedAt, l), `${SITE}/case/${c.id}`),
        );
        blocks.push([short(a), ...lines].join("\n"));
      }
      return ctx.reply(blocks.join("\n\n"), { link_preview_options: { is_disabled: true } });
    } catch (e) {
      return ctx.reply(t.readFailed((e as Error).message));
    }
  });

  bot.catch((err) => log("bot error:", err.message));

  for (const l of ["en", "es"] as const) {
    const c = replies[l].commands;
    await bot.api.setMyCommands(
      [
        { command: "watch", description: c.watch },
        { command: "stop", description: c.stop },
        { command: "cases", description: c.cases },
        { command: "start", description: c.start },
      ],
      l === "es" ? { language_code: "es" } : {},
    );
  }
  void bot.start({ onStart: (me) => log(`@${me.username} is running; contract ${deployment.habeas}`) });
}

if (process.env.PORT) {
  createServer((_, res) => {
    res.writeHead(health.lastError ? 503 : 200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...health, cursor: store.cursor ?? null }));
  }).listen(Number(process.env.PORT));
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    void bot?.stop();
    process.exit(0);
  });
}

await loop();
