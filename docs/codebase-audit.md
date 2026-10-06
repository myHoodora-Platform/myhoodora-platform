# Codebase audit and fix plan

_Audited 5 October 2026 against `development` at commit `c1a1811`. Nothing in this page has been fixed yet unless the status table says so._

_Implementation began on 6 October 2026. The status table below reflects it; the detail (what was built, how it was tested, what was verified and what was not) is in [implementation-progress.md](./implementation-progress.md), and things found along the way, including four places where this page's recommendation was changed, are in [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md). "Implemented, not yet merged" means the change and its tests are in the working tree and pass locally: there is no pull request number to record yet._

This page records a technical audit of the repository: what is wrong, how serious it is, in what order to fix it, and how. It is written for engineers and coding agents who were not part of the audit, so every finding names its files and says how it was established.

## How to use this page

- **Pick work from the [status table](#status-table)**, in the order given under [Fix order](#fix-order). Each ID links to a full entry.
- **Re-check before you fix.** Line numbers are from commit `c1a1811` and will drift. Open the file and confirm the problem is still there. If it is gone, mark the row "No longer applies" with the commit that removed it.
- **Write the regression test first.** Each entry lists the test that should fail before the fix and pass after.
- **Update this page in the same pull request**: set the status, and add the pull request number. Also update the pages the change makes untrue (`security.md`, `api-contract.md`, `current-state.md`, `backlog-status.md`).
- **Respect the grouping rules** under [Dependency graph](#dependency-graph). Some fixes must ship together and some must not.
- When every P0 to P2 row is closed, move this file to `archive/` with its date, as `docs/README.md` asks.

**Confidence labels**

| Label | Meaning |
| --- | --- |
| Confirmed | Established by reading the code path end to end |
| Likely | The mechanism is confirmed in code; how often it bites was not measured |
| Suspected | Inferred from partial evidence; verify before acting |

## Scope and limits

The audit was read-only. The test suites and the build were not run, and no hosting, Firebase, Atlas or Cloudinary dashboard was inspected.

Read in full:

- API: bootstrap, configuration, the four global guards, auth, users, hoods, posts, comments, groups, chat, listings, moderation (reports, Hood Leads, appeals), notifications, storage, realtime, webhooks, email verification, the admin controllers.
- Web: `src/proxy.ts`, the session routes, the API client, `AuthContext`, the session helpers.
- CI workflow, Husky hooks, package manifests, the docs in this directory.

Skimmed or not read: `inbound.service.ts`, `businesses.service.ts`, `admin-read.service.ts`, `broadcasts.service.ts`, `event-reminders.service.ts`, the Cloudinary adapter, most web feature components, `packages/ui`, `apps/mobile`. Findings in those areas are absent because they were not examined, not because they are clean.

## Summary

**Overall health: Fair.** Code quality is good: clear module boundaries, one capability-based authorisation model, whitelist validation everywhere, real integration tests, and honest documentation. Production readiness is lower, for three reasons:

1. **One exposed credential.** Commits documented as containing a real storage key are on the remote.
2. **Trust and privacy gaps in the core promise.** Hood membership is self-asserted, revoking verification leaves read access, and deactivation neither hides posts nor deletes data.
3. **Operational weak points.** A Google outage signs users out, alert fan-out runs inside the request, and rate limits are keyed on IP for traffic that comes straight from browsers.

## Status table

Statuses: Open · In progress · Implemented, not yet merged · Fixed (PR #) · No longer applies · Won't fix (reason).

| ID | Sev | Title | Confidence | Status |
| --- | --- | --- | --- | --- |
| [B1](#b1) | P0 | Storage credential in remote git history, rotation outstanding | Confirmed (rotation state unknown) | Open: rotation outstanding (needs the account owner). Secret scanning added to CI |
| [B2](#b2) | P1 | A failed Firebase lookup signs everyone out | Confirmed | Implemented, not yet merged |
| [B3](#b3) | P1 | Hood membership is self-asserted and unlimited | Confirmed | Implemented in part, not yet merged. Open: confirmed email (a decision) |
| [B4](#b4) | P1 | Rejecting a verification does not remove Hood read access | Confirmed | Implemented, not yet merged |
| [B5](#b5) | P1 | Deactivation leaves posts visible and never deletes anything | Confirmed | In progress: hiding implemented, not yet merged. Deletion not started (irreversible; awaits a decision) |
| [B6](#b6) | P1 | Alert notifications are sent inside the POST request | Confirmed (threshold unmeasured) | Implemented, not yet merged |
| [B7](#b7) | P1 | Per-IP rate limits versus direct browser traffic | Likely | Implemented in part, not yet merged. Deferred: Redis counters. Open: measured limits |
| [B8](#b8) | P2 | Reports on an already-decided case are swallowed | Confirmed | Implemented, not yet merged |
| [B9](#b9) | P2 | Suspended users cannot appeal their suspension | Confirmed | Implemented, not yet merged |
| [B10](#b10) | P2 | Conversations stop showing new messages after 500 | Confirmed | Implemented, not yet merged (default page stays 500; see notes) |
| [B11](#b11) | P2 | The person who started a conversation cannot report it | Confirmed | Implemented, not yet merged |
| [B12](#b12) | P2 | Uploads need no capability and have no per-user quota | Confirmed | Implemented, not yet merged |
| [B13](#b13) | P2 | Media is never deleted with its content | Confirmed | Open: deferred with the B5 deletion job |
| [B14](#b14) | P2 | Unauthenticated geocoding proxies on the web server | Confirmed | Implemented, not yet merged. Open: IP lookup licence (a decision) |
| [B15](#b15) | P2 | Moderators receive home addresses the contract reserves for admins | Confirmed | Implemented, not yet merged (contract as written). Open: addresses in verification attempts (a decision) |
| [B16](#b16) | P2 | CI does not run on pushes to the working branch | Confirmed | Implemented, not yet merged. Needs a green run on GitHub |
| [B17](#b17) | P2 | Node 20 is past end of life | Confirmed | Implemented, not yet merged. Not run on Node 24; hosts still to move |
| [B18](#b18) | P3 | Group notifications can exceed length limits after the action committed | Confirmed | Implemented, not yet merged |
| [B19](#b19) | P3 | A group can be left with no members and no admin | Confirmed | Implemented, not yet merged |
| [B20](#b20) | P3 | Overturning a "keep" removes content without telling the author | Confirmed | Implemented, not yet merged |
| [B21](#b21) | P3 | Bulk neighbour actions stop midway with no per-item result | Confirmed | Implemented, not yet merged |
| [B22](#b22) | P3 | Hood resize skips the overlap check; legacy Hood writes are unaudited | Confirmed | Implemented, not yet merged |
| [B23](#b23) | P3 | "Profile visibility" setting has no effect | Confirmed | Open: needs a decision (implement or remove the controls) |
| [B24](#b24) | P3 | Some staff actions write their audit record outside the transaction | Confirmed | Implemented, not yet merged |
| [B25](#b25) | P3 | Express 5 declared, Express 4 running | Suspected hazard | Open: deferred to the hardening phase |

## Architecture as audited

- **Monorepo.** pnpm workspaces and Turborepo. `apps/api` is NestJS 10 on MongoDB through Mongoose 9. `apps/web` is Next.js 16 (React 19, Tailwind 4). `packages/ui` holds shared components. `apps/mobile` is an Expo starter outside the workspace.
- **API request path.** Four global guards run in order ([app.module.ts:83-86](../apps/api/src/app.module.ts#L83-L86)): `ThrottlerGuard`, `FirebaseAuthGuard`, `AccountGuard`, `CapabilityGuard`. A global `ValidationPipe` whitelists input, and `AllExceptionsFilter` shapes every error.
- **Authorisation.** Capabilities are derived from role, account status and verification status in [roles.ts](../apps/api/src/shared/authz/roles.ts). Controllers declare `@Can(...)`. Record-level rules (own post, same Hood, blocked) live in each service's `loadVisible`.
- **Identity on a request.** `AccountGuard` loads the user document once and attaches `request.viewer` ([account.guard.ts](../apps/api/src/shared/auth/account.guard.ts)). `viewer.hoodId` is the user's `neighborhoodId`. Every Hood-scoped read uses it.
- **Data.** About 25 collections with string foreign keys and soft deletes. Counters (comment count, reaction counts, member count) are kept in transactions. Migrations are code under `apps/api/src/database/migrations`; missing indexes are created at boot.
- **Web.** Client-rendered pages call the API from the browser with a Firebase ID token ([client.ts](../apps/web/src/lib/api/client.ts)). `src/proxy.ts` decides which pages to serve from an HttpOnly Firebase session cookie that the API mints. Every web API module has a second, mock code path behind `isLive()`.
- **Realtime.** One Server-Sent Events stream per tab carrying id-only hints, fanned out over Redis, MongoDB change streams, or memory.
- **Background work.** In-process timers only: upload sweeps, event reminders, broadcast batches. There is no job queue.
- **External services.** Firebase Auth, MongoDB Atlas, Cloudinary, Resend, Redis, maps.co, ip-api.com, OpenFreeMap.

## What is sound

These were checked and need no change. They are listed so nobody re-audits them.

- Hood scope always comes from the server-side viewer, never from a client parameter.
- DTO whitelisting rejects forged fields (`authorUid`, `likes`, `neighborhoodId` on profile updates).
- Resend webhooks are verified on the raw body with a five-minute replay window ([webhook-signature.ts](../apps/api/src/communications/webhook-signature.ts)).
- Email verification tokens are random, hashed at rest, single-use and expiring.
- The link-import downloader re-checks every redirect hop and refuses private addresses ([remote-file.ts](../apps/api/src/storage/remote-file.ts)). HTTPS certificate validation makes DNS rebinding impractical.
- The session cookie design is correct: `__Host-` prefix, same-origin checks on the two cookie routes, a new cookie per sign-in.
- `safeNextPath` only allows redirects inside the app.
- Staff role changes and moderation decisions are transactional and audited, with rank checks.

## Bugs

### P0

<a id="b1"></a>
#### B1 — Storage credential in remote git history, rotation outstanding

- **Location:** commits `532fc3c` and `a8fa360` (`apps/api/.env.example`); [backlog-status.md](./backlog-status.md), [security.md](./security.md).
- **Problem:** `security.md` states that a real `CLOUDINARY_URL` was committed in those commits, and that a MongoDB password "was shared in plain text during development". Both rotations are listed as outstanding.
- **Why it matters:** anyone with read access to the repository, now or later, can read, overwrite or delete every stored photo and video and run up the Cloudinary bill. The MongoDB password gives full database access.
- **How it occurs:** clone the repository and read history.
- **Evidence:** `git branch -r --contains` shows both commits on `origin/main`, `origin/development`, `origin/refactoring` and `origin/web`. The docs warned "do this before pushing those commits anywhere". The audit did not print the value and cannot tell whether rotation has happened since.
- **Fix:**
  1. Generate a new Cloudinary API key and delete the old one.
  2. Change the Atlas database user's password.
  3. Update the API host's environment and every local `.env`.
  4. Add secret scanning to CI (gitleaks, or GitHub push protection) so it cannot recur.
  5. Rewriting history is optional once the old keys are dead.
- **Side effects:** the API must be restarted with the new values. Existing media URLs keep working.
- **Tests:** the old key is refused by Cloudinary; an upload and a delete succeed through the API with the new one.

### P1

<a id="b2"></a>
#### B2 — A failed Firebase lookup signs everyone out

- **Location:** [session-revocation.service.ts:71-82](../apps/api/src/auth/session-revocation.service.ts#L71-L82), [firebase-auth.guard.ts:56-73](../apps/api/src/shared/auth/firebase-auth.guard.ts#L56-L73), [AuthContext.tsx:144-151](../apps/web/src/context/AuthContext.tsx#L144-L151) and [183-190](../apps/web/src/context/AuthContext.tsx#L183-L190), [session-gate.ts:86](../apps/web/src/lib/auth/session-gate.ts#L86).
- **Problem:** when `getUser()` fails for any reason other than "user not found", the revocation service rethrows. The guard wraps token verification and the revocation check in one `try`, and its `catch` turns every error into `401 Invalid or expired token`.
- **Why it matters:** the web treats any 401 as a dead session. `loadProfile` calls Firebase `signOut()`, the session sync reports "rejected", and the proxy deletes the cookie. A few seconds of Google unavailability or quota exhaustion logs out every user whose 30-second cache entry lapsed in that window.
- **How it occurs:** a network blip from the API host to Google, an Identity Toolkit quota error, or a failure to fetch Google's signing certificates.
- **Evidence:** the comment at line 78-79 says "the request fails", which is the intent, but the guard cannot tell that failure from a bad token.
- **Fix (API only):**
  1. Give the revocation service a typed error for "couldn't find out" (for example `RevocationLookupUnavailable`).
  2. In the guard, split the `try`: token verification failures stay 401; the typed error becomes `ServiceUnavailableException` (503).
  3. Treat certificate-fetch failures in `verifyIdToken` the same way. Check which error codes `firebase-admin` 13 uses for these before relying on a code match.
  4. Optional: when a lookup fails, serve the last known state for a bounded time (for example five minutes) instead of failing. "Sign out everywhere" and suspensions are unaffected, because `AccountGuard` reads those from our own record on every request.
- **Why the web needs no change:** `apiFetch` already treats 5xx as retryable, the session route maps anything but 401 to "unavailable", and the page gate maps it to "unknown" and lets the page load.
- **Side effects:** with the optional stale read, a session revoked directly in Firebase may be served slightly longer during an outage.
- **Tests:** extend `test/helpers/firebase-mock.ts` so `getUser` can throw a non-`auth/user-not-found` error. An e2e test expects 503, not 401. A web unit test asserts a 503 on `/users/me` does not sign out.

<a id="b3"></a>
#### B3 — Hood membership is self-asserted and unlimited

- **Location:** [users.service.ts:205-244](../apps/api/src/users/users.service.ts#L205-L244), [hoods.controller.ts:39-55](../apps/api/src/hoods/hoods.controller.ts#L39-L55), [roles.ts:81-94](../apps/api/src/shared/authz/roles.ts#L81-L94).
- **Problem:** `POST /users/me/verify-location` takes `lat` and `lng` from the request body and sets `verificationStatus: "verified"` plus the matching Hood immediately. A verified user can call it again to move to another Hood. The only limit is 10 calls a minute. A confirmed email is not required for anything: `capabilitiesOf` ignores it.
- **Why it matters:** "posts are private to their Hood" is the product's core promise. Any signed-up account can read any Hood's posts, alerts, listings and neighbour list, and can message residents.
- **How it occurs:** `GET /neighborhoods` returns every Hood's centre and radius to any signed-in user. Post those coordinates to `verify-location`. Repeat for the next Hood.
- **Evidence:** `verifyLocation` has no accuracy, cooldown or prior-state check. `changedHood` is computed only to reset `verifiedAt`.
- **Note:** this is the documented MVP design (address match, with stronger methods post-MVP), not a coding slip. It is listed as a bug because the cooldown and the geometry leak are cheap to fix and the consequence is severe.
- **Fix (minimum):**
  1. In `verifyLocation`, when the user is already verified and the match is a different Hood, do not switch. Refuse with 409 unless `verifiedAt` is older than a configurable cooldown (suggest 90 days), or route the move to staff. Staff `change_hood` stays as it is.
  2. Write an audit record for every self-service Hood change.
  3. In `GET /neighborhoods`, `/neighborhoods/nearby` and `/neighborhoods/:id`, return geometry only to staff and to verified members for their own Hood. Everyone else gets id, name and city. The only non-admin web caller that needs geometry is the alerts map, for the member's own Hood ([alerts-page.tsx:65-72](../apps/web/src/features/alerts/alerts-page.tsx#L65-L72)).
  4. **Decision needed:** require a confirmed email before `content.create` and `messages.send`. This changes behaviour for existing unconfirmed accounts; the verification banner already exists.
- **Real fix:** stronger verification (phone, invite, estate code), already on the post-MVP roadmap.
- **Side effects:** people who genuinely move need a support path. Ship behind a flag (see [Risk and rollback](#risk-and-rollback)).
- **Tests:** e2e: a verified user posting another Hood's coordinates is refused; an unverified caller receives no geometry; a staff `change_hood` still works.

<a id="b4"></a>
#### B4 — Rejecting a verification does not remove Hood read access

- **Location:** [staff-users.service.ts:146-149](../apps/api/src/users/staff-users.service.ts#L146-L149), [account.guard.ts:34-40](../apps/api/src/shared/auth/account.guard.ts#L34-L40), [posts.service.ts:233-235](../apps/api/src/posts/posts.service.ts#L233-L235) and [264-269](../apps/api/src/posts/posts.service.ts#L264-L269).
- **Problem:** `reject_verification` sets `verificationStatus` and leaves `neighborhoodId` in place. `AccountGuard` copies `neighborhoodId` into `viewer.hoodId` whatever the status. Feed, single post, comments, listings, neighbour search, groups and the realtime Hood channel check only `viewer.hoodId`.
- **Why it matters:** rejection is the staff remedy for a fake neighbour (see B3). The person loses posting and messaging but keeps reading everything, indefinitely. `verifyLocation` also blocks a rejected user from re-verifying, so the state is permanent.
- **How it occurs:** staff reject a previously verified user.
- **Evidence:** no read path checks `verificationStatus`. `capabilitiesOf` gates writes only.
- **Fix:**
  1. In `AccountGuard`, set `hoodId` to `doc.neighborhoodId` only when `verificationStatus === "verified"`, otherwise null. Staff reads already bypass the Hood check through `admin.access`.
  2. In `reject_verification`, also clear `neighborhoodId`. Keep the old value in a separate field (for example `lastNeighborhoodId`) if staff need the history.
  3. `tellNeighbour` already publishes `session.changed`, so open tabs reconnect without the Hood channel.
- **Before enabling:** count affected accounts with `db.users.countDocuments({ neighborhoodId: { $nin: [null, ""] }, verificationStatus: { $ne: "verified" } })`.
- **Side effects:** users whom staff moved with `change_hood` while unverified lose read access until verified. Decide whether `change_hood` should also verify.
- **Tests:** e2e: after `reject_verification`, the feed, a post, listings, `/users/search` and `/groups` return 404 or empty for that user.

<a id="b5"></a>
#### B5 — Deactivation leaves posts visible and never deletes anything

- **Location:** [users.service.ts:395-399](../apps/api/src/users/users.service.ts#L395-L399) and [108-112](../apps/api/src/users/users.service.ts#L108-L112), [posts.service.ts:237-243](../apps/api/src/posts/posts.service.ts#L237-L243), [users.service.ts:422-429](../apps/api/src/users/users.service.ts#L422-L429), [account-settings.tsx:55](../apps/web/src/features/settings/account-settings.tsx#L55), [privacy-policy.tsx:128](../apps/web/src/components/legal/privacy-policy.tsx#L128).
- **Problem:** deactivating only sets `deactivatedAt` and revokes sessions.
  - The feed filter does not look at it, and `authorCards` still returns the name and photo, so the person's posts stay visible under their name.
  - No job deletes or anonymises anything.
  - Signing in clears `deactivatedAt` at any time, not just within 30 days.
  - The `details` field of the request is dropped; only `reason` is logged.
- **Why it matters:** the settings dialog says "your profile and posts will be hidden from neighbours". The privacy policy says that after 30 days "we delete or anonymise your personal data". Neither is true. This is a privacy and NDPA exposure.
- **How it occurs:** every deactivation.
- **Evidence:** a search of `apps/api/src` for any purge, delete-user or 30-day cleanup code found none.
- **Fix, in two separately shipped steps:**
  1. **Hide.** On deactivate, flag the user's posts and listings (for example `authorDeactivated: true`) and add that to the feed and listing filters; unset it on restore. For comments, group posts and conversations, return an anonymous author card ("Former neighbour", no photo) from `authorCards` when the author is deactivated. Filtering at query time by author would break page sizes, which is why a flag on the content is suggested.
  2. **Delete.** A daily job selects users with `deactivatedAt` older than 30 days and no `purgedAt`, then for each: deletes their stored media, soft-deletes their posts, listings and comments, removes group memberships (handing off or archiving groups where they are the only admin), Hood Lead roles and notifications, anonymises the user document (email, name, photo, bio, location, attempts, blocks, preferences), deletes the Firebase user, and sets `purgedAt`. Moderation cases and audit events keep the uid only.
  3. In `getOrCreateMe`, refuse to restore an account that is past the window or purged.
- **Decision needed:** what happens to the other party's copy of conversations, and whether moderation records may be kept. Confirm with the lawyer review already listed in `backlog-status.md`.
- **Side effects:** deletion is irreversible. Run the job in dry-run mode first (see [Risk and rollback](#risk-and-rollback)).
- **Tests:** e2e: a deactivated user's posts are absent from the feed and their card is anonymous in comments. Unit tests for the job with a fake clock at 29 and 31 days. Restoration inside and outside the window.

<a id="b6"></a>
#### B6 — Alert notifications are sent inside the POST request

- **Location:** [posts.service.ts:159-181](../apps/api/src/posts/posts.service.ts#L159-L181) and [213-227](../apps/api/src/posts/posts.service.ts#L213-L227), [notifications.service.ts:56-89](../apps/api/src/notifications/notifications.service.ts#L56-L89), [client.ts:48](../apps/web/src/lib/api/client.ts#L48).
- **Problem:** after the post document is created, `create()` awaits `notifyAlert`, which loads up to 5,000 Hood members and calls `notify()`. `notify()` loops one recipient at a time, with one or two database round trips each and an inline email send where preferences allow.
- **Why it matters:** the web aborts a request after 15 seconds. In a Hood of a few hundred members or more, the request times out after the post already exists, so the user retries and creates a duplicate alert. If `notify` throws midway, the client gets a 500 for a post that was created.
- **How it occurs:** any alert in a larger Hood; sooner on a slow link to Atlas.
- **Evidence:** sequential `await` inside the `for` loop; the create happens before the notify; there is no idempotency key. The member count at which it breaks was not measured.
- **Fix:**
  1. Return the response once the post is created. Run the fan-out afterwards, through the job runner described under [Architecture improvements](#architecture) (an un-awaited call with error logging is an acceptable first step, but it loses work on a restart).
  2. Batch the writes. `notifyBulk` already uses `insertMany` for broadcasts. The grouped case (`groupKey`) can be one `bulkWrite` of upserts per batch.
  3. Add an optional client-generated id to `CreatePostDto`, with a unique sparse index on author plus that id. On a duplicate-key error, return the existing post. The web generates the id once per composer submit and reuses it on retry.
- **Side effects:** notifications arrive seconds after the post. Fan-out failures need logging and retry.
- **Tests:** e2e with 2,000 members asserting the response time and that each member has exactly one notification. A retried POST with the same client id returns the same post.

<a id="b7"></a>
#### B7 — Per-IP rate limits versus direct browser traffic

- **Location:** [app.module.ts:47-52](../apps/api/src/app.module.ts#L47-L52), [rsvp-buttons.tsx:29](../apps/web/src/features/events/rsvp-buttons.tsx#L29), [client.ts:50-56](../apps/web/src/lib/api/client.ts#L50-L56).
- **Problem:**
  - The global limits are 10 per second, 60 per minute and 500 per hour per IP, and `ThrottlerGuard` runs before authentication.
  - Browsers call the API directly, so everyone behind one NAT address shares a bucket.
  - The events UI makes one RSVP request per event card.
  - The client maps 429 to the generic "client" kind, shows the throttler's raw message, and does not retry.
  - Counters are in memory per API instance, so the effective limit changes with the number of instances.
- **Why it matters:** Nigerian mobile carriers use carrier-grade NAT heavily, and offices and estates share Wi-Fi. Legitimate users will see errors, clustered in the dense areas the product targets.
- **How it occurs:** several users on one IP, or one user on a page with many event cards on top of the shell's mount requests.
- **Evidence:** the mechanism is in the code; the frequency was not measured. Measure a feed and an events page load in the browser's network panel before choosing numbers.
- **Fix:**
  1. Key the real limits on the user. Token verification is local and cheap, so one option is to run throttling after `FirebaseAuthGuard` with the tracker set to the verified uid (IP for `@Public()` routes), plus a separate, generous pre-auth IP limit as a flood guard. The per-credential tracker on the session routes ([auth.controller.ts:21-26](../apps/api/src/auth/auth.controller.ts#L21-L26)) stays.
  2. With more than one instance, back the counters with Redis (already a dependency).
  3. Embed the viewer's RSVP summary in `PostView` for event posts, as poll results already are, and remove the per-card request.
  4. In the web client, add a rate-limited error kind with a friendly message and retry reads with backoff. To honour the server's retry header, expose it through CORS (`exposedHeaders` in `main.ts`); check the header names the installed throttler version sends.
- **Side effects:** limits need tuning after measurement.
- **Tests:** e2e: two uids on one IP do not starve each other; a public route is still limited per IP. A count of requests on feed mount as a guard against regressions.

### P2

<a id="b8"></a>
#### B8 — Reports on an already-decided case are swallowed

- **Location:** [moderation.service.ts:115-149](../apps/api/src/moderation/moderation.service.ts#L115-L149).
- **Problem:** there is one case per reported item (unique on type plus id). A new report reopens the case only when its status is `dismissed` (line 143). If the earlier decision was warn, restrict or suspend, the content stays up but the case stays `resolved`. The same happens when removed content is later restored.
- **Why it matters:** content whose author was once warned can never re-enter the staff queue. Reporters hear nothing.
- **How it occurs:** staff warn an author; a week later someone else reports the same post.
- **Fix:** also reopen when the status is `resolved` and the target is still visible (`snap.removed === false`). Keep the previous `resolution` as the last decision and record `reopenedAt`, so the author's right to appeal the earlier decision is not lost.
- **Side effects:** more queue volume. Appeals are unique per case and person, so someone who appealed the first decision cannot appeal a second one; keying appeals by decision is a follow-up.
- **Tests:** e2e: warn the author, a second user reports, the case is in the active queue.

<a id="b9"></a>
#### B9 — Suspended users cannot appeal their suspension

- **Location:** [moderation.controller.ts:75-88](../apps/api/src/moderation/moderation.controller.ts#L75-L88), [appeals.service.ts:17](../apps/api/src/moderation/appeals.service.ts#L17), [account.guard.ts:56-59](../apps/api/src/shared/auth/account.guard.ts#L56-L59).
- **Problem:** `suspend_author` is in the appealable list, and overturning it reinstates the account. But `GET /moderation/my-decisions` and `POST /moderation/cases/:id/appeals` are not marked `@AllowSuspended()`, so `AccountGuard` answers 403. Only `/users/me`, deactivate, the two session routes and logout-everywhere are allowed.
- **Why it matters:** the appeal path is unreachable for the people it matters most to.
- **Fix:** add `@AllowSuspended()` to those two routes and to the notification list and unread count. Confirm the web's suspended screen links to the decisions page (not inspected in this audit).
- **Side effects:** none of note; both routes are scoped to the caller's own uid.
- **Tests:** e2e: a suspended user lists decisions and files an appeal; an admin overturn reinstates them.

<a id="b10"></a>
#### B10 — Conversations stop showing new messages after 500

- **Location:** [chat.service.ts:167](../apps/api/src/chat/chat.service.ts#L167). Same pattern in [comments.service.ts:70-75](../apps/api/src/comments/comments.service.ts#L70-L75).
- **Problem:** messages are read oldest-first with `limit(500)` and no cursor. Message 501 onward is stored and never returned.
- **Why it matters:** an active pair of neighbours loses the ability to see new messages. Comments behave the same on a very busy post.
- **Fix:** read the newest N (suggest 50) sorted descending, reverse before returning, and accept a `before` cursor for older pages. Do the same for comments. Web: `lib/api/chat.ts` and `features/chat/conversation-thread.tsx` need a "load earlier" control.
- **Side effects:** the default response changes from the oldest 500 to the newest N. Deploy the web change with or straight after the API.
- **Tests:** e2e with 501 messages asserting the newest is returned and the cursor reaches the oldest.

<a id="b11"></a>
#### B11 — The person who started a conversation cannot report it

- **Location:** [chat.service.ts:65](../apps/api/src/chat/chat.service.ts#L65), [moderation.service.ts:97](../apps/api/src/moderation/moderation.service.ts#L97), [conversation-thread.tsx:185](../apps/web/src/features/chat/conversation-thread.tsx#L185).
- **Problem:** a message report targets the conversation id. The snapshot sets `authorUid` to `startedBy`, and `fileReport` refuses reports on "your own content". Separately, `fileReport` never checks that the reporter is in the conversation.
- **Why it matters:** a buyer who messages a seller and is harassed or scammed in reply cannot report it. In the other direction, anyone who learns a conversation id can expose its last 20 messages to staff.
- **Fix:** for the `message` type, require the reporter to be a participant (404 otherwise) and treat the other participant as the reported person. Store the reported uid on each report row, since both sides may report the same conversation.
- **Tests:** e2e: the starter can report; the recipient can report; an outsider gets 404.

<a id="b12"></a>
#### B12 — Uploads need no capability and have no per-user quota

- **Location:** [storage.controller.ts:39-42](../apps/api/src/storage/storage.controller.ts#L39-L42), [80](../apps/api/src/storage/storage.controller.ts#L80) and [119](../apps/api/src/storage/storage.controller.ts#L119).
- **Problem:** `POST /media`, `/media/import` and `/media/direct` carry no `@Can`. Any freshly created account, including unverified and restricted ones, can upload 100 MB videos and trigger server-side downloads, 30 a minute.
- **Why it matters:** storage and bandwidth cost, and a free file host for anyone who signs up.
- **Fix:** the purpose arrives in the body, so check it in the controller: `post`, `listing` and `group` need `content.create`; `avatar` needs only `profile.manage` (onboarding sets a photo before verification). Add a daily count and byte quota per uid from `media_assets`, with an index on owner plus creation time.
- **Side effects:** restricted users can no longer upload post media, which matches their inability to post.
- **Tests:** e2e per purpose and account state; the quota boundary.

<a id="b13"></a>
#### B13 — Media is never deleted with its content

- **Location:** [posts.service.ts:283-288](../apps/api/src/posts/posts.service.ts#L283-L288), [listings.service.ts:164-169](../apps/api/src/listings/listings.service.ts#L164-L169). `discardByUrl` is called from one place only, [users.service.ts:178](../apps/api/src/users/users.service.ts#L178).
- **Problem:** deleting a post or listing, or a staff removal, leaves its Cloudinary files reachable by URL forever.
- **Why it matters:** a neighbour who deletes a photo of their home or children expects it to be gone. It also accumulates storage cost.
- **Fix:** on author delete, discard the media after a short grace period. On staff removal, keep it until the 30-day appeal window closes, then discard. Add a periodic sweep for `media_assets` rows no content references. Share the mechanism with the deletion job in B5.
- **Side effects:** content restored after its grace period comes back without media.
- **Tests:** unit tests against the fake provider; e2e: delete a post, the asset row and file are gone after the grace period.

<a id="b14"></a>
#### B14 — Unauthenticated geocoding proxies on the web server

- **Location:** [api/geocode/route.ts](../apps/web/src/app/api/geocode/route.ts), [api/ip-location/route.ts:44-56](../apps/web/src/app/api/ip-location/route.ts#L44-L56), `api/reverse-geocode/route.ts` (not read; assumed to share the pattern), [proxy.ts:121](../apps/web/src/proxy.ts#L121).
- **Problem:** the proxy's matcher excludes `/api/`, and these handlers have no authentication or throttling. Anyone can spend the maps.co key's quota. `ip-location` forwards the first `X-Forwarded-For` value to ip-api.com over plain HTTP with no timeout; that service's free tier is rate-limited and restricted to non-commercial use.
- **Fix:** require a valid session cookie in each handler (`verifySessionCookie` from `lib/auth/session-cookie.ts`; skip in mock mode), add a per-IP limit and a fetch timeout, and replace or license the IP lookup. All three routes are called only from the signed-in onboarding page ([onboarding/page.tsx:159](../apps/web/src/app/onboarding/page.tsx#L159), [192](../apps/web/src/app/onboarding/page.tsx#L192), [252](../apps/web/src/app/onboarding/page.tsx#L252)), so requiring a session should not break a public page.
- **Tests:** route tests: 401 without a session, 200 with one, a timeout path.

<a id="b15"></a>
#### B15 — Moderators receive home addresses the contract reserves for admins

- **Location:** [admin.controllers.ts:134-148](../apps/api/src/admin/admin.controllers.ts#L134-L148), [api-contract.md:667](./api-contract.md#L667).
- **Problem:** `GET /admin/neighbours/:uid` returns `location.address` and the coordinates of every verification attempt to anyone with `admin.access`. The contract says the address is for admins only.
- **Decision needed:** moderators hold `verification.review`, and the verification queue also shows addresses, so they need some address access to do that job. Either narrow the detail endpoint to a capability, or correct the contract.
- **Tests:** e2e per role once the rule is decided.

<a id="b16"></a>
#### B16 — CI does not run on pushes to the working branch

- **Location:** [ci.yml:3-8](../.github/workflows/ci.yml#L3-L8), [README.md](../README.md).
- **Problem:** the workflow triggers on pushes to `main` and `develop`. The working branch is `development`, and no `develop` branch exists locally or on the remote. The README tells contributors to branch from `develop`. `backlog-status.md` also notes the workflow "has not run on GitHub yet".
- **Fix:** use one branch name in the workflow, the README and the contributing notes. Confirm a green run.
- **Tests:** push a no-op commit and watch the workflow.

<a id="b17"></a>
#### B17 — Node 20 is past end of life

- **Location:** [package.json:22-24](../package.json#L22-L24), [ci.yml:31](../.github/workflows/ci.yml#L31) and [77](../.github/workflows/ci.yml#L77).
- **Problem:** `engines` pins `20.x` and CI installs 20. Node 20 left support in April 2026 and no longer receives security fixes.
- **Fix:** move `engines`, CI and the hosts to a supported LTS line and run the full suite.
- **Side effects:** native modules (`sharp`, `mongodb-memory-server`) rebuild. Check Jest 29 and ts-jest on the new version. Do this in its own pull request, with no behaviour change.

### P3

<a id="b18"></a>
#### B18 — Group notifications can exceed length limits after the action committed

- **Location:** [groups.service.ts:305-313](../apps/api/src/groups/groups.service.ts#L305-L313) and [354-361](../apps/api/src/groups/groups.service.ts#L354-L361), [notification.schema.ts:24-28](../apps/api/src/notifications/notification.schema.ts#L24-L28), [groups.dto.ts:47-49](../apps/api/src/groups/groups.dto.ts#L47-L49).
- **Problem:** a 60-character display name plus a 60-character group name makes the invite title 141 characters against a limit of 140. "Reason: " plus a 300-character reason exceeds the 280-character body limit. The notification write fails validation with a 400, in the removal case after the member was already removed.
- **Fix:** truncate title and body inside `notify()`. **Test:** maximum-length inputs.

<a id="b19"></a>
#### B19 — A group can be left with no members and no admin

- **Location:** [groups.service.ts:273-280](../apps/api/src/groups/groups.service.ts#L273-L280).
- **Problem:** the last-admin check only blocks leaving when other members remain. A sole member can leave, and the group stays listed with zero members. Anyone who joins later is a plain member and nobody can manage it.
- **Fix:** delete or archive the group when its last member leaves. **Test:** e2e for that case.

<a id="b20"></a>
#### B20 — Overturning a "keep" removes content without telling the author

- **Location:** [appeals.service.ts:160-169](../apps/api/src/moderation/appeals.service.ts#L160-L169).
- **Problem:** when a reporter's appeal overturns a "keep", the content is removed, but the case still records "keep" and only the appellant is notified. The author is not told and has nothing they can appeal.
- **Fix:** update the case's resolution to the new outcome and notify the author with the usual appeal notice. **Test:** e2e covering the author's notification and their ability to appeal.

<a id="b21"></a>
#### B21 — Bulk neighbour actions stop midway with no per-item result

- **Location:** [admin.controllers.ts:162-169](../apps/api/src/admin/admin.controllers.ts#L162-L169).
- **Problem:** actions run one at a time and the first failure (unknown uid, rank rule) aborts the request. Earlier actions, including their emails, have already happened, and the response does not say which.
- **Fix:** collect a result per uid and return them all. **Test:** a batch with one invalid uid.

<a id="b22"></a>
#### B22 — Hood resize skips the overlap check; legacy Hood writes are unaudited

- **Location:** [hoods.service.ts:86-90](../apps/api/src/hoods/hoods.service.ts#L86-L90), [hoods.controller.ts:57-71](../apps/api/src/hoods/hoods.controller.ts#L57-L71).
- **Problem:** creating a Hood refuses overlaps, but changing `radiusMeters` does not. `POST /neighborhoods` and `DELETE /neighborhoods/:id` duplicate the admin routes without writing an audit record.
- **Fix:** reuse `overlapping()` on resize, excluding the Hood itself. Remove the legacy write routes or make them audit. **Test:** resize into a neighbour returns 409.

<a id="b23"></a>
#### B23 — "Profile visibility" setting has no effect

- **Location:** [privacy-settings.tsx:100](../apps/web/src/features/settings/privacy-settings.tsx#L100), [users.service.ts:308-330](../apps/api/src/users/users.service.ts#L308-L330).
- **Problem:** the preference is stored and shown, but `publicProfile` never reads it. The messaging option "contacts" also behaves exactly like "nobody" ([chat.service.ts:140-141](../apps/api/src/chat/chat.service.ts#L140-L141)).
- **Fix:** implement the settings or remove the controls.

<a id="b24"></a>
#### B24 — Some staff actions write their audit record outside the transaction

- **Location:** [admin.controllers.ts:228-232](../apps/api/src/admin/admin.controllers.ts#L228-L232) and [281-291](../apps/api/src/admin/admin.controllers.ts#L281-L291), [content-actions.service.ts:19-21](../apps/api/src/admin/content-actions.service.ts#L19-L21), [leads-roster.service.ts:75-79](../apps/api/src/moderation/leads-roster.service.ts#L75-L79).
- **Problem:** the action commits, then the audit write runs separately. A failure in between leaves an unrecorded staff action.
- **Fix:** wrap each pair in `withTransaction`, as moderation decisions already do.

<a id="b25"></a>
#### B25 — Express 5 declared, Express 4 running

- **Location:** [apps/api/package.json](../apps/api/package.json), `pnpm-lock.yaml`.
- **Problem:** the API lists `express ^5.2.1` and `@types/express ^5`, but `@nestjs/platform-express` 10.4 resolves to Express 4.22. Both versions are in the lockfile, and the types describe a runtime that is not the one serving requests. No failing call was found; this is a hazard, not a known defect.
- **Fix:** align the declared Express and its types with the installed Nest major.

## Fix order

The order weighs severity, blast radius, what other fixes depend on, and how risky the change is.

1. **B1.** Independent of the code and unsafe to defer.
2. **B16, then B17.** Get CI running on the real branch, on a supported runtime, before changing behaviour. Every later fix is then verified automatically.
3. **B2.** A small API-only change with the largest blast radius.
4. **The `blockedUids` index** (see [Performance](#performance)). Risk-free and it speeds up nearly every read.
5. **B4 with B3, then B15.** One root cause: who may read a Hood. Change the guard once and add the cooldown in the same area.
6. **B6, then B7.** Both come from work done per request and accounting done per IP. The idempotency key from B6 also makes a retry after a 429 safe.
7. **B12.** Before any public launch.
8. **B5 with B13.** One deletion pipeline serves accounts and content media.
9. **B8, B9, B11, B20.** One moderation pass; they share files and tests.
10. **B10, B14, then the remaining P3s.**

## Improvements

These are not bugs. They make a working system better.

### Code quality

- **Finish the post-content migration.** Posts are stored both as a legacy `<!--mh:{…}-->` prefix in `content` and as typed fields. The legacy decode path merges unvalidated JSON into the post's metadata, and only the Mongoose schema catches bad values ([posts.service.ts:130-142](../apps/api/src/posts/posts.service.ts#L130-L142), [post-meta.ts:45-69](../apps/api/src/posts/domain/post-meta.ts#L45-L69)). Move the web composer to the typed fields, then delete the decode path. Complexity: Medium.
- **One visibility predicate.** Posts, listings, groups and chat each reimplement "same Hood, not blocked, not removed". A shared helper would have prevented B4. Complexity: Low to Medium.
- **Generated API types.** The web's `lib/api/types.ts` is hand-copied from the API's DTOs. The API already produces an OpenAPI document; generate the client types from it. Complexity: Medium.

<a id="architecture"></a>
### Architecture

- **A small job runner.** Alert fan-out (B6), emails, event reminders, upload sweeps and the deletion job (B5) all need "run later, once, with retry". A MongoDB-backed queue with atomic claims is enough at this scale; the broadcast code already does this for one case. Complexity: Medium. Several fixes above depend on it.
- **Throttling after authentication.** See B7.
- **Observability.** There are no request ids, error tracking or metrics, and the health check covers MongoDB only. Add a request id to logs and error responses, an error tracker, and health indicators for Redis and the storage provider. Complexity: Low to Medium.

### Performance

- **Unindexed block lookup on nearly every read.** `hiddenAuthorsFor` runs `find({ blockedUids: uid })` ([users.service.ts:402-408](../apps/api/src/users/users.service.ts#L402-L408)), and the user schema has no index on `blockedUids`. Feed, single post, comments, listings, groups and chat all call it, so each request scans the whole users collection. Add a multikey index on `blockedUids`. Complexity: Low. This is the highest-value item in this section.
- **Batch notification writes.** See B6.
- **Embed RSVP state in the feed response.** See B7.
- **Admin N+1 queries.** The neighbours list runs three counts per row ([admin.controllers.ts:128-132](../apps/api/src/admin/admin.controllers.ts#L128-L132)); the verification queue runs one `$geoNear` per row ([staff-users.service.ts:243-260](../apps/api/src/users/staff-users.service.ts#L243-L260)). Staff-only; Low.
- **Text search.** Post and listing search use an unanchored case-insensitive regex across the Hood's documents. Fine at MVP scale; plan a text index when Hoods grow.

### Security

- **Remote image URLs.** `mediaUrls`, listing `photos`, `photoURL` and group `coverPhoto` accept any HTTPS URL and render in neighbours' browsers, so a poster can log viewers' IP addresses from their own server. "Add from link" already imports the file into storage. Restrict stored URLs to the storage origin plus the Google avatar host, then tighten `img-src` in `next.config.js`.
- **Event stream.** The SSE stream authenticates once at connect and there is no cap on connections per user. Add a cap and a maximum lifetime that forces a reconnect.
- **CI checks.** Add a dependency audit and secret scanning. `security.md` already lists both as undecided.
- **Mock mode guard.** `NEXT_PUBLIC_USE_MOCKS=true` disables the page gate. Fail a production build when it is set.
- **Hard-coded project id fallback.** `next.config.js` and `session-cookie.ts` fall back to a specific Firebase project id when the variable is missing. Fail instead.

### Developer experience

- Local MongoDB must be a replica set, and the repository has no compose file or script for one.
- The pre-commit hook lints and type-checks the whole monorepo, which invites `--no-verify`. Scope it to changed packages.
- `start:prod` in the API runs `turbo build` before starting. `ts-node-dev` appears unused.
- The lockfile holds three versions of the `mongodb` driver.

## Product enhancements

| Enhancement | Why | Area | Depends on | Complexity | Risk |
| --- | --- | --- | --- | --- | --- |
| Account deletion and data export | Needed to match the privacy policy | users, storage, jobs | B5, job runner | Medium | Irreversible; dry-run first |
| Edit a listing | Sellers can only change status today | listings | None | Low | None notable |
| Report an individual group post | Only whole groups can be reported, so group posts are outside moderation | groups, moderation registry | None | Medium | A new target type in the enum |
| Paged comments, messages, notifications and group posts | Hard caps hide content | several | B10 | Medium | Client changes |
| Stronger verification (phone, invite, estate code) | The real fix for B3 | users, onboarding | An SMS provider | High | Cost and provider setup |
| Push or digest delivery | Preferences expose `push` and default the digest to "daily". No code that sends either was found (Suspected: searched by file name only) | notifications | Job runner | Medium to High | Provider setup |

## Technical debt

| Horizon | Debt | Why it exists | Risk if ignored | When |
| --- | --- | --- | --- | --- |
| Immediate | No deletion pipeline | Soft deletes were enough to build features | Legal exposure grows with each deactivation | Before launch |
| Immediate | Side effects run inside requests | No queue yet | Timeouts and duplicates as Hoods grow | Before launch |
| Near-term | Two post formats | Migration from the first web client | Two validation paths drift apart | After the web stops sending `content` |
| Near-term | A mock path in every web API module | Frontend was built before the API | Mock and live behaviour diverge | When resident browser tests exist |
| Near-term | In-process timers | Simplest thing for one instance | Duplicate or missed work with several instances (the reminder code documents exactly-once claims; not verified here) | Before scaling out |
| Long-term | String foreign keys with no cleanup | MongoDB default style | Orphaned rows accumulate | With the deletion pipeline |
| Long-term | NestJS 10 with version-11 satellite packages | Packages upgraded independently | Peer-dependency drift | At the next framework upgrade |

No rewrite is recommended anywhere. Each item above has an incremental path.

## Testing and reliability gaps

**What exists.** About 230 API test cases across 11 integration specs and 18 unit specs, 177 web unit tests, and 29 Playwright tests. The integration tests boot the real `AppModule` against a MongoDB replica set with only Firebase stubbed, which is a strong setup.

**What is missing**, highest value first:

1. A regression test for each bug above. B2, B4, B8, B9, B10 and B11 are a few lines each in the existing harness.
2. Firebase failure modes. The mock's `getUser` never throws a network error, which is why B2 was invisible.
3. Fan-out at scale and idempotent post creation.
4. Deactivation visibility and the deletion job.
5. A verified test resident for Playwright, so posting, commenting and uploading are browser-tested. `testing.md` already lists this gap.
6. Throttling with two users on one IP.

## Dependencies and infrastructure

| Item | Finding | Action |
| --- | --- | --- |
| Node 20 | End of life | B17 |
| Express | 5 declared, 4 running | B25 |
| `@nestjs/swagger` 11 on NestJS 10 | Known peer warning | Leave until the Nest upgrade |
| Hosting configuration | None in the repository; the runbook carries deploy order | Acceptable; nothing enforces "API first" |
| `MONGO_AUTO_INDEX` | On by default | Fine now; manage indexes outside boot once collections are large |
| `trust proxy` | `1` in production | Correct for one proxy hop. With a CDN in front, per-IP limits would key on the CDN's address |
| Rate-limit storage | In memory per instance | B7 |

No upgrade is recommended purely because a newer version exists.

## Implementation roadmap

### Phase 0 — Preparation (Low)

- Rotate credentials and add secret scanning (B1).
- Fix the CI branch name and get one green run (B16).
- Move to a supported Node line and re-run everything (B17).
- Extend the Firebase mock so it can simulate upstream failures.
- Take an Atlas backup before any phase that changes data.

### Phase 1 — Critical fixes (High)

| Task | Files | Approach | Tests | Risk | Done when |
| --- | --- | --- | --- | --- | --- |
| B2 | `firebase-auth.guard.ts`, `session-revocation.service.ts` | 503 for infrastructure errors; optional bounded stale read | e2e with a failing `getUser` | Low | An outage yields 503 and no client sign-out |
| `blockedUids` index | `user.schema.ts` | Add the multikey index | Existing suite | Low | The index exists in Atlas |
| B4, B3, B15 | `account.guard.ts`, `staff-users.service.ts`, `users.service.ts`, `hoods.controller.ts`, `roles.ts` | Hood id only when verified; clear on reject; cooldown on Hood change; hide geometry | e2e per verification status | Medium: changes who can read | A rejected user reads nothing; a Hood hop is refused |
| Job runner | New module | MongoDB-backed queue with atomic claim and retry | Unit tests with a fake clock | Medium | Jobs survive a restart and run once |
| B6 | `posts.service.ts`, `notifications.service.ts`, `posts.dto.ts`, web composer | Respond, then fan out in batches; client id for idempotency | e2e with 2,000 members | Medium | POST returns quickly; no duplicates |
| B7 | `app.module.ts`, throttling guard, `client.ts`, `PostView` | Limits per uid; Redis storage; 429 handling; embedded RSVP | e2e with two uids on one IP | Medium | A shared IP no longer starves users |
| B12 | `storage.controller.ts`, `storage.service.ts` | Capability per purpose; daily quota | e2e | Low | Unverified accounts can upload avatars only |
| B5 (hide), then B5 (delete) with B13 | `users.service.ts`, `posts.service.ts`, `listings.service.ts`, `storage.service.ts`, new job | Hide first; deletion job in dry-run, then live; media discard | e2e and fake-clock unit tests | High: irreversible | The dialog and the privacy policy are true |

### Phase 2 — Important fixes (Medium)

B8, B9, B11 and B20 as one moderation change. B10 pagination. B14 route protection. Then B18, B19, B21 to B24.

### Phase 3 — Code quality and architecture (Medium)

Shared visibility predicate, generated API types, retiring the legacy post format, observability.

### Phase 4 — Performance (Low)

Admin N+1 queries. Text index when needed.

### Phase 5 — Product enhancements (Medium to High)

Account deletion UI and export, listing edit, group-post reporting, stronger verification.

### Phase 6 — Hardening (Medium)

Restrict remote image URLs and tighten the content policy, event-stream caps, dependency audit, a resident Playwright suite, a load test, B25, and a documentation pass.

## Dependency graph

```text
B1 rotate credentials ──────────────────── independent, do now

B16 CI branch → B17 Node LTS → Firebase mock failure modes → B2

B4 (Hood id only when verified) → B3 (cooldown, hide geometry) → B15

Job runner ─┬→ B6 fan-out → post idempotency key → B7 client retry on 429
            └→ B5 deletion job → B13 media discard

B7 per-uid limits → Redis counter storage (only needed with more than one instance)

B8 → B9 → B11 → B20        one moderation change set

B10 pagination             independent
blockedUids index          independent
```

**Ship together**

- B4 and B3: the same guard and the same tests.
- B5's deletion job and B13: one discard mechanism.
- B8, B9, B11 and B20: the same files and fixtures.

**Do not combine**

- B5 hiding and B5 deleting. Ship hiding first; deleting is irreversible.
- The Node upgrade (B17) with any behaviour change.
- The rate-limit change (B7) with the fan-out change (B6), so a regression can be attributed.

## Risk and rollback

- **B4 and B3 change who can read.** Put the new behaviour behind an environment flag for one release so it can be turned off without a deploy. Count affected accounts first (query under B4).
- **The B5 deletion job is irreversible.** Run it in dry-run mode, logging counts only, for a week. Enable it with a backup taken the same day. The only rollback is restoring from that backup.
- **B6 and B7 are compatible with the "API first" deploy order.** The server changes work with the current web build. The client's 429 handling and idempotency id are additive.
- **B10 changes a default.** The messages response goes from the oldest 500 to the newest N. Deploy the web change with or immediately after the API.
- **Schema changes are additive.** New optional fields and new indexes only. No destructive migration is needed anywhere in this plan. New indexes on existing collections should be built before the code that relies on them is deployed.

## Definition of done

- Every P0 to P2 row in the status table is Fixed, No longer applies, or Won't fix with a reason.
- Each fix has a regression test that failed before it and passes after.
- CI is green on the working branch on a supported Node line.
- A rejected or unverified account receives no Hood content from any endpoint.
- A simulated Firebase outage produces 503 responses and no sign-outs.
- An alert in a 2,000-member Hood returns quickly and notifies each member exactly once.
- The deactivation dialog and the privacy policy describe what the system does.
- `security.md`, `api-contract.md`, `current-state.md` and `backlog-status.md` were updated in the same pull requests as the behaviour they describe.

**Estimated complexity by phase:** 0 Low · 1 High · 2 Medium · 3 Medium · 4 Low · 5 Medium to High · 6 Medium.
