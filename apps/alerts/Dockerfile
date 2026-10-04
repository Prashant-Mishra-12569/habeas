# Habeas Telegram alerts. Built from the repository root (see railway.json):
# the bot reads deployments/testnet.json for the contract address.
FROM node:24-slim
WORKDIR /app
COPY deployments/testnet.json deployments/testnet.json
COPY apps/alerts/package.json apps/alerts/package-lock.json apps/alerts/
RUN cd apps/alerts && npm ci --omit=dev && npm cache clean --force
COPY apps/alerts/src apps/alerts/src
WORKDIR /app/apps/alerts
# Mount a volume here so the watch list and the event cursor survive redeploys.
ENV DATA_DIR=/data
CMD ["node", "src/main.ts"]
