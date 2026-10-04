// node --test src/*.test.ts
//
// Real events from testnet (fixtures/events.json, cases 19 and 20) go through
// decoding, the message text and the choice of who hears about them. The last
// test reads the live contract.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { rpc, xdr } from "@stellar/stellar-sdk";
import deployment from "../../../deployments/testnet.json" with { type: "json" };
import { messagesFor } from "./dispatch.ts";
import { cursorLedger, decodeEvent, type CaseEvent } from "./events.ts";
import fixture from "./fixtures/events.json" with { type: "json" };
import { eventMessage, formatAmount, formatWhen } from "./messages.ts";
import { Habeas } from "./stellar.ts";
import { MAX_ADDRESSES, Store } from "./store.ts";

const HOLDER = "GA63KB4T5RNL74LHDGPB6GBNIAXZXX7O5GLRJ3SQ7C7WL6T626FQ3DNT";
const roles = { issuer: deployment.issuer, reviewer: deployment.reviewer };
const ctx = { asset: "DEMOUSD", site: "https://habeas-stellar.vercel.app", now: 0 };

const events: CaseEvent[] = fixture.events.map((e) => {
  const raw = { ...e, topic: e.topic.map((t) => xdr.ScVal.fromXDR(t, "base64")), value: xdr.ScVal.fromXDR(e.value, "base64") };
  const ev = decodeEvent(raw as unknown as rpc.Api.EventResponse);
  assert.ok(ev, `event ${e.id} decodes`);
  return ev;
});

test("decodes every kind of case event from the contract", () => {
  assert.deepEqual(
    events.map((e) => `${e.caseId}:${e.kind}`),
    ["19:case_opened", "19:case_appealed", "19:case_decided", "19:case_settled", "20:case_opened", "20:case_settled"],
  );
  const [opened, , decided, settled19, , settled20] = events;
  assert.equal(opened.holder, HOLDER);
  assert.ok(opened.kind === "case_opened" && opened.amount === 4_000_000_000n && opened.reason === "Fraud" && opened.answerBy > 0);
  assert.ok(decided.kind === "case_decided" && decided.upheld === false);
  assert.ok(settled19.kind === "case_settled" && settled19.outcome === "Cleared" && settled19.endedBy === "ReviewerRejected");
  assert.ok(settled20.kind === "case_settled" && settled20.outcome === "TakenBack" && settled20.endedBy === "NoAnswer" && settled20.taken === 4_000_000_000n);
  assert.equal(opened.tx, fixture.events[0].txHash);
});

test("the holder hears every step, in plain words", () => {
  const texts = events.map((e) => eventMessage(e, "holder", "en", ctx));
  assert.match(texts[0]!, /^Your DEMOUSD is frozen\.\nCase #19 asks to take back \(clawback\) 400 DEMOUSD\. Reason: Suspected fraud\./);
  assert.match(texts[0]!, /Answering is free\.\nhttps:\/\/habeas-stellar\.vercel\.app\/case\/19$/);
  assert.match(texts[2]!, /The reviewer sided with you in case #19\./);
  assert.match(texts[3]!, /Case #19 is closed: Cleared\.\nYour tokens are unfrozen\.\nThe reviewer sided with you\./);
  assert.match(texts[5]!, /Case #20 is closed: Taken back\.\n400 DEMOUSD was taken back \(clawback\)\. The rest of your balance is unfrozen\.\nNo answer came before the deadline\./);
  // No banned or crypto-insider words.
  for (const t of texts) assert.doesNotMatch(t!, /deauthoriz|arbiter|hash|seamless|unlock|empower/i);
});

test("Spanish uses the site's words", () => {
  const [opened, , , settled] = events.map((e) => eventMessage(e, "holder", "es", ctx));
  assert.match(opened!, /^Tu DEMOUSD está congelado\.\nEl caso #19 pide recuperar \(clawback\) 400 DEMOUSD\. Razón: Sospecha de fraude\./);
  assert.match(settled!, /El caso #19 está cerrado: Liberado\./);
});

test("the reviewer hears only when a decision is needed; the issuer doesn't hear its own open", () => {
  const appealed = events[1];
  assert.match(eventMessage(appealed, "reviewer", "en", ctx)!, /^Case #19 needs your decision by .+\nIf you don't decide, the holder wins by default\./);
  for (const e of events.filter((e) => e.kind !== "case_appealed")) assert.equal(eventMessage(e, "reviewer", "en", ctx), null);
  assert.equal(eventMessage(events[0], "issuer", "en", ctx), null);
  assert.match(eventMessage(events[3], "issuer", "en", ctx)!, /^Case #19 is closed: Cleared\./);
});

test("one message per chat, from the closest seat", () => {
  const store = new Store(null);
  store.watch(1, HOLDER, "en");
  store.watch(1, roles.reviewer, "en");
  store.watch(2, roles.reviewer, "es");
  store.watch(3, roles.issuer, "en");
  const out = messagesFor(events[1], store, roles, ctx);
  assert.deepEqual(out.map((m) => m.chatId), [1, 2, 3]);
  assert.match(out[0].text, /^Your answer to case #19 is on record\./);
  assert.match(out[1].text, /^El caso #19 necesita tu decisión/);
  assert.match(out[2].text, /^The holder answered case #19\./);
  assert.deepEqual(messagesFor(events[0], new Store(null), roles, ctx), []);
});

test("the store keeps watches and the cursor across restarts", () => {
  const file = join(mkdtempSync(join(tmpdir(), "habeas-alerts-")), "state.json");
  const a = new Store(file);
  assert.equal(a.watch(7, HOLDER, "es"), "added");
  assert.equal(a.watch(7, HOLDER, "es"), "already");
  a.setCursor(fixture.events[0].id);
  const b = new Store(file);
  assert.deepEqual(b.watchers(HOLDER), [{ chatId: 7, lang: "es" }]);
  assert.equal(b.cursor, fixture.events[0].id);
  for (let i = 1; i < MAX_ADDRESSES; i++) b.watch(7, `G${i}`, "es");
  assert.equal(b.watch(7, "GEXTRA", "es"), "full");
  assert.equal(b.stop(7, "GNOPE"), false);
  assert.equal(b.stop(7, HOLDER), true);
  b.forget(7);
  assert.deepEqual(new Store(file).addresses(7), []);
});

test("formats amounts, times and cursors", () => {
  assert.equal(formatAmount(4_000_000_000n, "en"), "400");
  assert.equal(formatAmount(12_345_678_900_000n, "en"), "1,234,567.89");
  assert.equal(formatAmount(12_345_678_900_000n, "es"), "1.234.567,89");
  assert.equal(formatWhen(1_791_029_452, 1_791_029_452 - 180, "en"), "12:10 UTC (in 3 min)");
  assert.equal(formatWhen(1_791_029_452, 0, "es"), "3 oct, 12:10 UTC");
  assert.equal(cursorLedger(fixture.events[0].id), fixture.events[0].ledger);
});

test("reads the live contract: case 20 was taken back", async () => {
  const habeas = new Habeas(process.env.RPC_URL ?? "https://soroban-testnet.stellar.org", deployment.habeas);
  const c = await habeas.getCase(20);
  assert.equal(c.holder, HOLDER);
  assert.equal(c.status, "TakenBack");
  assert.equal(c.taken, 4_000_000_000n);
  assert.ok((await habeas.casesFor(HOLDER)).includes(20));
  assert.deepEqual(await habeas.config(), roles);
});
