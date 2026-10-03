import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    // These tests read real Stellar mainnet and testnet. No mocks.
    testTimeout: 120_000,
    // Public Horizon and RPC servers occasionally drop a request; one retry
    // keeps a passing check from failing on a network hiccup.
    retry: 1,
    include: ["src/**/*.test.ts"],
  },
});
