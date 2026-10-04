import { jsonRoute } from "@/lib/api";
import { clientIp, limit } from "@/lib/rate-limit";
import { settleCase } from "@/lib/relay";

export const maxDuration = 60;
export const POST = jsonRoute(async (b, req) => {
  limit(`settle:${clientIp(req)}`, 30, 3600, "Too many requests from your connection.");
  return settleCase(Number(b.caseId));
});
