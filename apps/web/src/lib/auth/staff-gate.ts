import { API_BASE_URL } from "@/lib/api/config";

/**
 * Server-side check behind the admin portal's page gate (src/proxy.ts).
 * The API stays the source of truth: GET /admin/me decides, and every admin
 * API call is authorised again on its own. This only decides whether the
 * *page* is served at all, so non-staff get the ordinary 404.
 */
export type StaffVerdict = "staff" | "not_staff" | "expired" | "unknown";

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;
// token hash → verdict, per server instance. ID tokens rotate hourly anyway.
const cache = new Map<string, { verdict: StaffVerdict; at: number }>();

async function tokenKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("base64url");
}

export async function staffVerdict(token: string): Promise<StaffVerdict> {
  const key = await tokenKey(token);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.verdict;

  let verdict: StaffVerdict;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    verdict = res.ok ? "staff" : res.status === 403 ? "not_staff" : res.status === 401 ? "expired" : "unknown";
  } catch {
    verdict = "unknown";
  }
  // Only remember "staff". Outages should be retried, and "not staff" must not
  // stick: someone just promoted from Admin → Team gets in on their next page
  // load. (A demoted user may keep the page for up to a minute, but AdminShell
  // re-checks /admin/me and the API refuses every admin call at once.)
  if (verdict === "staff") {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, { verdict, at: Date.now() });
  }
  return verdict;
}
