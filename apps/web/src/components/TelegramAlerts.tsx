import { telegramLink } from "@/lib/telegram";

/** Paper-plane mark drawn in our pen colour (not Telegram's logo). */
function Plane({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      <path d="M21.5 3.5 2.8 10.7c-.7.3-.7 1.3.1 1.5l4.7 1.5 1.8 5.6c.2.7 1.1.9 1.6.3l2.6-2.9 4.6 3.4c.6.4 1.4.1 1.6-.6l3-14.6c.2-.9-.6-1.6-1.3-1.4Z" />
      <path d="m7.6 13.7 9.9-6.6-7.4 7.9" />
    </svg>
  );
}

type Props = {
  title: string;
  body: string;
  button: string;
  address?: string;
  className?: string;
};

/** A small card that opens the Habeas alerts bot, watching `address` if given. */
export function TelegramAlerts({ title, body, button, address, className = "" }: Props) {
  return (
    <section aria-label={title} className={`rounded-[2px] border border-rule bg-sheet p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <Plane className="mt-0.5 h-6 w-6 shrink-0 text-pen" />
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-[52ch] text-sm text-muted">{body}</p>
          <a
            href={telegramLink(address)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border-2 border-pen px-5 text-base font-semibold text-pen transition-colors duration-200 hover:bg-[color-mix(in_oklab,var(--pen)_8%,transparent)]"
          >
            {button}
          </a>
        </div>
      </div>
    </section>
  );
}
