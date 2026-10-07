import type { z } from "zod";
import type { ToolResponse } from "../lib/errors.ts";

/**
 * "both" tools are read-only and safe on the hosted server. "local" tools run
 * programs on this machine, read local files or spend from AGENT_SECRET, so
 * they are only offered over stdio.
 */
export type ToolDef = {
  name: string;
  title: string;
  description: string;
  shape: z.ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<ToolResponse>;
  where: "both" | "local";
  readOnly: boolean;
  destructive?: boolean;
};
