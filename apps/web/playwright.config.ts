import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for the flows unit tests can't see: redirects, cookies,
 * headers, forms and the signed-in session. See docs/testing.md.
 *
 * - `e2e/public.spec.ts` needs only the web app (no API, no account).
 * - `e2e/auth.spec.ts` signs in for real, so it needs the API running and a
 *   test account in E2E_EMAIL / E2E_PASSWORD. Locally these default to the QA
 *   moderator in apps/api/.env; where neither is set, those tests are skipped.
 */
/** KEY=value lines of an env file, or nothing if it isn't there (CI has neither file). */
function envFile(relativePath: string): Record<string, string> {
  try {
    const text = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
    return Object.fromEntries(
      text
        .split("\n")
        .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
        .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
    );
  } catch {
    return {};
  }
}
// The tests skip the Google steps when the app isn't configured for Google, so they need to see the same config Next does.
const web = envFile("./.env.local");
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= web.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??= web.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const api = envFile("../api/.env");
process.env.E2E_EMAIL ??= api.QA_MODERATOR_EMAIL ?? "";
process.env.E2E_PASSWORD ??= api.QA_MODERATOR_PASSWORD ?? "";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One real account is shared by the signed-in tests: run them in order, never in parallel.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Starts the web app unless one is already running (your `pnpm dev`).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm dev", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
