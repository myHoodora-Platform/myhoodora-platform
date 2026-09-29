export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

/**
 * `NEXT_PUBLIC_USE_MOCKS=true` runs the whole app — including endpoints that
 * already exist (feed, profile) — against the in-browser mock store, so the
 * frontend can be developed and demoed with no API/DB running.
 */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/**
 * Which backend endpoints exist today. Services call the real API for
 * "live" ones and the mock store for "planned" ones (docs/api-contract.md
 * has the same table). When the backend ships
 * an endpoint, flip it here — the request/response shapes are already
 * defined in lib/api/types.ts and documented in docs/api-contract.md.
 */
export const ENDPOINTS = {
  "posts.list": "live",
  "posts.create": "live",
  "posts.like": "live",
  "posts.delete": "live",
  "auth.emailVerification": "live",
  "support": "live",
  "telemetry": "live",
  "moderation.leads": "live",
  "moderation.appeals": "live",
  "business.claim": "live",
  "posts.get": "live",
  "posts.reaction": "live",
  "polls": "live",
  "alerts": "live",
  "comments": "live",
  "users.publicProfile": "live",
  "listings": "live",
  "groups": "live",
  "events.rsvp": "live",
  "chat": "live",
  "notifications": "live",
  "reports": "live",
  "settings": "live",
  "feedback": "live",
  "business": "live",
  "ai.pilot": "live",
  "contact": "live",
  "careers": "live",
  // Admin operations platform (contract §13)
  "admin.session": "live",
  "admin.overview": "live",
  "admin.moderation": "live",
  "admin.neighbours": "live",
  "admin.verification": "live",
  "admin.hoods": "live",
  "admin.content": "live",
  "admin.businesses": "live",
  "admin.marketplace": "live",
  "admin.groups": "live",
  "admin.signups": "live",
  "admin.inbox": "live",
  "admin.broadcasts": "live",
  "admin.insights": "live",
  "admin.team": "live",
  "admin.settings": "live",
} as const satisfies Record<string, "live" | "planned">;

export type EndpointKey = keyof typeof ENDPOINTS;

export function isLive(key: EndpointKey): boolean {
  return !USE_MOCKS && ENDPOINTS[key] === "live";
}
