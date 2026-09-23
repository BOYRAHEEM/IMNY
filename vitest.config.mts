import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // PGlite suites each boot a Postgres instance; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
