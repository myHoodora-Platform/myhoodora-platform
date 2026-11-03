import { defineConfig, devices } from "@playwright/test";

/**
 * Search-engine checks (e2e/seo.spec.ts) against a *production* build:
 * robots.txt, the sitemap and the noindex headers are all fixed at build time,
 * so the dev server (a non-production site, kept out of search) can't show them.
 *
 * - Default: builds with SITE_ENV=production and a placeholder https origin,
 *   then serves it on port 3100. Sitemap URLs are fetched from that server.
 * - E2E_SEO_BASE_URL=https://www.myhoodora.com: checks a deployed site as is.
 */
const live = process.env.E2E_SEO_BASE_URL;
const port = 3100;
// What the sitemap and canonical URLs must say: the deployed origin, or what the local build is told it is.
process.env.E2E_SEO_ORIGIN ??= live ? new URL(live).origin : "https://www.myhoodora.com";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "seo.spec.ts",
  timeout: 60_000,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report-seo" }]] : "list",
  use: { baseURL: live ?? `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: live
    ? undefined
    : {
        command: `pnpm build && pnpm start --port ${port}`,
        url: `http://localhost:${port}/robots.txt`,
        reuseExistingServer: false,
        timeout: 600_000,
        env: { SITE_ENV: "production", NEXT_PUBLIC_APP_URL: process.env.E2E_SEO_ORIGIN },
      },
});
