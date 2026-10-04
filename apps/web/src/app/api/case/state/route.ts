import { jsonRoute } from "@/lib/api";
import { getCase } from "@/lib/habeas";
import { ReadError } from "@/lib/network";
import { caseTimelineWithTx } from "@/lib/timeline";

/** A case and its timeline, for pages that refresh after an action. */
export const POST = jsonRoute(async (b) => {
  const id = Number(b.caseId);
  if (!Number.isInteger(id) || id < 1) throw new ReadError("That isn't a case number.");
  const c = await getCase(id);
  const timeline = await caseTimelineWithTx(c).catch(() => null);
  return { case: c, timeline, now: Math.floor(Date.now() / 1000) };
});
