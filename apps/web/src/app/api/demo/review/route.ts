import { jsonRoute } from "@/lib/api";
import { reviewDemoCase } from "@/lib/demo";
import { clientIp, limit } from "@/lib/rate-limit";

export const maxDuration = 60;
export const POST = jsonRoute(async (b, req) => {
  limit(`review:${clientIp(req)}`, 20, 3600, "Too many demo decisions from your connection.");
  return reviewDemoCase(Number(b.caseId));
});
