import { defineConfig } from "tsup";

export default defineConfig({
  banner: { js: "#!/usr/bin/env node" },
  entry: ["src/index.ts"],
  clean: true,
  format: ["esm"],
  noExternal: [/.*/],
  platform: "node",
  target: "node24",
});
