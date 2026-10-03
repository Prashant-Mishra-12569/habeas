import { jsonRoute, str } from "@/lib/api";
import { submitAnswer } from "@/lib/relay";

export const maxDuration = 60;
export const POST = jsonRoute(async (b) =>
  submitAnswer({
    caseId: Number(b.caseId),
    statement: typeof b.statement === "string" ? b.statement : "",
    fileHash: typeof b.fileHash === "string" && b.fileHash ? b.fileHash : null,
    entry: str(b.entry, "auth entry"),
    signature: str(b.signature, "signature"),
    validUntil: Number(b.validUntil),
    signerAddress: typeof b.signerAddress === "string" && b.signerAddress ? b.signerAddress : undefined,
  }),
);
