import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsxInject: "import React from 'react'",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.vitest.test.{js,mjs,jsx,ts,tsx}"],
    setupFiles: ["./tests/setup-vitest.js"],
    clearMocks: true,
  },
});
