import { jsonRoute, str } from "@/lib/api";
import { submitTrustline } from "@/lib/demo";

export const POST = jsonRoute(async (b) => submitTrustline(str(b.signedXdr, "signed transaction")));
