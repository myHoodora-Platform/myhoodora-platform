import * as Sentry from "@sentry/react-native";
import * as Application from "expo-application";
import type { AppConfig } from "@/core/config/env";
import { scrubBreadcrumb, scrubEvent } from "./scrub";

/**
 * Crash and error reporting (Sentry). On in preview and production builds that have a DSN; off in
 * development, where problems go to the console instead. Every event and breadcrumb passes through
 * the scrubber (./scrub.ts) before it leaves the phone.
 */
let enabled = false;

export function monitoringEnabled(config: Pick<AppConfig, "appEnv" | "sentryDsn">): boolean {
  return !!config.sentryDsn && config.appEnv !== "development";
}

export function initMonitoring(config: Pick<AppConfig, "appEnv" | "sentryDsn">): void {
  enabled = monitoringEnabled(config);
  if (!enabled) return;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.appEnv,
    // No IP address, device name or other identifying defaults; the uid is set explicitly.
    sendDefaultPii: false,
    // Screens show neighbours' names, posts and messages: never photograph them.
    attachScreenshot: false,
    attachViewHierarchy: false,
    // Failed HTTP requests are already reported, where they matter, by the code that made them.
    enableCaptureFailedRequests: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  });
  // Sentry's release already carries version and build; as tags they can be searched and filtered.
  Sentry.setTags({
    app_version: Application.nativeApplicationVersion ?? "unknown",
    build_number: Application.nativeBuildVersion ?? "unknown",
  });
}

/** True once initMonitoring has started Sentry (preview and production with a DSN). */
export function monitoringActive(): boolean {
  return enabled;
}

/** Who is signed in, as their Firebase uid only (never email or name). Null on sign-out. */
export function setMonitoringUser(uid: string | null): void {
  if (enabled) Sentry.setUser(uid ? { id: uid } : null);
}

/**
 * Something went wrong that the person may not see but the team should: logged in development,
 * reported in preview and production. `where` names the feature, for grouping and search.
 */
export function reportError(error: unknown, where: string): void {
  if (__DEV__) console.warn(`[${where}]`, error instanceof Error ? error.message : error);
  if (enabled) Sentry.captureException(error, { tags: { where } });
}

/** What answered with a web page instead of the API (see reportEdgePage). Headers are null when absent. */
export type EdgePage = { status: number; host: string; route: string; server: string | null; mitigated: string | null; ray: string | null };

/** At most one edge-page report this often, so an outage doesn't use up the month's Sentry quota. */
export const EDGE_PAGE_REPORT_EVERY_MS = 10 * 60_000;
let lastEdgePageReport = -Infinity;

/**
 * A web page came back where the API's JSON should be: Cloudflare's "Just a moment…" check, or Render
 * while it restarts. The person is told we couldn't reach myHoodora; the team needs to know how often,
 * on which route, and what sent it (`cf-mitigated: challenge` means Cloudflare's bot check).
 */
export function reportEdgePage(page: EdgePage, now = Date.now()): void {
  if (__DEV__) console.warn("[api-edge-page]", page.status, page.host, page.route);
  if (!enabled || now - lastEdgePageReport < EDGE_PAGE_REPORT_EVERY_MS) return;
  lastEdgePageReport = now;
  Sentry.captureMessage(`A web page instead of the API (${page.status})`, {
    level: "warning",
    tags: { where: "api-edge-page", status: String(page.status), host: page.host, route: page.route, server: page.server ?? "none", cf_mitigated: page.mitigated ?? "none" },
    // The ray id finds the request in Cloudflare's logs.
    extra: { cf_ray: page.ray },
  });
}

/**
 * Test reports for checking crash reporting in a preview build (Settings → Diagnostics). Each one
 * carries made-up personal details, so Sentry should show them as [Filtered], never in the clear.
 */
export const TEST_PII = { email: "qa.tester@example.com", phone: "08012345678", token: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJxYSJ9.c2lnbmF0dXJl" };

/** A handled error, with a breadcrumb and extra data that the scrubber must clean. */
export function sendTestError(): void {
  Sentry.addBreadcrumb({ category: "qa", message: `Signed in as ${TEST_PII.email}, ${TEST_PII.phone}` });
  Sentry.captureException(new Error(`WP-1 test error for ${TEST_PII.email} (${TEST_PII.token})`), {
    tags: { where: "qa-diagnostics" },
    extra: { email: TEST_PII.email, authorization: TEST_PII.token, note: `call ${TEST_PII.phone}` },
  });
}

/** An unhandled promise rejection: nothing catches it, Sentry's global handler should. */
export function sendTestRejection(): void {
  void Promise.reject(new Error(`WP-1 test rejection for ${TEST_PII.email}`));
}

/** Kills the app from native code. The report is sent the next time the app starts. */
export function crashNatively(): void {
  Sentry.nativeCrash();
}
