import { jsonRoute, str } from "@/lib/api";
import { startDemoCase } from "@/lib/demo";

export const maxDuration = 60;
export const POST = jsonRoute(async (b) => startDemoCase(str(b.address, "address")));
