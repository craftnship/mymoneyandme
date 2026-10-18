import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Database-backed tests need TEST_DATABASE_URL (see docs/deployment.md); they skip themselves otherwise.
    env: { DATA_ENCRYPTION_KEY: "0".repeat(64), DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
});
