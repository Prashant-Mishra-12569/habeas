import { jsonRoute } from "@/lib/api";
import { buildCall } from "@/lib/wallet-tx";

export const POST = jsonRoute(async (b) => buildCall(b));
