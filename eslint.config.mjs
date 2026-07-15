import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "playwright-report/**",
      "**/*.config.{js,mjs,ts}",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["**/*.config.{js,mjs,ts}", "**/scripts/**/*.{ts,mjs}"],
    rules: { "@typescript-eslint/no-unsafe-assignment": "off" },
  },
);
