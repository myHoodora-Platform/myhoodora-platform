# Backend changelog

## Pass 2: marketplace, groups, chat, businesses, inbound, Hood Leads, appeals (2026-09-29)

Contract details are in [api-contract.md §15](../api-contract.md). Every endpoint in the contract is now live, and the web `ENDPOINTS` table has no planned keys.

### New modules
| Module | What | Notes |
| --- | --- | --- |
| `listings/` | For Sale & Free (§4) | Hood-scoped; 10/day; seller card embedded; moderation target `listing` |
| `groups/` | Groups (§8) | Boundaries (Hood / 5 km / city); join requests; rotatable invite tokens; group admins; posts; moderation target `group` (archive) |
| `chat/` | Conversations (§5) | Idempotent threads per pair + listing; per-member unread counts; respects messaging preferences and blocks; `messages.send` capability (restricted accounts can still message); moderation target `message` |
| `businesses/` | Business Pages (§11, §13.7) | Public applications; staff review with emails; hashed single-use claim token (7 days); ads waitlist; moderation target `business` (suspend) |
| `inbound/` (rewritten) | Contact, talent network, AI pilot, feedback, in-app support, staff inbox (§10, §11b, §11c, §13.8) | Threads with staff replies by email + notification; per-email limits; de-duplicated waitlists; acknowledgement emails |
| `telemetry/` | Kindness reminder counters | Anonymous daily counters only |
| `moderation/` (extended) | Hood Leads + appeals | `hood_roles`, `lead_votes`, `appeals`; routing in `fileReport`; consensus through `ModerationService.decide`; lazy 48 h escalation (no scheduler) |

### Other changes
- `GET /users/search` for group invites.
- `ContentActionsService` gives staff one remove/restore path for every content type.
- The overview now reports real `businessApplications` and `openAppeals`; insights now report real `kindnessPrompts`.
- **Swagger:**
  - The `@nestjs/swagger` CLI plugin (in `nest-cli.json`) generates schemas from DTOs: types, enums, limits, patterns and JSDoc.
  - Every operation has a summary and a tag, and there's a shared `ErrorResponse`.
  - The docs are at `/api/docs`, with the JSON at `/api/docs-json`. They're off in production unless `SWAGGER_ENABLED=true`.
- **`autoIndex` is now on by default** (`MONGO_AUTO_INDEX=false` turns it off). It only creates *missing* indexes. The new unique indexes carry business rules (one vote per Lead, one thread per pair, unique group names), and the production deploy on Render would otherwise never have them.
- Emails default to `hello@myhoodora.com` while `mail.myhoodora.com` is under review in Resend.

### Bugs and imbalances fixed on the web
- Public forms (contact, careers, AI pilot, business) turned every error into a generic "server" message. They now show the API's 400/429 message.
- The talent form accepted `http://` links and names of any length, which the API rejects. Both are now aligned.
- The group page didn't pass `?invite=`, so invitees outside the boundary got a 404.
- Owners didn't see the Admin link in the user menu, and the neighbours filter had no Owner option.
- The chat badge was always 0 when live. It now polls `/conversations/unread-count` every minute and on tab focus.
- The help page had only a `mailto:` link. It now has an in-app support form that feeds the staff inbox.
- Kindness reminders were never counted. They're now reported anonymously.

### New web pages
- `/leads`: Hood Lead review queue.
- `/settings/moderation`: decisions & appeals.
- `/business/claim`: claim a Business Page (the token is removed from the URL and `no-referrer` is set).
- `/admin/moderation/appeals`.
- The admin Hood page has a Hood Leads panel, and the report detail shows Lead votes.

### Tests
The integration suite now has 84 tests across 9 suites. The new suites are:
- `marketplace-chat`
- `groups`
- `inbound-business`
- `leads-appeals`
- an extended `admin-contract`, which now also checks listings, groups, businesses, inbox and sign-ups against the web types.

One test failed once in 8 full runs and never reproduced in 5 further full runs plus 6 isolated runs. It is noted here, not hidden.

### Still to do
- **Resend:** verify `mail.myhoodora.com` (the sender is `myhoodora.com` until then).
- **Render environment:** set `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `MAIL_FROM` and `APP_URL`, and optionally `SWAGGER_ENABLED`.
- **Data:** run `pnpm migrate` (pass-1 migrations 001–004).
- **MongoDB:** rotate the password shared earlier.
- **Product follow-ups:**
  - SMS OTP for business phones (the `SmsProvider` port is ready; staff confirm by phone for now) and an automated CAC register check (recorded manually for now).
  - Realtime chat (polling today).
  - Business Page tools (posts, recommendations, Local Ads).
  - Hood Lead self-nomination and voting by neighbours (admins appoint today).

## Pass 1: security, core social, moderation, communications (2026-09-29)

This covers steps 1–6 of the plan in [BACKEND_AUDIT_AND_TARGET.md](./BACKEND_AUDIT_AND_TARGET.md) §O/§P. Contract changes are listed in [api-contract.md §14](../api-contract.md).

### Security fixes (audit §C)
| Finding | Fix | Test |
| --- | --- | --- |
| F1: `POST`/`DELETE /neighborhoods` open to any signed-in user; `DELETE` hard-deleted | `@Can("hoods.manage")`; `DELETE` archives | `security › F1` |
| F2: `POST /posts` spread the body after `authorUid` (author forgery, posting into any Hood, setting likes) | Whitelisted DTO; author and Hood come from the Viewer; `forbidNonWhitelisted` | `security › F2` |
| F3: `PATCH /users/me` could change `neighborhoodId` (skipping verification) | Field removed from the DTO (400) | `security › F3` |
| F4: any Hood's feed and posts readable | Feed and post reads scoped to the viewer's Hood (404 otherwise) | `security › F4` |
| Account state never enforced | `AccountGuard` + capabilities derived from role **and** state | `security › suspended…`, `unverified, restricted…` |
| Unbounded `limit`; malformed ids caused 500s | `limit` ≤ 50, `skip` ≤ 1000, `ParseObjectIdPipe` | `security › caps limit…` |
| Like race (read-modify-write on an array) | `reactions` collection + unique index + `$inc` in a transaction | `moderation-engagement › concurrent likes` |
| `console.log` of tokens/PII; stack traces in responses | Logger with redaction; `AllExceptionsFilter` | — |

### New
- **Roles:** `owner` added above admin. Only owners manage admins, and the last owner can't step down.
- **Account state:** `accountStatus` and `restrictedUntil` are split from `verificationStatus`. Restrictions expire automatically.
- **Posts:** first-class fields; reactions, polls, RSVPs and the alert lifecycle (per-category `activeUntil`, resolve, staff end/downgrade); urgent alerts limited to 1 per 6 h per neighbour; cursor pagination; `category`/`since` filters.
- **Comments** with a denormalised `commentCount`; blocked people are hidden.
- **Moderation:** reports group into one case per item; severity comes from platform settings; claim/release (409 on conflict); decisions run in one transaction with the audit entry; the author and reporters are notified (the staff note is never shown).
- **Admin API** (contract §13) for session, overview, reports, audit, neighbours, verification queue, Hoods, posts/comments/alerts, broadcasts, insights, team and settings.
- **Notifications:** in-app, grouped (e.g. one notification per post for reactions), respect blocks and preferences, 90-day TTL.
- **Email via Resend** behind an `EmailProvider` port: a delivery log, idempotency keys, and a signed and idempotent webhook. A log adapter is used when no key is set.
- **Email verification:** hashed single-use tokens, a 24 h TTL, generic errors, 3 resends per hour, and a sync to Firebase `emailVerified`.
- **Preferences, blocks, deactivation** (restored by signing in within 30 days), **public profiles** (Hood-scoped and block-aware), and **feedback**.
- **Migrations** (`pnpm migrate:dry` / `pnpm migrate`):
  - 001: users status split (`banned` → `suspended`).
  - 002: Hood `status`.
  - 003: post fields parsed from `content`.
  - 004: `likes[]` → `reactions`.

  A dry run on 29 Sep against the dev database (nothing written) reported 19 users, 22 Hoods, 9 posts and 6 likes to migrate.

### Removed or changed behaviour
- `app.service.ts` and the old e2e specs, which asserted the vulnerable behaviour, are removed.
- The `svix` dependency is replaced by a small node-crypto verifier, because svix 2.6 is ESM-only and breaks the CommonJS build.
- `dist/` is cleaned on every build (`nest-cli.json`), so deleted modules don't ship.

### Web changes that shipped with it
- `ENDPOINTS` flips; `hydratePost` reads the first-class fields; reactions call `PUT`/`DELETE`; the post card uses `reactionTotal`.
- Author cards embedded by the API are remembered, so neighbours show real names instead of "Neighbour".
- `/verify-email` page and an email reminder banner with resend.
- `owner` role in the admin (team page and badges); `moderation`/`system` notification types.
- `PATCH /users/me` no longer sends `neighborhoodId`. Unit tests run in mock mode.

### Bugs found by the new tests
- A duplicate report was caught *inside* a Mongo transaction. The server had already aborted the transaction, so the driver retried forever and the request hung. The error now propagates out of the transaction.
- `GET /admin/settings` lacked `coverageCities`, and `PATCH` rejected the web's full settings object (labels and coverage). Both are fixed and covered by `admin-contract`.

### Still to do
- **Before production:**
  1. Paste a complete Resend sending-only key.
  2. Add the `mail.myhoodora.com` DNS records.
  3. Create the webhook and set `RESEND_WEBHOOK_SECRET`.
  4. Run `pnpm migrate`.
  5. Rotate the MongoDB password shared earlier.
- **Pass 2:**
  - Marketplace, groups, chat and Business Pages.
  - Inbound contact, careers and AI pilot, with `admin.inbox`/`admin.signups`.
  - Hood Leads voting, appeals, an owner UI, and telemetry.
