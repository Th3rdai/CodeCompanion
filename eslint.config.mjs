import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

/** Paths excluded from lint (align with .gitignore + generated assets). */
const ignorePatterns = [
  "**/node_modules/**",
  "**/dist/**",
  "**/release/**",
  "**/coverage/**",
  "**/.git/**",
  "**/test-results/**",
  "**/playwright-report/**",
  "**/.gitnexus/**",
  "**/ARCHIVES/**",
  "**/*.min.js",
  "**/patches/**",
  "**/github-repos/**",
];

export default [
  { ignores: ignorePatterns },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs["recommended-latest"],
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "react/prop-types": "off",
      /** Apostrophes/quotes in user-facing copy are intentional; escaping hurts readability. */
      "react/no-unescaped-entities": "off",
      /** Regex / ANSI escapes are intentional in parsers and CLI output. */
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      /** Downgrade until legacy patterns are refactored (conditional hooks in large components). */
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
