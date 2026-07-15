import { defineConfig } from "tsup";

export default defineConfig({
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
