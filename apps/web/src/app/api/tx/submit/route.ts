import { jsonRoute } from "@/lib/api";
import { submitCall } from "@/lib/wallet-tx";

export const maxDuration = 60;
export const POST = jsonRoute(async (b) => submitCall(b.signedXdr));
