const DEFAULT_NEXT = "/dashboard";

// Only send people back into the signed-in app. Anything else (other sites,
// protocol-relative "//evil.com", backslash tricks) falls back to the dashboard.
const ALLOWED_PREFIX = /^\/(dashboard|admin|onboarding)(?:[/?#]|$)/;

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || raw.startsWith("//") || raw.includes("\\")) return DEFAULT_NEXT;
  return ALLOWED_PREFIX.test(raw) ? raw : DEFAULT_NEXT;
}
