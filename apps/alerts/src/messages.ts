// Every message the bot sends, in English and Spanish. Same words as the
// website (apps/web/src/i18n/dict.ts): freeze, take back (clawback),
// reviewer, unfreeze, Cleared / Taken back.
import type { CaseEvent } from "./events.ts";
import type { CaseRecord } from "./stellar.ts";

export type Lang = "en" | "es";
/** Who is watching: the holder named in the case, or the contract's reviewer or issuer. */
export type Role = "holder" | "reviewer" | "issuer";

export const langFor = (code?: string): Lang => (code?.toLowerCase().startsWith("es") ? "es" : "en");

const REASON: Record<Lang, Record<string, string>> = {
  en: { Fraud: "Suspected fraud", SanctionsOrder: "Sanctions order", SentByMistake: "Sent by mistake", CourtOrder: "Court order", Other: "Other" },
  es: { Fraud: "Sospecha de fraude", SanctionsOrder: "Orden de sanciones", SentByMistake: "Enviado por error", CourtOrder: "Orden judicial", Other: "Otro" },
};
const STATUS: Record<Lang, Record<string, string>> = {
  en: { Open: "Frozen", Answered: "Answered", Upheld: "Upheld", Rejected: "Rejected", Cleared: "Cleared", TakenBack: "Taken back" },
  es: { Open: "Congelado", Answered: "Respondido", Upheld: "Confirmado", Rejected: "Rechazado", Cleared: "Liberado", TakenBack: "Recuperado" },
};
const ENDED_BY: Record<Lang, Record<string, string>> = {
  en: {
    Withdrawn: "The issuer withdrew the case.",
    NoAnswer: "No answer came before the deadline.",
    ReviewerUpheld: "The reviewer sided with the issuer.",
    ReviewerRejected: "The reviewer sided with the holder.",
    ReviewerSilent: "The reviewer didn't decide in time, so the holder wins by default.",
    Emergency: "Issuer and reviewer acted together in an emergency.",
  },
  es: {
    Withdrawn: "El emisor retiró el caso.",
    NoAnswer: "No hubo respuesta antes del plazo.",
    ReviewerUpheld: "El revisor le dio la razón al emisor.",
    ReviewerRejected: "El revisor le dio la razón al titular.",
    ReviewerSilent: "El revisor no decidió a tiempo, así que el titular gana por defecto.",
    Emergency: "El emisor y el revisor actuaron juntos en una emergencia.",
  },
};

/** The same endings, said to the holder. */
const ENDED_BY_YOU: Record<Lang, Record<string, string>> = {
  en: { ...ENDED_BY.en, ReviewerRejected: "The reviewer sided with you.", ReviewerSilent: "The reviewer didn't decide in time, so you win by default." },
  es: { ...ENDED_BY.es, ReviewerRejected: "El revisor te dio la razón.", ReviewerSilent: "El revisor no decidió a tiempo, así que ganas por defecto." },
};

/** 4000000000n -> "400"; 125000000n -> "12.5" ("12,5" in Spanish). Seven decimals, like every Stellar asset. */
export function formatAmount(stroops: bigint, lang: Lang): string {
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === "es" ? "." : ",");
  return frac ? `${grouped}${lang === "es" ? "," : "."}${frac}` : grouped;
}

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
};
const pad = (n: number) => String(n).padStart(2, "0");

const utcTime = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;

/** "Oct 9, 14:02 UTC" / "9 oct, 14:02 UTC". */
export function formatUtc(unixSecs: number, lang: Lang): string {
  const d = new Date(unixSecs * 1000);
  const m = MONTHS[lang][d.getUTCMonth()];
  return lang === "es" ? `${d.getUTCDate()} ${m}, ${utcTime(d)}` : `${m} ${d.getUTCDate()}, ${utcTime(d)}`;
}

/** "14:02 UTC (in 3 min)" when it's under two hours away, else the date and time. */
export function formatWhen(unixSecs: number, nowSecs: number, lang: Lang): string {
  const mins = Math.round((unixSecs - nowSecs) / 60);
  if (mins < 0 || mins >= 120) return formatUtc(unixSecs, lang);
  const rel = lang === "es" ? (mins < 1 ? "en menos de 1 min" : `en ${mins} min`) : mins < 1 ? "in under 1 min" : `in ${mins} min`;
  return `${utcTime(new Date(unixSecs * 1000))} (${rel})`;
}

export type Context = { asset: string; site: string; now: number; caseRecord?: CaseRecord };

/** The message for one event, for one kind of watcher. Null when that watcher doesn't need it. */
export function eventMessage(ev: CaseEvent, role: Role, lang: Lang, ctx: Context): string | null {
  const es = lang === "es";
  const n = ev.caseId;
  const link = `${ctx.site}/case/${n}`;
  const amt = (v: bigint) => `${formatAmount(v, lang)} ${ctx.asset}`;
  const when = (t: number) => formatWhen(t, ctx.now, lang);
  const lines = (...l: (string | false | undefined)[]) => [...l.filter(Boolean), link].join("\n");

  switch (ev.kind) {
    case "case_opened": {
      if (role !== "holder") return null;
      const statement = ctx.caseRecord?.statement;
      return es
        ? lines(
            `Tu ${ctx.asset} está congelado.`,
            `El caso #${n} pide recuperar (clawback) ${amt(ev.amount)}. Razón: ${REASON.es[ev.reason] ?? ev.reason}.`,
            statement && `El emisor dice: “${statement}”`,
            `Puedes responder hasta ${when(ev.answerBy)}. Responder es gratis.`,
          )
        : lines(
            `Your ${ctx.asset} is frozen.`,
            `Case #${n} asks to take back (clawback) ${amt(ev.amount)}. Reason: ${REASON.en[ev.reason] ?? ev.reason}.`,
            statement && `The issuer says: “${statement}”`,
            `You can answer until ${when(ev.answerBy)}. Answering is free.`,
          );
    }
    case "case_appealed":
      if (role === "holder")
        return es
          ? lines(`Tu respuesta al caso #${n} quedó registrada.`, `El revisor tiene hasta ${when(ev.reviewBy)} para decidir. Si no decide, ganas por defecto.`)
          : lines(`Your answer to case #${n} is on record.`, `The reviewer has until ${when(ev.reviewBy)} to decide. If they don't, you win by default.`);
      if (role === "reviewer")
        return es
          ? lines(`El caso #${n} necesita tu decisión antes de ${when(ev.reviewBy)}.`, `Si no decides, el titular gana por defecto.`)
          : lines(`Case #${n} needs your decision by ${when(ev.reviewBy)}.`, `If you don't decide, the holder wins by default.`);
      return es
        ? lines(`El titular respondió al caso #${n}. El revisor decide antes de ${when(ev.reviewBy)}.`)
        : lines(`The holder answered case #${n}. The reviewer decides by ${when(ev.reviewBy)}.`);
    case "case_decided":
      if (role === "reviewer") return null;
      if (role === "holder")
        return ev.upheld
          ? es
            ? lines(`El revisor le dio la razón al emisor en el caso #${n}.`, `Cuando alguien cierre el caso, se recuperan los tokens (clawback) y el resto de tu saldo se descongela.`)
            : lines(`The reviewer sided with the issuer in case #${n}.`, `Once anyone settles the case, the tokens are taken back (clawback) and the rest of your balance is unfrozen.`)
          : es
            ? lines(`El revisor te dio la razón en el caso #${n}.`, `Cierra el caso para quedar descongelado. Cualquiera puede hacerlo, gratis.`)
            : lines(`The reviewer sided with you in case #${n}.`, `Settle the case to be unfrozen. Anyone can, for free.`);
      return es
        ? lines(`El revisor ${ev.upheld ? "te dio la razón" : "le dio la razón al titular"} en el caso #${n}.`)
        : lines(`The reviewer sided with ${ev.upheld ? "you" : "the holder"} in case #${n}.`);
    case "case_settled": {
      if (role === "reviewer") return null;
      const outcome = STATUS[lang][ev.outcome] ?? ev.outcome;
      const why = (role === "holder" ? ENDED_BY_YOU : ENDED_BY)[lang][ev.endedBy];
      if (role === "issuer") return lines(es ? `El caso #${n} está cerrado: ${outcome}.` : `Case #${n} is closed: ${outcome}.`, why);
      if (ev.outcome === "TakenBack")
        return es
          ? lines(`El caso #${n} está cerrado: ${outcome}.`, `Se recuperaron ${amt(ev.taken)} (clawback). El resto de tu saldo está descongelado.`, why)
          : lines(`Case #${n} is closed: ${outcome}.`, `${amt(ev.taken)} was taken back (clawback). The rest of your balance is unfrozen.`, why);
      return es
        ? lines(`El caso #${n} está cerrado: ${outcome}.`, `Tus tokens están descongelados.`, why)
        : lines(`Case #${n} is closed: ${outcome}.`, `Your tokens are unfrozen.`, why);
    }
    case "case_withdrawn":
      if (role !== "holder") return null;
      return es ? lines(`El emisor retiró el caso #${n}. Tus tokens están descongelados.`) : lines(`The issuer withdrew case #${n}. Your tokens are unfrozen.`);
    case "emergency_take_back":
      if (role !== "holder") return null;
      return es
        ? lines(`Recuperación de emergencia (clawback) en el caso #${n}: se recuperaron ${amt(ev.taken)} con la aprobación del emisor y del revisor.`, `El resto de tu saldo está descongelado.`)
        : lines(`Emergency take back (clawback) in case #${n}: ${amt(ev.taken)} was taken back with the approval of both the issuer and the reviewer.`, `The rest of your balance is unfrozen.`);
  }
}

/** Replies to commands. */
export const replies = {
  en: {
    help: (asset: string, site: string) =>
      [
        "Habeas messages you when a case is opened, answered, decided or closed for a Stellar address you watch.",
        "",
        "/watch G… start watching an address",
        "/stop G… stop watching it (/stop alone stops all)",
        "/cases the cases for your addresses",
        "",
        `This runs on Stellar testnet, for the ${asset} demo token. Get a test case of your own: ${site}/try`,
      ].join("\n"),
    watchHow: "Send /watch and a Stellar address, like /watch GABC…",
    notAddress: "That isn't a Stellar address. Addresses start with G (or C for a contract) and have 56 characters.",
    tooMany: (max: number) => `You can watch up to ${max} addresses. Stop one first with /stop G…`,
    watching: (a: string) => `Watching ${a}. You'll get a message when a case for this address is opened, answered, decided or closed.`,
    isReviewer: "This is the reviewer's address, so you'll also hear when a case needs a decision.",
    isIssuer: "This is the issuer's address, so you'll also hear when a holder answers and when a case is decided or closed.",
    activeNow: (id: number, status: string) => `It has an active case right now: #${id} (${status}). Send /cases for details.`,
    stopped: (a: string) => `Stopped watching ${a}.`,
    stoppedAll: "Stopped watching all addresses.",
    notWatching: "You weren't watching that address.",
    noneWatched: "You're not watching any address yet. Send /watch G…",
    noCases: (a: string) => `No cases for ${a}.`,
    caseLine: (id: number, status: string, amount: string, opened: string, link: string) => `#${id} ${status}, ${amount}, opened ${opened}\n${link}`,
    readFailed: (msg: string) => `Couldn't read Stellar just now (${msg}). Try again in a minute.`,
    commands: { watch: "Watch a Stellar address", stop: "Stop watching", cases: "Cases for your addresses", start: "What this bot does" },
  },
  es: {
    help: (asset: string, site: string) =>
      [
        "Habeas te avisa cuando se abre, se responde, se decide o se cierra un caso de una dirección de Stellar que sigues.",
        "",
        "/watch G… seguir una dirección",
        "/stop G… dejar de seguirla (/stop solo deja de seguir todas)",
        "/cases los casos de tus direcciones",
        "",
        `Funciona en Stellar testnet, con el token de prueba ${asset}. Crea tu propio caso de prueba: ${site}/try`,
      ].join("\n"),
    watchHow: "Envía /watch y una dirección de Stellar, por ejemplo /watch GABC…",
    notAddress: "Eso no es una dirección de Stellar. Empiezan con G (o C si es un contrato) y tienen 56 caracteres.",
    tooMany: (max: number) => `Puedes seguir hasta ${max} direcciones. Deja de seguir una con /stop G…`,
    watching: (a: string) => `Siguiendo ${a}. Te avisaremos cuando se abra, se responda, se decida o se cierre un caso de esta dirección.`,
    isReviewer: "Es la dirección del revisor, así que también te avisaremos cuando un caso necesite una decisión.",
    isIssuer: "Es la dirección del emisor, así que también te avisaremos cuando un titular responda y cuando un caso se decida o se cierre.",
    activeNow: (id: number, status: string) => `Tiene un caso activo ahora: #${id} (${status}). Envía /cases para ver detalles.`,
    stopped: (a: string) => `Dejaste de seguir ${a}.`,
    stoppedAll: "Dejaste de seguir todas las direcciones.",
    notWatching: "No estabas siguiendo esa dirección.",
    noneWatched: "Aún no sigues ninguna dirección. Envía /watch G…",
    noCases: (a: string) => `No hay casos para ${a}.`,
    caseLine: (id: number, status: string, amount: string, opened: string, link: string) => `#${id} ${status}, ${amount}, abierto el ${opened}\n${link}`,
    readFailed: (msg: string) => `No pudimos leer Stellar ahora (${msg}). Intenta de nuevo en un minuto.`,
    commands: { watch: "Seguir una dirección de Stellar", stop: "Dejar de seguir", cases: "Casos de tus direcciones", start: "Qué hace este bot" },
  },
} satisfies Record<Lang, unknown>;

export { STATUS };
