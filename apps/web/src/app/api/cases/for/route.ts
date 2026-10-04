import { jsonRoute, str } from "@/lib/api";
import { casesFor } from "@/lib/wallet-tx";

export const POST = jsonRoute(async (b) => ({ cases: await casesFor(str(b.address, "address")) }));
