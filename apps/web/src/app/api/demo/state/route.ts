import { jsonRoute, str } from "@/lib/api";
import { accountState } from "@/lib/demo";
import { activeCaseFor, getCase } from "@/lib/habeas";

export const POST = jsonRoute(async (b) => {
  const address = str(b.address, "address");
  const [state, activeCase] = await Promise.all([accountState(address), activeCaseFor(address)]);
  const caseStatus = activeCase ? (await getCase(activeCase)).status : null;
  return { ...state, activeCase, caseStatus };
});
