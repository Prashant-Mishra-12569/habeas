import { jsonRoute, str } from "@/lib/api";
import { fundAccount } from "@/lib/demo";
import { clientIp, limit } from "@/lib/rate-limit";

export const maxDuration = 60;
export const POST = jsonRoute(async (b, req) => {
  limit(`fund:${clientIp(req)}`, 10, 3600, "Too many test wallets from your connection.");
  return fundAccount(str(b.address, "address"));
});
