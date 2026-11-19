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
  {
    // Maps built from "maplibre-gl" directly get no Web Worker and draw blank at street level (src/lib/maplibre.ts).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/maplibre.ts", "src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "maplibre-gl", message: 'Import from "@/lib/maplibre", which sets up the map\'s Web Worker.' }] }],
    },
  },
];
