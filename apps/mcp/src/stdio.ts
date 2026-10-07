// Local server: speaks MCP over stdin/stdout. Point your AI client at
// `node src/stdio.ts` (see README). Logs go to stderr, never stdout.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./lib/logger.ts";
import { createMcpServer, toolsFor } from "./server.ts";

const server = createMcpServer("local");
await server.connect(new StdioServerTransport());
logger.info({ tools: toolsFor("local").map((t) => t.name) }, "habeas-mcp running on stdio");
