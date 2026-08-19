import { defineConfig } from "vitest/config";

/**
 * The end-to-end suite, kept out of `npm test` on purpose.
 *
 * `vitest.config.ts` includes `tests/**` and would otherwise sweep these in.
 * They spawn the bridge process and bind a real port, which is exactly what
 * makes them worth having and exactly what should not be inside a 750-test
 * unit suite that runs in three seconds with no I/O.
 *
 * Run with `npm run test:e2e`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    globals: false,
    // One bridge process, one port. Parallel files would fight over both.
    fileParallelism: false,
    testTimeout: 30_000
  }
});
