import { getAnalytics, logEvent, logScreenView, setAnalyticsCollectionEnabled } from "@react-native-firebase/analytics";
import type { AppConfig } from "@/core/config/env";
import { reportError } from "@/core/monitoring/monitoring";

/**
 * Usage analytics (Firebase Analytics, Google). Crashes stay with Sentry. Collection starts only in
 * production builds, so development and QA never count as real use; firebase.json keeps it off until
 * then and turns off the advertising ID, Android ID and ad storage. Nothing personal is sent: no uid,
 * no email, and screen names are route patterns ("p/[id]"), never ids or text someone wrote.
 */
let enabled = false;

export function analyticsEnabled(config: Pick<AppConfig, "appEnv">): boolean {
  return config.appEnv === "production";
}

export function initAnalytics(config: Pick<AppConfig, "appEnv">): void {
  enabled = analyticsEnabled(config);
  // Without the Firebase files the native app isn't configured and every call throws: stay off.
  safely(() => setAnalyticsCollectionEnabled(getAnalytics(), enabled));
}

/** The route pattern for analytics: groups like "(app)" dropped, dynamic segments kept as "[id]". */
export function screenName(segments: readonly string[]): string {
  const name = segments.filter((s) => !(s.startsWith("(") && s.endsWith(")"))).join("/");
  return name || "index";
}

export function trackScreen(segments: readonly string[]): void {
  if (!enabled) return;
  const name = screenName(segments);
  safely(() => logScreenView(getAnalytics(), { screen_name: name, screen_class: name }));
}

/** A named product event. Parameters must never hold personal data or anything a neighbour wrote. */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (!enabled) return;
  safely(async () => logEvent(getAnalytics(), name, params));
}

function safely(call: () => Promise<void>): void {
  try {
    void call().catch((error: unknown) => reportError(error, "analytics"));
  } catch (error) {
    reportError(error, "analytics");
  }
}
