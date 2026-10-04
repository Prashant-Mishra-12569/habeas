// Public sources for the Sep 19, 2026 USBDC story on the home page. Each was
// checked to resolve, with matching titles and operation types, on Oct 4, 2026.
import { USBDC_EVENT } from "./usbdc";

export const USBDC_SOURCES = {
  bank: "https://www.usbank.com/about-us-bank/news-and-stories/article-library/us-bank-launches-usbdc-stablecoin.html",
  tellus: "https://blog.telluscoop.com/p/usbdc-un-banco-puso-su-dinero-a-prueba-en-la-blockchain-de-stellar",
  payment: `https://horizon.stellar.org/operations/${USBDC_EVENT.paymentOp}`,
  clawback: `https://horizon.stellar.org/operations/${USBDC_EVENT.clawbackOp}`,
} as const;
