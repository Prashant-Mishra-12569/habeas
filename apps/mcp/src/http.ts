// Hosted server: MCP over Streamable HTTP at POST /mcp, read-only tools only.
// Stateless: each request gets its own server, so it scales and restarts freely.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.ts";
import { logger } from "./lib/logger.ts";
import { deployment } from "./habeas/deployment.ts";
import { createMcpServer, toolsFor } from "./server.ts";

const MAX_BODY = 1_000_000;
const hits = new Map<string, { n: number; resetAt: number }>();

/** Best-effort per-address limit. A restart clears it; put a real limiter in front for heavy use. */
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.resetAt < now) {
    hits.set(ip, { n: 1, resetAt: now + 60_000 });
    return false;
  }
  h.n += 1;
  return h.n > config.RATE_LIMIT_PER_MIN;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
}, 60_000).unref();

const clientIp = (req: IncomingMessage) => String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0]!.trim();

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}
const rpcError = (res: ServerResponse, status: number, message: string) => send(res, status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null });

async function readBody(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new Error("too large");
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const http = createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type, authorization, mcp-protocol-version, mcp-session-id");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  const path = (req.url ?? "/").split("?")[0];

  if (req.method === "OPTIONS") return void res.writeHead(204).end();
  if (path === "/healthz") return send(res, 200, { ok: true, tools: toolsFor("hosted").length });
  if (path !== "/mcp") return send(res, 404, { error: "The MCP endpoint is POST /mcp." });
  // Stateless server: no standalone SSE stream and no sessions to close.
  if (req.method !== "POST") return rpcError(res, 405, "Method not allowed. Use POST.");

  if (config.MCP_AUTH_TOKEN && req.headers.authorization !== `Bearer ${config.MCP_AUTH_TOKEN}`) return rpcError(res, 401, "Unauthorized.");
  if (limited(clientIp(req))) return rpcError(res, 429, "Too many requests. Try again in a minute.");

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    return rpcError(res, 400, "The request body must be JSON under 1 MB.");
  }

  const server = createMcpServer("hosted");
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    logger.error({ err }, "MCP request failed");
    if (!res.headersSent) rpcError(res, 500, "Internal server error.");
  }
});

// Fail at startup, not on the first request, if the deployment file is missing.
deployment();
http.listen(config.PORT, () => logger.info({ port: config.PORT, tools: toolsFor("hosted").map((t) => t.name) }, "habeas-mcp listening on /mcp"));
