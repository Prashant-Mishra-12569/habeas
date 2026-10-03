import { jsonRoute, str } from "@/lib/api";
import { trustlineTx } from "@/lib/demo";

export const POST = jsonRoute(async (b) => ({ xdr: await trustlineTx(str(b.address, "address")) }));
