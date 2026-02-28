import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    setupFiles: ["./tests/setup.js"],
    clearMocks: true,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
