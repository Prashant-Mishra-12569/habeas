import { jsonRoute, str } from "@/lib/api";
import { startDemoCase } from "@/lib/demo";
import { clientIp, limit } from "@/lib/rate-limit";

export const maxDuration = 60;
export const POST = jsonRoute(async (b, req) => {
  const address = str(b.address, "address");
  limit(`start:${clientIp(req)}`, 12, 3600, "Too many demo cases from your connection.");
  limit(`start:${address}`, 6, 3600, "Too many demo cases for this account.");
  return startDemoCase(address);
});
