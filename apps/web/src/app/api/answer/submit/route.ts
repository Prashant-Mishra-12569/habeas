import { jsonRoute, str } from "@/lib/api";
import { clientIp, limit } from "@/lib/rate-limit";
import { submitAnswer } from "@/lib/relay";

export const maxDuration = 60;
export const POST = jsonRoute(async (b, req) => {
  limit(`answer:${clientIp(req)}`, 30, 3600, "Too many answers from your connection.");
  return submitAnswer({
    caseId: Number(b.caseId),
    statement: typeof b.statement === "string" ? b.statement : "",
    fileHash: typeof b.fileHash === "string" && b.fileHash ? b.fileHash : null,
    entry: str(b.entry, "auth entry"),
    signature: str(b.signature, "signature"),
    validUntil: Number(b.validUntil),
    signerAddress: typeof b.signerAddress === "string" && b.signerAddress ? b.signerAddress : undefined,
  });
});
