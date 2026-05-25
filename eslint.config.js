import { includeIgnoreFile } from "@eslint/config-helpers";
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import eslintPluginAstro from "eslint-plugin-astro";
import path from "node:path";
import tseslint from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const javascriptConfig = {
  files: ["**/*.{js,mjs,cjs}"],
  extends: [eslint.configs.recommended],
  rules: {
    "no-console": "warn",
  },
};

const typescriptConfig = {
  files: ["**/*.{ts,tsx}"],
  extends: [eslint.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "no-console": "warn",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],

    "max-lines": ["error", { max: 220, skipBlankLines: true, skipComments: true }],
    "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],
    complexity: ["warn", 10],
    "max-depth": ["warn", 3],
    "max-params": ["warn", 4],
  },
};

const astroConfig = {
  files: ["**/*.astro"],
  rules: {
    "astro/no-set-html-directive": "error",
    "astro/no-unused-css-selector": "warn",
    "astro/prefer-class-list-directive": "warn",
  },
};

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  javascriptConfig,
  typescriptConfig,
  eslintPluginAstro.configs["flat/recommended"],
  ...eslintPluginAstro.configs["flat/jsx-a11y-recommended"],
  astroConfig,
  eslintPluginPrettier,
);
