/** The Habeas alerts bot (apps/alerts), running 24/7 on Railway. */
export const TELEGRAM_BOT = "habeas_alerts_bot";

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

/**
 * Link to the bot. With an address it opens the bot with `/start <address>`,
 * which watches that address straight away (Telegram start payloads allow up
 * to 64 letters and digits, and a Stellar address is 56).
 */
export function telegramLink(address?: string): string {
  const base = `https://t.me/${TELEGRAM_BOT}`;
  return address && STELLAR_ADDRESS.test(address) ? `${base}?start=${address}` : base;
}
