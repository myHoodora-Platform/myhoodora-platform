# Backend — Audit & Target Architecture

> Audited 29 Sep 2026 (`apps/api`, branch `refactoring`). **Status: agreed. Pass 1 = steps 1–6.**
> Sources of truth: `docs/api-contract.md` (all sections, §13 for admin), `apps/web/src/lib/api/*`, and this audit.

---

## A. Current backend architecture

- **Stack:** NestJS **10.4** · MongoDB via **Mongoose** (not Prisma, contrary to the brief's assumption) · Firebase Auth (ID tokens verified with Firebase Admin) · Swagger at `/api/docs` · Terminus health · Throttler (10/s, 60/min, 500/h per IP) · global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform) · global prefix `/api`.
- **Size:** ~1,900 lines across 4 feature modules, one guard, two decorators, and 3 e2e specs.
- **Global guards:** `ThrottlerGuard` → `FirebaseAuthGuard` (every route protected unless `@Public()`).
- **Build health today:** ❌. The `apps/api` dependencies aren't installed (likely the earlier ENOSPC incident), so `tsc` and all 3 e2e suites fail with "cannot find module". There's also a version skew: `@nestjs/core|common 10.4` alongside `@nestjs/swagger 11`, `@nestjs/mongoose 11` and `express 5` in `package.json`.

## B. Current module map

| Module | Owns | Notes |
| --- | --- | --- |
| `AuthModule` | `POST /auth/logout` (revoke refresh tokens) | `AuthService.verifyToken` duplicates the guard; unused |
| `UsersModule` | `GET /users/me` (find-or-create), `PATCH /users/me/onboarding`, `POST /users/me/verify-location`, `PATCH /users/me` | Onboarding picks fields safely; **`PATCH /users/me` does not** (below) |
| `PostsModule` | `POST /posts`, `GET /posts/neighborhood/:id`, `PATCH /posts/:id/like`, `DELETE /posts/:id` | Schema class is named `Update` |
| `NeighborhoodsModule` | CRUD + `GET /neighborhoods/nearby` + geo match used by verify-location | Seed script with 22 Hoods |
| `AppController` | `GET /health` (public) | |

## C. Current database model (MongoDB)

| Collection | Key fields | Indexes |
| --- | --- | --- |
| `users` | `uid` (Firebase, unique), `email`, `displayName`, `photoURL`, `provider`, `neighborhoodId?` (string), `isActive`, `isOnboarded`, `location{lat,lng,address}`, `role: member\|admin\|moderator`, `verificationStatus: verified\|unverified\|banned`, `verifiedAt`, `lastKnownLocation`, timestamps | `uid` unique |
| `posts` | `authorUid`, `neighborhoodId` (string), `type: text\|image\|event\|alert`, `content` (holds `<!--mh:{…}-->` metadata), `mediaUrls[]`, `likes[]` (uids), `isActive`, timestamps | `authorUid`, `neighborhoodId` |
| `neighborhoods` | `name` (unique), `description`, `city`, `country`, `location` (GeoJSON Point), `isActive`, `radiusMeters`, timestamps | `2dsphere`, `name` unique |

**Relationships** are by string id with no referential integrity. That's normal for Mongo, but nothing validates `neighborhoodId` on posts or users.

**Missing collections:** comments, reactions, polls/votes, RSVPs, listings, groups, messages, notifications, reports, moderation, verification tokens, communications, audit log.

## D. Current API vs contract

| Contract area | Status in backend |
| --- | --- |
| §1 posts list/create/like/delete | ✅ exists (with defects below) |
| §1 `GET /posts/:id`, reactions, polls, alerts, post-fields migration, cursor pagination, category filter | ❌ missing |
| §2 comments · §3 public profiles · §4 listings · §5 chat · §6 notifications · §7 RSVP · §8 groups · §9 reports · §10 settings / blocks / deactivate / feedback | ❌ missing |
| §11 business applications · §11b AI pilot · §11c contact / careers | ❌ missing (the web posts these to the API when live) |
| §13 admin (`/admin/*`, RolesGuard, audit) | ❌ missing |
| Users/onboarding/verify-location/logout, neighbourhoods read | ✅ exists |

**Contract rule not enforced today:** "Everything is scoped to the caller's own `neighborhoodId`, from their profile, never from the client."

## E. Authentication (today)

- **Firebase does everything:** registration, login, passwords, Google/Apple sign-in and refresh tokens, all client-side. The backend never sees passwords.
- **Identity:** the backend verifies the ID token (`checkRevoked: true`) on every request, and `GET /users/me` lazily creates the Mongo user.
- **Logout:** revokes refresh tokens. The web app also keeps an `__session` cookie that `proxy.ts` verifies for page routing.
- **Email verification:** none on our side. The Firebase `email_verified` claim is ignored, and no welcome email is sent.
- **Account state isn't enforced:** a `banned` or `isActive:false` user can still call every endpoint.

## F. Authorization (today) — problems, most severe first

| # | Problem | Severity |
| --- | --- | --- |
| 1 | `POST /neighborhoods` and `DELETE /neighborhoods/:id` have **no role check**. Any signed-in user can create or hard-delete a Hood. | 🔴 Critical |
| 2 | `POST /posts` accepts an inline body type (so the whitelist can't strip anything) and does `new Post({ authorUid, ...payload })`. **The payload spreads after `authorUid`**, so a caller can post **as someone else**, pre-fill `likes`, set `isActive`, and post into **any** Hood. | 🔴 Critical |
| 3 | `PATCH /users/me` accepts `neighborhoodId` from the client, so anyone can **join any Hood without verifying**. | 🔴 Critical |
| 4 | `GET /posts/neighborhood/:id` returns **any** Hood's feed to any user. | 🟠 High |
| 5 | Unverified, `banned` or inactive users can post, like and delete. | 🟠 High |
| 6 | There is no `RolesGuard`, no role hierarchy and no capability model. `role` exists only as data. | 🟠 High |
| 7 | `limit` is unbounded (`?limit=1000000`). Invalid ObjectIds give 500 (CastError) instead of 400/404. `DELETE /posts/:id` returns 204 even when nothing was deleted. | 🟡 Medium |
| 8 | `toggleLike` is read-modify-write, so concurrent likes race. `likes[]` grows without bound inside the post document. | 🟡 Medium |
| 9 | There's a `console.log` in `findVerifiedMatch`; the Firebase error string is logged at warn level; `JWT_SECRET` defaults to `"changeme"` (unused). | 🟡 Low |

## G. Current communication

None: no email provider, no notifications, no webhooks. A Resend key is available: a CSV export with full-access permission, no domain restriction, named "join-waitlist". **It must live only in `apps/api/.env`.** Recommendation: create a **sending-only key restricted to our verified domain** for production.

## H. Architecture problems (summary)

- **Not yet an issue:** oversized services. The services are small, but the **controllers carry business rules** (parsing, defaults), there are no DTOs, and there's no shared pagination.
- **No shared layer:** there's no exception filter, ObjectId pipe, authorization layer, transaction helper or structured logger.
- **Coupling:** `UsersService` calls into `NeighborhoodsService` (fine), but there's no boundary for future cross-module work (moderation acting on posts, listings and comments).
- **Stale docs:** the README says "Firebase Auth + JWT" (no JWT is used) and "PORT default 3333" (the code default is 3000).

---

## I. Proposed target architecture — modular monolith

This design follows three guides:
- **NestJS's current authorization guidance:** policy classes that answer "may this user do this?", checked by a global guard for stateless rules and by `authorize()` after loading the record ([docs.nestjs.com/security/authorization](https://docs.nestjs.com/security/authorization)). We implement that pattern natively (no new package) for Nest 10.
- **Mongoose transactions:** `connection.transaction()` for multi-document writes, with no parallel operations inside a session ([mongoosejs.com/docs/transactions](https://mongoosejs.com/docs/transactions.html)).
- **Resend:** Idempotency-Key and Svix-signed webhooks ([resend.com/docs](https://resend.com/docs)).

```text
src/
├── main.ts · app.module.ts
├── config/            typed config + env validation (fail fast on missing secrets)
├── shared/
│   ├── auth/          FirebaseAuthGuard (existing) · ViewerService (loads the Mongo user once per request)
│   ├── authz/         roles.ts (member<moderator<admin<owner) · capabilities.ts (§13.1) · @Can(capability) · CapabilityGuard · @RequiresActiveAccount
│   ├── http/          AllExceptionsFilter (contract §0 shape, no internals) · ParseObjectIdPipe · PaginationQuery / CursorQuery DTOs
│   ├── db/            withTransaction() helper · base schema options
│   └── logging/       Logger with redaction (tokens, keys, emails)
├── auth/              logout; email-verification endpoints (+ Firebase emailVerified sync)
├── users/             me, public profile, preferences, blocks, deactivate, onboarding
├── hoods/             /neighborhoods routes (unchanged URLs) · address verification · Hood roles (Leads)
├── posts/             feed, CRUD, categories, polls, alerts lifecycle, RSVP (events are posts)
├── reactions/         typed reactions (replaces likes[]; PATCH /like kept as an alias)
├── comments/
├── marketplace/       listings (+ mark sold)
├── groups/            groups, membership, requests, invites, group posts
├── messaging/         conversations & messages (in-app chat)
├── reports/           intake: POST /reports (dedupe per reporter+target)
├── moderation/        cases, decisions, enforcement, appeals, Hood Lead votes, audit log
│   └── ModeratableContent registry: posts/comments/listings/groups register hide/restore handlers,
│       so moderation never imports their services directly
├── notifications/     in-app Notification model + NotificationsService.notify(type, recipients, data)
├── communications/    EmailProvider port → ResendEmailAdapter (SMS/Push ports reserved) · templates · delivery log · Resend webhook
├── businesses/        applications → pages
├── inbound/           public intake: contact, feedback, AI pilot, talent network
├── telemetry/         kindness-reminder counters (aggregated, no content stored)
└── admin/             thin /admin/* controllers (contract §13) composing module services; overview/insights read models
```

**Rules:**
- **Controllers are thin:** DTO in, then a service or use-case, then a response mapper.
- **Each module owns its schemas and repositories**, and exports only services.
- **Admin controllers never duplicate business logic.** For example, `/admin/reports/:id/actions` calls `ModerationService.decide()`, the same code Hood Leads' votes resolve through.

## J. Proposed database changes (MongoDB)

| Change | Why | Migration |
| --- | --- | --- |
| **users:** add `accountStatus: active\|restricted\|suspended`, `restrictedUntil`; `verificationStatus` becomes `unverified\|pending_review\|verified\|rejected`; add `emailVerifiedAt`, `bio`, `preferences`, `blockedUids[]` (≤ 500), `deactivatedAt`; `role` adds `owner`; index `neighborhoodId`, `role` | Admin decision #3 (split states); settings §10; owner | `banned` → `verificationStatus: verified\|unverified` (kept) + `accountStatus: suspended` |
| **posts:** add first-class `category`, `alertCategory`, `urgent`, `eventDate`, `eventLocation`, `thankedName`, `priceNaira`, `poll`, `visibility`, `location`, `activeUntil`, `resolvedAt`, `commentCount`, `reactionCounts`, `commentsDisabled`, `removedAt/removedBy` (moderation, distinct from author delete); `message` (clean text) alongside the legacy `content`; compound index `{neighborhoodId, isActive, createdAt:-1}` and `{neighborhoodId, category, createdAt:-1}` | Contract §1 migration; cursor pagination; moderation needs "removed" ≠ "deleted" | Parse `<!--mh:{}-->` and `<!--event:{}-->` prefixes into fields (idempotent script) |
| **reactions** (new): `{postId, uid, type}`, **unique (postId, uid)** | Atomic, one reaction per user, no unbounded array | `likes[]` → `type: like` rows; keep `likes` read-compat until the web flips `posts.reaction` |
| **poll_votes** `{postId, uid, optionId}` unique (postId, uid) · **rsvps** `{postId, uid, status}` unique | Contract polls/RSVP | — |
| **comments** `{postId, authorUid, content, removedAt}`, index `{postId, createdAt}` | §2 | — |
| **listings**, **groups** + **group_members** (unique groupId+uid) + **group_requests** + **group_posts**, **conversations** + **messages** | §4, §8, §5 | — |
| **reports** `{targetType, targetId, reporterUid, reason, details, hoodId}`, unique (reporterUid, targetType, targetId) | One report per neighbour per item; grouping into cases | — |
| **moderation_cases** `{target, hoodId, severity, status, assignee, route: staff\|leads, decision, appeal}` · **lead_votes** `{caseId, uid, vote}` unique (caseId, uid) · **audit_events** (append-only) | Moderation domain, Hood Leads, appeals, §13 audit | — |
| **hood_roles** `{hoodId, uid, role: lead}` unique | Hood Leads without overloading `users.role` | — |
| **neighborhoods:** `status: active\|paused\|archived` replaces `isActive`; `DELETE` becomes archive | Admin decision #4 | `isActive:false` → `paused` |
| **email_verifications** `{uid, tokenHash, expiresAt, consumedAt, sentAt}` (TTL index on `expiresAt` + 7d) | Secure single-use tokens (OWASP) | — |
| **notifications** `{uid, type, title, body, data, readAt}` index `{uid, readAt, createdAt}` | Contract §6 | — |
| **communications** `{uid, channel, type, provider, providerMessageId (unique sparse), status, sentAt, deliveredAt, failedAt, lastEventId}` | Delivery tracking; idempotent webhook | — |
| **business_applications/pages**, **inbound_messages** (contact/feedback), **signups** (AI pilot, talent), **telemetry_counters** | §11, §11b, §11c | — |

**Migrations:** Mongo has no schema migrations, so we add a tiny runner. Each step is `src/database/migrations/NNN-name.ts`, is idempotent, and is recorded in a `migrations` collection, run with `pnpm --filter @myhoodora/api migrate`. Every step supports `--dry-run`.

**Transactions** (Atlas is a replica set) are used only where partial state would be wrong:
- registration (user + verification token)
- a moderation decision (case + content state + audit)
- a Lead vote (vote + tally + possible decision)
- group create (group + creator membership)
- conversation create (conversation + first message)

## K. Proposed API changes

| Kind | Endpoints |
| --- | --- |
| **Existing and keep** | `GET /health`, `POST /auth/logout`, `GET /users/me`, `PATCH /users/me/onboarding`, `POST /users/me/verify-location`, `GET /neighborhoods`, `GET /neighborhoods/nearby`, `GET /neighborhoods/:id`, `GET /posts/neighborhood/:id`, `PATCH /posts/:id/like`, `DELETE /posts/:id` |
| **Existing but fix** | `POST /neighborhoods` → admin (`hoods.manage`); `DELETE /neighborhoods/:id` → admin, **archives** instead of hard-deleting (still 204); `POST /posts` → DTO, `authorUid` from token, Hood from profile, verified + active account; `PATCH /users/me` → `neighborhoodId` **no longer accepted** (400); only verification or admin can change a Hood; feed → 404 if not the caller's Hood; `limit` capped at 50; `?before` cursor; `?category`; invalid ids → 400 |
| **New, already in contract** | Everything in §1–§11c and §13 (listed in the Status overview + §13) |
| **New, contract additions (documented)** | `POST /auth/email-verification/confirm` `{token}` → 204 · `POST /auth/email-verification/resend` → 202 (rate-limited) · `POST /webhooks/resend` (public, Svix-signed) · `POST /telemetry/kindness` `{shown, edited}` → 204 · `GET/PUT /admin/hoods/:id/leads` · `POST /moderation/cases/:id/votes` (Leads) · `POST /moderation/decisions/:id/appeals` (author or reporter) · `PATCH /admin/settings` adds `alertWindows` · `GET /listings/:id` and `GET /groups/:id` (already in contract) back the new web detail pages |
| **Contract change required** | `PATCH /users/me` drops `neighborhoodId` (security; the web never sends it after onboarding, so no UI impact). The `role` enum gains `owner`. `ENDPOINTS` keys flip to `live` as modules ship. |

## L. Communication architecture

```text
Use case (e.g. UserRegistered, CommentCreated, ModerationDecided)
   ↓
NotificationsService.notify(type, recipients, data)
   ├─ in-app  → notifications collection (always, if the type is in-app)
   └─ external → CommunicationsService.send(channel, template, recipient, data)
                   ├─ EmailProvider  → ResendEmailAdapter   (now)
                   ├─ SmsProvider    → (reserved port, e.g. Termii for Nigeria)
                   └─ PushProvider   → (reserved port, FCM, since we're already on Firebase)
                 + communications row (queued → sent → delivered | bounced | failed)
Resend webhook → Svix verify on raw body → idempotent by svix-id / providerMessageId → status update
```

- **Isolation:** business code never imports `resend`. Only `communications/providers/resend-email.adapter.ts` does.
- **Idempotency:** each send has an idempotency key (`${type}:${uid}:${refId}`), passed as Resend's `Idempotency-Key` (24 h window).
- **Delivery status:** a successful API call only means **sent**. **Delivered** comes from the `email.delivered` webhook.
- **Preferences:** user notification preferences (§10) gate external channels. Safety-critical messages (urgent alerts, account actions) can't be switched off.
- **No queue infrastructure yet:** sends run after the DB commit, in-process. Failures are recorded with retry state, so a queue (e.g. BullMQ) can be added behind the same port later without touching use cases.

### Email verification flow (OWASP-aligned)

```text
GET /users/me creates the user (first time only)  ─┐  one transaction: user + email_verification
                                                   └→ after commit: welcome + verify email (idempotent key "welcome:<uid>")
Link: {APP_URL}/verify-email?token=<32 random bytes, base64url>   (only the SHA-256 hash is stored)
Next.js page → POST /auth/email-verification/confirm {token}
  → hash lookup, not expired (24 h), not consumed → consume + users.emailVerifiedAt + Firebase emailVerified=true
  → same generic 400 for invalid, expired or used tokens (no enumeration); throttled
Resend: POST /auth/email-verification/resend → invalidates old tokens, max 3 per hour per user, 202 always
```

- **Accounts that are already verified:** Google/Apple sign-ins (`email_verified` already true from the provider) are marked verified immediately and only get the welcome email.
- **No welcome email on sign-in:** it only goes out when the user record is created.
- **Logging:** tokens are never logged, and the page sends `Referrer-Policy: no-referrer`.

## M. Backlog placement

| Item | Where |
| --- | --- |
| **Hood Leads** | `hoods/` (lead role per Hood) + `moderation/` (routing and votes). Routing rules live in `moderation/policy/routing.ts`: account reports, and harassment/threat/discrimination/misinformation/scam reasons, go to **staff**. Everything else in a Hood with ≥ 3 active Leads goes to **leads**. Consensus is in `moderation/policy/consensus.ts`: 3 votes minimum, **remove** if ≥ 2/3 of votes are Remove, **keep** if ≥ 2/3 are Keep, otherwise escalate to staff after 48 h. Staff can override any case. |
| **Appeals** | `moderation/`. An appeal is attached to the **original decision** (one per party per decision), reviewed by staff (not the original decider), and ends as upheld or overturned (overturned restores the content or account). |
| **Owner** | `shared/authz/roles.ts`: the hierarchy adds `owner`. Only the `team.manage.admins` capability can grant or revoke `admin`. There's always at least one owner; the last one can't demote themselves. |
| **Group / listing detail pages** | Web `features/admin/content` + existing `GET /admin/groups/:id`, `GET /admin/listings/:id` (contract §13.6) |
| **Editable alert windows** | `posts/alerts` reads windows from `platform_settings` (admin-editable) and computes `activeUntil` on create. The web lifecycle uses `activeUntil` when present. |
| **Kindness telemetry** | `telemetry/`. Daily counters `{day, hoodId, shown, edited, postedAnyway}`, with no content stored. Feeds `/admin/insights.kindnessPrompts`. |

## N. Risks

- **Data migration of posts:** a bad parse would lose metadata. The script keeps `content` untouched, writes the new fields alongside, supports dry-run, and has tests.
- **Breaking changes:**
  - `PATCH /users/me` rejecting `neighborhoodId` (the web doesn't send it).
  - Feed 404 for other Hoods (the web only requests its own).
  - `DELETE /neighborhoods` archiving (the admin already expects archive).
- **Account enforcement** could lock out real users if the old `banned` data is wrong. Migrate with a report first.
- **Transactions** need a replica set: Atlas is fine; a local standalone Mongo isn't. Tests use `mongodb-memory-server` in replica-set mode (downloads a ~100 MB MongoDB binary once).
- **Email sending** needs a **verified sending domain** in Resend. Until then Resend only delivers to the account owner's address from `onboarding@resend.dev`.
- **Secrets:** a MongoDB password was pasted in chat earlier and should be rotated; the Resend key is full-access; `serviceAccountKey.json` is correctly git-ignored.

## O. Implementation order (safest first)

1. **Baseline:** install API deps; fix version skew; tests green.
2. **Security hotfixes** (no contract impact): authz layer + `RolesGuard` / capabilities; neighbourhoods guarded; posts DTO and hood scoping; `PATCH /users/me`; account-state enforcement; exception filter; ObjectId pipe; limit caps; remove `console.log`.
3. **Schema changes + migration runner + posts/users/neighborhoods migrations.**
4. **Core social:** posts (get, categories, cursor), reactions, comments, polls, alerts (windows from settings), RSVP, public profiles, settings, blocks.
5. **Reports → moderation** (cases, decisions, audit, appeals, Hood Leads) + **§13 admin** endpoints.
6. **Communications:** Resend adapter, templates, delivery log, webhook; email verification + welcome; in-app notifications.
7. **Marketplace, groups, messaging, businesses, inbound, telemetry.**
8. **Owner role, alert-window editing, and group/listing admin detail pages (web).**
9. **Contract verification:** e2e per endpoint against the contract shapes; flip web `ENDPOINTS` keys to `live`; add the web `/verify-email` page.
10. **Tests:** authz matrix, integrity, moderation, verification, webhooks.
11. **Docs:** architecture, database, auth, communications, env, deployment.
12. **Final production-readiness review.**

## P. Decisions (confirmed 29 Sep 2026)

1. **Email verification** uses our own hashed, single-use tokens and syncs Firebase `emailVerified`. ✅
2. **Sender:** `myHoodora <hello@mail.myhoodora.com>`. The DNS records Resend shows for `mail.myhoodora.com` must be added. Until verified, sends only reach the Resend account owner. ✅
3. **Tests:** `mongodb-memory-server` in replica-set mode for integration tests. ✅
4. **Scope:** pass 1 = steps 1–6 (security, schema, core social, moderation + §13, communications). Pass 2 = steps 7–12. ✅
