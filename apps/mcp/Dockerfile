# Habeas MCP server (hosted, read-only). Built from the repository root: it
# reads deployments/testnet.json for the contract address and docs/SPEC-cases.md
# for the rules resource. Run `npm install` in apps/mcp once and commit
# package-lock.json before building.
FROM node:24-slim
WORKDIR /app
COPY deployments/testnet.json deployments/testnet.json
COPY docs/SPEC-cases.md docs/SPEC-cases.md
COPY apps/mcp/package.json apps/mcp/package-lock.json apps/mcp/
RUN cd apps/mcp && npm ci --omit=dev && npm cache clean --force
COPY apps/mcp/src apps/mcp/src
WORKDIR /app/apps/mcp
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["node", "src/http.ts"]
