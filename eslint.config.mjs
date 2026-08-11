// @ts-check
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import pluginPromise from "eslint-plugin-promise";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "eslint.config.mjs",
      "node_modules",
      "dist",
      "build",
      "coverage",
      "logs",
      ".husky",
      "*.json",
      ".worktrees"
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2021
      },
      sourceType: "commonjs",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      promise: pluginPromise,
      "unused-imports": pluginUnusedImports
    },
    rules: {
      // ---- Prettier integration ----
      "prettier/prettier": ["error", { endOfLine: "auto" }],

      // ---- TypeScript ----
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          args: "after-used",
          caughtErrors: "none"
        }
      ],
      // Deliberately OFF here (it stays ON for the client). tsconfig sets
      // `emitDecoratorMetadata: true` and Nest resolves constructor injection
      // from the emitted `design:paramtypes`. Rewriting an injected provider to
      // `import type` erases the import at runtime, so `--fix` would silently
      // break DI.
      "@typescript-eslint/consistent-type-imports": "off",
      // Kept from the typed base (recommendedTypeChecked), left as warnings.
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",

      // ---- General JavaScript ----
      "no-undef": "off",
      "no-unused-vars": "off",
      "prefer-const": "warn",
      "no-var": "error",
      "no-console": "warn",
      "spaced-comment": "error",
      "arrow-body-style": ["error", "as-needed"],

      // ---- Imports ----
      "unused-imports/no-unused-imports": "error",

      // ---- Promise ----
      "promise/always-return": "warn",
      "promise/no-return-wrap": "warn",
      "promise/param-names": "warn",
      "promise/catch-or-return": "warn"
    }
  },
  {
    // Standalone CLI script: logging to stdout is its output channel, and its
    // top-level `main().then(...).catch(...)` teardown chain has nothing to
    // return.
    files: [
      "prisma/seed.ts",
      "scripts/recompute-keyword-scores.ts",
      "scripts/seed-mock.ts"
    ],
    rules: {
      "no-console": "off",
      "promise/always-return": "off"
    }
  }
);
