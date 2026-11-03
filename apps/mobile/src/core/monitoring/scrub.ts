import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";

/**
 * What leaves the phone in a crash report: enough to fix the bug, nothing about the person. No
 * tokens, emails, phone numbers, addresses or post/message text (they arrive in request bodies,
 * query strings and log lines, so those are dropped or redacted). The user is the Firebase uid only.
 */
export const FILTERED = "[Filtered]";

const PATTERNS: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${FILTERED}`],
  [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, FILTERED], // JWTs (Firebase ID tokens)
  [/ExponentPushToken\[[^\]]+\]/g, FILTERED],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, FILTERED], // emails
  [/\+\d{1,3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3,4}\b/g, FILTERED], // international phone numbers
  [/\b0[789][01]\d{8}\b/g, FILTERED], // Nigerian mobile numbers written locally
];

/** Keys whose values are never kept in extra data or breadcrumb data, whatever they hold. */
const SENSITIVE_KEY = /pass|token|auth|cookie|secret|email|phone|address|body|content|message|text|name|query|location|lat|lng|coords/i;

export function redact(text: string): string {
  return PATTERNS.reduce((s, [re, to]) => s.replace(re, to), text);
}

/** A URL without its query or fragment (search terms, tokens), and with anything sensitive in the path redacted. */
export function stripUrl(url: string): string {
  return redact(url.split(/[?#]/)[0] ?? "");
}

/** Redacts every string, and filters values under sensitive keys, a few levels deep. */
export function scrubData(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redact(value);
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubData(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) out[key] = SENSITIVE_KEY.test(key) ? FILTERED : scrubData(v, depth + 1);
  return out;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  const next: Breadcrumb = { ...crumb, ...(crumb.message && { message: redact(crumb.message) }) };
  const data = crumb.data ?? {};
  if (crumb.category === "xhr" || crumb.category === "fetch") {
    // Method, address (no query) and status only: never what was sent or received.
    next.data = {
      ...(typeof data.method === "string" && { method: data.method }),
      ...(typeof data.url === "string" && { url: stripUrl(data.url) }),
      ...(data.status_code !== undefined && { status_code: data.status_code }),
    };
  } else if (crumb.category === "console") {
    // The redacted line is enough; the raw arguments may hold anything.
    const { arguments: _args, ...rest } = data;
    next.data = scrubData(rest) as Breadcrumb["data"];
  } else if (crumb.category === "touch" && Array.isArray(data.path)) {
    // Which component was tapped, not its label (labels can carry names and post text).
    next.data = { ...data, path: (data.path as Record<string, unknown>[]).map(({ label: _label, ...p }) => p) };
  } else if (crumb.data) {
    next.data = scrubData(crumb.data) as Breadcrumb["data"];
  }
  return next;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const next: ErrorEvent = { ...event };
  if (next.message) next.message = redact(next.message);
  if (next.user) next.user = next.user.id ? { id: next.user.id } : undefined;
  if (next.request) {
    next.request = {
      ...(next.request.method && { method: next.request.method }),
      ...(next.request.url && { url: stripUrl(next.request.url) }),
    };
  }
  if (next.exception?.values) {
    next.exception = { ...next.exception, values: next.exception.values.map((ex) => ({ ...ex, ...(ex.value && { value: redact(ex.value) }) })) };
  }
  if (next.extra) next.extra = scrubData(next.extra) as ErrorEvent["extra"];
  if (next.contexts?.device?.name) {
    // The phone's name ("Ada's iPhone") identifies its owner.
    const { name: _name, ...device } = next.contexts.device;
    next.contexts = { ...next.contexts, device };
  }
  if (next.breadcrumbs) next.breadcrumbs = next.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  return next;
}
