import AsyncStorage from "@react-native-async-storage/async-storage";
import { currentLegalVersion } from "@myhoodora/api-contract/legal";
import { getAnalytics, logEvent, logScreenView, resetAnalyticsData, setAnalyticsCollectionEnabled } from "@react-native-firebase/analytics";
import { useSyncExternalStore } from "react";
import type { AppConfig } from "@/core/config/env";
import { reportError } from "@/core/monitoring/monitoring";

/**
 * Usage analytics (Firebase Analytics, Google). Crashes stay with Sentry. Off until the person says yes
 * (docs/compliance/ndpa.md: non-essential analytics is opt-in), and only in production builds, so
 * development and QA never count as real use; firebase.json keeps it off until then and turns off the
 * advertising ID, Android ID and ad storage. Nothing personal is sent: no uid, no email, and screen
 * names are route patterns ("p/[id]"), never ids or text someone wrote.
 *
 * The choice is per phone (Firebase counts app installs, not accounts) and kept after logout: the
 * feed asks once (features/account/analytics-consent-card), Settings → Privacy changes it.
 */
export type AnalyticsChoice = "granted" | "denied";

/** Proof of the choice (NDPA: records of consent): what, when, and under which privacy policy. */
export interface AnalyticsConsent {
  choice: AnalyticsChoice;
  at: string;
  policy: string;
}

interface ConsentState {
  /** False until storage has been read: nothing is asked or sent before then. */
  loaded: boolean;
  consent: AnalyticsConsent | null;
}

const KEY = "analytics.consent.v1";

let production = false;
let state: ConsentState = { loaded: false, consent: null };
const listeners = new Set<() => void>();

export function analyticsEnabled(config: Pick<AppConfig, "appEnv">, consent: AnalyticsConsent | null): boolean {
  return config.appEnv === "production" && consent?.choice === "granted";
}

const enabled = () => analyticsEnabled({ appEnv: production ? "production" : "development" }, state.consent);

function setState(next: ConsentState) {
  state = next;
  // Without the Firebase files the native app isn't configured and every call throws: stay off.
  safely(() => setAnalyticsCollectionEnabled(getAnalytics(), enabled()));
  listeners.forEach((l) => l());
}

function parse(raw: string | null): AnalyticsConsent | null {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<AnalyticsConsent>) : null;
    return value && (value.choice === "granted" || value.choice === "denied") && value.at && value.policy ? (value as AnalyticsConsent) : null;
  } catch {
    return null;
  }
}

export async function initAnalytics(config: Pick<AppConfig, "appEnv">): Promise<void> {
  production = config.appEnv === "production";
  // If storage can't be read, treat it as "not asked": collection stays off.
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  setState({ loaded: true, consent: parse(raw) });
}

/** Yes or no, from the feed card or Settings. Saying no also clears what Firebase holds on this phone. */
export async function setAnalyticsConsent(choice: AnalyticsChoice): Promise<void> {
  const wasGranted = state.consent?.choice === "granted";
  const consent: AnalyticsConsent = { choice, at: new Date().toISOString(), policy: currentLegalVersion("privacy").version };
  setState({ loaded: true, consent });
  if (choice === "denied" && wasGranted) safely(() => resetAnalyticsData(getAnalytics()));
  await AsyncStorage.setItem(KEY, JSON.stringify(consent)).catch(() => undefined);
}

export function useAnalyticsConsent(): ConsentState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => state,
  );
}

/** The route pattern for analytics: groups like "(app)" dropped, dynamic segments kept as "[id]". */
export function screenName(segments: readonly string[]): string {
  const name = segments.filter((s) => !(s.startsWith("(") && s.endsWith(")"))).join("/");
  return name || "index";
}

export function trackScreen(segments: readonly string[]): void {
  if (!enabled()) return;
  const name = screenName(segments);
  safely(() => logScreenView(getAnalytics(), { screen_name: name, screen_class: name }));
}

/** A named product event. Parameters must never hold personal data or anything a neighbour wrote. */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (!enabled()) return;
  safely(async () => logEvent(getAnalytics(), name, params));
}

function safely(call: () => Promise<void>): void {
  try {
    void call().catch((error: unknown) => reportError(error, "analytics"));
  } catch (error) {
    reportError(error, "analytics");
  }
}
