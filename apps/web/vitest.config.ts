import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Unit tests exercise the in-browser mock store, whatever ENDPOINTS says is live.
    env: { NEXT_PUBLIC_USE_MOCKS: "true" },
  },
});
