import { defineConfig } from "tsup";

export default defineConfig({
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  entry: ["src/index.ts", "src/migrate.ts"],
  clean: true,
  dts: false,
  format: ["esm"],
  minify: false,
  noExternal: [/.*/],
  platform: "node",
  sourcemap: true,
  target: "node24",
});
