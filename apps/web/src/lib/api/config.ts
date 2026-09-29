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
 * "live" ones and the mock store for "planned" ones. When the backend ships
 * an endpoint, flip it here — the request/response shapes are already
 * defined in lib/api/types.ts and documented in docs/api-contract.md.
 */
export const ENDPOINTS = {
  "posts.list": "live",
  "posts.create": "live",
  "posts.like": "live",
  "posts.delete": "live",
  "posts.get": "planned",
  "posts.reaction": "planned",
  "polls": "planned",
  "alerts": "planned",
  "comments": "planned",
  "users.publicProfile": "planned",
  "listings": "planned",
  "groups": "planned",
  "events.rsvp": "planned",
  "chat": "planned",
  "notifications": "planned",
  "reports": "planned",
  "settings": "planned",
  "feedback": "planned",
  "business": "planned",
  "ai.pilot": "planned",
  "contact": "planned",
  "careers": "planned",
  // Admin operations platform (contract §13)
  "admin.session": "planned",
  "admin.overview": "planned",
  "admin.moderation": "planned",
  "admin.neighbours": "planned",
  "admin.verification": "planned",
  "admin.hoods": "planned",
  "admin.content": "planned",
  "admin.businesses": "planned",
  "admin.inbox": "planned",
  "admin.broadcasts": "planned",
  "admin.insights": "planned",
  "admin.team": "planned",
  "admin.settings": "planned",
} as const satisfies Record<string, "live" | "planned">;

export type EndpointKey = keyof typeof ENDPOINTS;

export function isLive(key: EndpointKey): boolean {
  return !USE_MOCKS && ENDPOINTS[key] === "live";
}
