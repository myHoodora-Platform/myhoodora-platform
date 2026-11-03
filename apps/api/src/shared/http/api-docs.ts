import { applyDecorators } from "@nestjs/common";
import { ApiBadRequestResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiProperty, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";

/** Every error response (contract §0). 400/422 messages are safe to show verbatim. */
export class ErrorResponse {
  @ApiProperty({ example: 400 }) statusCode!: number;
  @ApiProperty({ oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }], example: "Enter a Nigerian mobile number, e.g. 0803 123 4567." })
  message!: string | string[];
}

/** The errors any authenticated route can return; applied per controller. */
export const ApiStandardErrors = () =>
  applyDecorators(
    ApiBadRequestResponse({ description: "Validation failed, or a malformed id", type: ErrorResponse }),
    ApiUnauthorizedResponse({ description: "Missing or expired Firebase ID token", type: ErrorResponse }),
    ApiForbiddenResponse({ description: "Not allowed (capability, account state or ownership)", type: ErrorResponse }),
    ApiTooManyRequestsResponse({ description: "Rate limited", type: ErrorResponse }),
  );

/**
 * 404 for detail routes. Anything outside your Hood, or hidden from you
 * (blocked, removed, private), also answers 404, so ids never leak.
 */
export const ApiNotFound = (what: string) => ApiNotFoundResponse({ description: `${what} not found, or not visible to you`, type: ErrorResponse });

export const API_DESCRIPTION = `
REST API for **myHoodora**, the hyper-local network for Nigerian neighbourhoods. The web app's contract is
[\`docs/api-contract.md\`](https://github.com/) (the source of truth for shapes); this page is generated from the code.

### Authentication
Send a **Firebase ID token**: \`Authorization: Bearer <idToken>\`. Routes marked *public* need no token.
Call \`GET /users/me\` once after sign-in: it creates your account on first use.
The web app's page gate is a Firebase **session cookie**: \`POST /auth/session\` mints one from your ID token, and
\`GET /auth/session\` (still live, i.e. not revoked?) and \`GET /auth/session/staff\` are the only routes that accept it.
All three are called by the web server, never by a browser.

### Who can do what
Access comes from your **role** (member < moderator < admin < owner) **and** account state:
suspended accounts can only call \`GET /users/me\`, \`POST /auth/session\` and \`POST /auth/logout-everywhere\`; restricted or unverified neighbours
can read but not post (restricted ones can still message). Everything is scoped to **your own Hood**: other Hoods' content returns 404.

### Errors
Always \`{ statusCode, message }\`. 400/422 \`message\` strings are written for people and can be shown as-is.
401 expired token · 403 not allowed · 404 not found or not in your Hood · 409 conflict/already done · 410 poll closed · 429 slow down.

### Rate limits
Per IP: 10/s, 60/min, 500/h, with stricter limits on sign-up-style and public forms. Some actions also have daily
per-person limits (urgent alerts, new groups, listings, new conversations).

### Pagination
Feeds use \`limit\` (≤ 50) and a \`before\` cursor. Admin lists use \`page\`, \`pageSize\` (≤ 100), \`q\` and \`sort=field:asc|desc\`
and return \`{ items, page, pageSize, total }\`.
`.trim();

export const API_TAGS: [string, string][] = [
  ["health", "Service health & readiness"],
  ["auth", "Session, email verification"],
  ["users", "Your profile, onboarding, address verification, preferences, blocks, public profiles, search"],
  ["neighborhoods", "Hood discovery & geo-search (create/archive: admins)"],
  ["posts", "Hood feed: posts, reactions, polls, alerts, events"],
  ["comments", "Comments on posts"],
  ["listings", "For Sale & Free (contract §4)"],
  ["chat", "Private messages (contract §5)"],
  ["notifications", "In-app notifications"],
  ["groups", "Groups, members, invites, group posts (contract §8)"],
  ["reports", "Reporting content & people (private)"],
  ["moderation", "Hood Lead voting, your moderation decisions, appeals"],
  ["support", "Feedback, help requests and your support conversations (contract §18)"],
  ["realtime", "Live updates over Server-Sent Events (contract §19)"],
  ["media", "Photo and video uploads through the storage abstraction (contract §20)"],
  ["search", "Search your Hood: posts, For Sale & Free, neighbours"],
  ["business-pages", "Business Page applications & claiming (contract §11)"],
  ["public", "Public forms: contact, careers, AI pilot (no account)"],
  ["telemetry", "Anonymous product counters"],
  ["admin", "Staff operations (contract §13); needs a staff role"],
];
