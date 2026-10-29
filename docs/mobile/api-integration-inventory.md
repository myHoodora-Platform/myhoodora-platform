# Mobile: API integration inventory

The API (`apps/api`, NestJS) is the source of truth. The full contract is [`../api-contract.md`](../api-contract.md); types are in `apps/web/src/lib/api/types.ts`. This page covers only what mobile needs and where mobile differs from the web.

## Transport and auth (confirmed)

| Item | Value | Mobile action |
| --- | --- | --- |
| Base URL | `NEXT_PUBLIC_API_URL` on the web, including `/api` (default `http://localhost:3001/api`). Production runs on Render (exact URL in the host settings, not the repository) | `EXPO_PUBLIC_API_URL`, validated at startup. A device cannot reach `localhost`, so development needs a LAN address or staging (task M4) |
| Auth | `Authorization: Bearer <Firebase ID token>` on every call | Same: `user.getIdToken()` per request |
| Session cookie, `/auth/session`, `/auth/session/staff` | Web page gate only | **Not used on mobile** |
| CORS | `CORS_ORIGIN` allow-list, `credentials: true` | Not applicable to native `fetch` |
| Error body | `{ statusCode, message: string \| string[] }` | Same classification as the web (contract §0) |
| Timeout | 15 s for requests; uploads 120 s | Same |
| Rate limit | 429 with `Retry-After` comes from the limiter (retry once if 10 s or less). A 429 **without** `Retry-After` is a product rule: show its message and don't retry | Same logic. It moves to `@myhoodora/api-contract` (ADR-005) |
| 503 | Firebase unreachable. **Never treat it as 401** | Same |
| Swagger | `/api/docs` outside production | Use it to check shapes during development |

## Status classification (to share, not re-implement)

`offline · timeout · network · auth(401) · forbidden(403) · not_found(404) · server(5xx) · rate_limited(429 + Retry-After) · client(other 4xx)`, each with a friendly message. 400/422 messages and 429 product-rule messages are shown verbatim. The source is `apps/web/src/lib/api/client.ts`.

Mobile differences:

- Offline detection uses `@react-native-community/netinfo` (or `expo-network`) instead of `navigator.onLine`.
- Timeouts use `AbortController` with `setTimeout` (do not rely on `AbortSignal.timeout` existing in Hermes; verify in Phase 3).
- The web's timeout check is `instanceof DOMException`, which may not hold in React Native. Classify by abort reason instead.

## Endpoints by first-use phase

### Phase 4 (vertical slice: sign in and read the Hood feed)

| Endpoint | Purpose |
| --- | --- |
| Firebase `signInWithEmailAndPassword` / `createUserWithEmailAndPassword` / `sendPasswordResetEmail` | Credentials go to Firebase, not to our API |
| `GET /users/me` | Profile, with `neighborhoodId`, onboarding state and `requestedHood`. **The first call creates the record** for a new Google user |
| `GET /neighborhoods/:id` (as `fetchNeighborhood` on the web) | Hood name in the header |
| `GET /posts/neighborhood/:id?limit=10&before&category&since` | Feed, paged by cursor (`before`). Page size 10 |
| `GET /posts/:id`, `GET /posts/:id/comments` | Post detail |
| `PUT` / `DELETE /posts/:id/reaction` | First write action (optional in the slice) |

### Later phases (all ✅ live per contract)

| Area | Endpoints | Contract § |
| --- | --- | --- |
| Onboarding | `POST /users/me/verify-location/preview`, `POST /users/me/verify-location`, `PATCH /users/me/onboarding`, `POST`/`DELETE /users/me/hood-request` | §16, §29 |
| Posting | `POST /posts` (with a `clientId` for idempotency), `POST /moderation/check` (Kindness), polls, alerts | §1, §22, §26 |
| Media | `POST /media` (multipart; mobile appends `{ uri, name, type }` to `FormData`), `DELETE /media/:id` | §20 |
| For Sale & Free | `GET`/`POST /listings`, `GET`/`PATCH`/`DELETE /listings/:id` | §4 |
| Events | `GET`/`PUT`/`DELETE /posts/:id/rsvp` | §7, §23 |
| Groups | §8 in full | §8 |
| Chat | `/conversations…` | §5 |
| Notifications | `GET /notifications`, unread count, mark read | §6 |
| Settings | `PATCH /users/me`, preferences, blocks, deactivate, `POST /auth/logout-everywhere` | §10, §24 |
| Search | `GET /search?q&type&limit` | §21 |
| Reports | `POST /reports` | §9 |
| Support | `/support/threads…`, `POST /support` | §18 |

## Realtime (contract §19)

- `GET /realtime/stream` with a Bearer token. The stream sends `ready`, then `ping` every 25 s, then events. **Events are hints:** refetch through the normal endpoints.
- `EventSource` cannot send headers, so use a **streaming `fetch`**. React Native's built-in `fetch` does not stream response bodies; `expo/fetch` does. Verify `expo/fetch` streaming on Android and iOS in Phase 3 before building on it.
- Reuse the web's `sse-parser.ts` (it is pure) through `@myhoodora/api-contract`.
- Client rules carry over: jittered backoff from 1 s to 30 s with a fresh token each time; resync after reconnecting; poll every 15 s after 3 failures. Mobile replaces "background tab for 5 minutes" with **`AppState` background**: close the stream after it has been in the background for a while, reconnect and resync on `active`.
- With TanStack Query, each event maps to `queryClient.invalidateQueries` on the matching keys.

## Gaps that needed backend work

| Gap | Detail | Interim |
| --- | --- | --- |
| ~~Geocoding~~ **closed 2026-10-20** | The lookup routes now accept a Bearer ID token (contract, "Web server lookup routes") | — |
| ~~Push notifications~~ **closed 2026-10-20** | `PUT`/`DELETE /push/devices`; every notification pushed per preference (contract §30) | — |
| Direct video upload | `media.direct` is `planned` (off) | Upload through the API, as the web does |

## What mobile must not do

- Send a Hood ID the server should derive. Scope always comes from the server; only the confirmed `neighborhoodId` from a preview is passed back, as the web does.
- Keep any secret. `EXPO_PUBLIC_*` values are public: the Firebase web config and the API URL only.
- Log tokens, request bodies or personal data.
