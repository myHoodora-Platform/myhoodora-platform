import { nextJsConfig } from "@myhoodora/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    // Node scripts (e.g. the image-fetch pipeline), the Next config and what it imports run outside the browser.
    files: ["scripts/**/*.mjs", "next.config.js", "src/lib/site-env.js", "playwright.config.ts", "playwright.seo.config.ts"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        process: "readonly",
      },
    },
  },
];
