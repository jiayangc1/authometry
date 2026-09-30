import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next.js preserves JSX for its own compiler; tests that render components need it compiled.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@/": fileURLToPath(new URL("./apps/web/src/", import.meta.url)) } },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
    },
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
    setupFiles: ["./packages/test-support/src/setup.ts"],
  },
});
