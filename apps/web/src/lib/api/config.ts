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
 * has the same table). Planned today = backend pass 2. When the backend ships
 * an endpoint, flip it here — the request/response shapes are already
 * defined in lib/api/types.ts and documented in docs/api-contract.md.
 */
export const ENDPOINTS = {
  "posts.list": "live",
  "posts.create": "live",
  "posts.like": "live",
  "posts.delete": "live",
  "auth.emailVerification": "live",
  "posts.get": "live",
  "posts.reaction": "live",
  "polls": "live",
  "alerts": "live",
  "comments": "live",
  "users.publicProfile": "live",
  "listings": "planned",
  "groups": "planned",
  "events.rsvp": "live",
  "chat": "planned",
  "notifications": "live",
  "reports": "live",
  "settings": "live",
  "feedback": "live",
  "business": "planned",
  "ai.pilot": "planned",
  "contact": "planned",
  "careers": "planned",
  // Admin operations platform (contract §13)
  "admin.session": "live",
  "admin.overview": "live",
  "admin.moderation": "live",
  "admin.neighbours": "live",
  "admin.verification": "live",
  "admin.hoods": "live",
  "admin.content": "live",
  "admin.businesses": "planned",
  "admin.marketplace": "planned",
  "admin.groups": "planned",
  "admin.signups": "planned",
  "admin.inbox": "planned",
  "admin.broadcasts": "live",
  "admin.insights": "live",
  "admin.team": "live",
  "admin.settings": "live",
} as const satisfies Record<string, "live" | "planned">;

export type EndpointKey = keyof typeof ENDPOINTS;

export function isLive(key: EndpointKey): boolean {
  return !USE_MOCKS && ENDPOINTS[key] === "live";
}
