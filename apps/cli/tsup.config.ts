import { defineConfig } from "tsup";

export default defineConfig({
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  entry: ["src/index.ts"],
  clean: true,
  format: ["esm"],
  noExternal: [/.*/],
  platform: "node",
  target: "node24",
});
