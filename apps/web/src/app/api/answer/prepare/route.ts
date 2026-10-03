import { jsonRoute } from "@/lib/api";
import { prepareAnswer } from "@/lib/relay";

export const POST = jsonRoute(async (b) =>
  prepareAnswer({
    caseId: Number(b.caseId),
    statement: typeof b.statement === "string" ? b.statement : "",
    fileHash: typeof b.fileHash === "string" && b.fileHash ? b.fileHash : null,
  }),
);
