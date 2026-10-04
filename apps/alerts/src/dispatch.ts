// Decides who hears about an event and what they read. A chat that watches
// more than one party of a case gets one message, from the closest seat:
// holder, then reviewer, then issuer.
import type { CaseEvent } from "./events.ts";
import { eventMessage, type Context, type Role } from "./messages.ts";
import type { Store } from "./store.ts";

export type Roles = { issuer: string; reviewer: string };
export type Outgoing = { chatId: number; text: string };

export function messagesFor(ev: CaseEvent, store: Store, roles: Roles, ctx: Context): Outgoing[] {
  const seats: [Role, string][] = [
    ["holder", ev.holder],
    ["reviewer", roles.reviewer],
    ["issuer", roles.issuer],
  ];
  const out: Outgoing[] = [];
  const done = new Set<number>();
  for (const [role, address] of seats) {
    for (const { chatId, lang } of store.watchers(address)) {
      if (done.has(chatId)) continue;
      const text = eventMessage(ev, role, lang, ctx);
      if (!text) continue;
      done.add(chatId);
      out.push({ chatId, text });
    }
  }
  return out;
}
