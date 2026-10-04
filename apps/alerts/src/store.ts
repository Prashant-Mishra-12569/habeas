// Who watches which address, and where the event reader left off. A small
// JSON file: the bot has few users, and a restart must not resend old alerts.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Lang } from "./messages.ts";

export const MAX_ADDRESSES = 5;

type Chat = { lang: Lang; addresses: string[] };
type State = { cursor?: string; chats: Record<string, Chat> };

export class Store {
  private state: State;
  private readonly file: string | null;

  /** With no file, nothing is kept between runs (used by --dry-run). */
  constructor(file: string | null) {
    this.file = file;
    try {
      this.state = file ? (JSON.parse(readFileSync(file, "utf8")) as State) : { chats: {} };
    } catch {
      this.state = { chats: {} };
    }
  }

  private save() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    renameSync(tmp, this.file);
  }

  get cursor() {
    return this.state.cursor;
  }

  setCursor(cursor: string) {
    if (cursor === this.state.cursor) return;
    this.state.cursor = cursor;
    this.save();
  }

  addresses(chatId: number): string[] {
    return this.state.chats[chatId]?.addresses ?? [];
  }

  /** "added", "already" or "full". */
  watch(chatId: number, address: string, lang: Lang): "added" | "already" | "full" {
    const chat = (this.state.chats[chatId] ??= { lang, addresses: [] });
    chat.lang = lang;
    if (chat.addresses.includes(address)) return "already";
    if (chat.addresses.length >= MAX_ADDRESSES) return "full";
    chat.addresses.push(address);
    this.save();
    return "added";
  }

  /** Stops one address, or all when none is given. False if nothing was watched. */
  stop(chatId: number, address?: string): boolean {
    const chat = this.state.chats[chatId];
    if (!chat) return false;
    if (!address) {
      delete this.state.chats[chatId];
    } else {
      if (!chat.addresses.includes(address)) return false;
      chat.addresses = chat.addresses.filter((a) => a !== address);
      if (chat.addresses.length === 0) delete this.state.chats[chatId];
    }
    this.save();
    return true;
  }

  /** Chats watching an address, with their language. */
  watchers(address: string): { chatId: number; lang: Lang }[] {
    return Object.entries(this.state.chats)
      .filter(([, c]) => c.addresses.includes(address))
      .map(([id, c]) => ({ chatId: Number(id), lang: c.lang }));
  }

  /** For a chat that blocked the bot or was deleted. */
  forget(chatId: number) {
    if (this.state.chats[chatId]) {
      delete this.state.chats[chatId];
      this.save();
    }
  }
}
