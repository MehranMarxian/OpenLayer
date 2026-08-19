import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // `tests/e2e` is excluded deliberately: those spawn the bridge process and
    // bind a port. See vitest.e2e.config.ts and `npm run test:e2e`.
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    globals: false
  }
});
