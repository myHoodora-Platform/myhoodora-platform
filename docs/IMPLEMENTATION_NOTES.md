# Implementation notes

_Things found while implementing [codebase-audit.md](./codebase-audit.md) that the audit did not record. Started 6 October 2026. Progress per audit item is in [implementation-progress.md](./implementation-progress.md)._

Three kinds of entry:

- **[Decisions](#decisions)**: the questions only the owner could answer, how they were answered, and how each answer was read.
- **[Corrections to the audit](#corrections-to-the-audit)**: where the audit's recommendation did not match the code, what was done instead, and why.
- **[New findings](#new-findings)**: problems outside the task in hand. Recorded and, unless stated, not fixed, so that each change stays reviewable.

## Decisions

All seven were answered by the owner on 7 October 2026. Two answers were read narrowly; those readings are marked, so they can be corrected.

| # | Question | Audit item | Answer | What the code does now |
| --- | --- | --- | --- | --- |
| 1 | Have the Cloudinary key and the Atlas password been replaced? | B1 | Mark them as rotated | Recorded as reported rotated. Nothing in the repository can confirm it: check once that the old Cloudinary key is refused |
| 2 | Should posting need a confirmed email? | B3, part 4 | Yes | Posting **and messaging** need one, as the audit proposed (`content.create` and `messages.send`). **Reading of the answer:** it said "posting"; messaging was included because the audit's item covers both. `EMAIL_CONFIRMATION_REQUIRED=false` turns the whole rule off. **It must stay off until verification emails can be delivered** (see finding 12) |
| 3 | May moderators see addresses? | B15 | Yes | Moderators keep the addresses in verification attempts and the verification queue. **Reading of the answer:** the question asked was about those. The profile `location` on the neighbour page is still admins-only, as the contract says; opening it too is a one-line change |
| 4 | What does deleting an account do to conversations? | B5, deletion | The other person keeps the conversation; the deleted person's id is cleared and shown as "Deleted User" | Built that way. Moderation cases and audit events keep the bare uid, which the answer did not cover: that is the audit's own default |
| 5 | Replace or license ip-api.com? | B14 | Leave it | Unchanged. Its free tier is HTTP-only and for non-commercial use; that remains true |
| 6 | What should the rate limits be? | B7 | The current numbers, per person | Unchanged: 10 a second, 60 a minute, 500 an hour, per person |
| 7 | Implement "profile visibility", or remove it? | B23 | Implement | Implemented, along with the "Only people I've messaged" option the same audit entry covers |

## Corrections to the audit

### B2: `firebase-admin` gives a certificate-fetch failure the same code as a bad token

- **What the audit recommended:** treat certificate-fetch failures in `verifyIdToken` as 503, and "check which error codes `firebase-admin` 13 uses for these before relying on a code match".
- **What the code does:** in `firebase-admin` 13.10.0, `FirebaseTokenVerifier.mapJwtErrorToAuthError` (`lib/auth/token-verifier.js`) maps every signature-stage error that is not "expired" to `auth/argument-error`. A failure to download Google's signing keys and a forged signature therefore carry the same code. Only the message differs: `Error fetching public keys for Google certs: …` for an HTTP error response, and `Error while making request: …` for a network error or timeout. This was confirmed by running the real SDK with its network blocked.
- **What was done:** the match is on the code plus those message prefixes, in one small function per app. Because a message match can break silently on an SDK upgrade, a contract test in each app runs the real SDK verifier with its network blocked and asserts the function still recognises the result.
- **Risk:** if a future SDK version rewords the messages, the contract test fails. Until someone fixes the match, an outage would again read as "invalid token" (the behaviour before this change), not something worse.

### B2: the web server needs a change too

- **What the audit said:** "Why the web needs no change": the browser client and the session routes already treat a 5xx from the API as "unavailable".
- **What the code does:** that is true of API responses, but the web server also verifies tokens itself. `verifySessionCookie` and `verifyIdToken` in `apps/web/src/lib/auth/session-cookie.ts` caught every error and returned `null`, and both callers read `null` as "forged or expired": `src/proxy.ts` deleted the cookie and redirected to login, and `POST /api/auth/session` answered 401, which the browser treats as a dead session and signs out of Firebase. A web server instance that cannot download Google's keys (a cold start during the same outage) therefore signed people out, which is the failure B2 exists to prevent.
- **What was done:** the two helpers now report "could not check" separately from "invalid". The proxy keeps the cookie and lets the API judge it, as it already does when the API cannot be reached. The session route answers 503 and keeps the cookie.
- **Risk:** if both the web server and the API are unable to check at once, the proxy cannot tell a forged cookie from a real one, so a forged cookie is served the app shell. The shell holds no data: every API call still needs a valid ID token. This is the same trade the proxy already makes when the API is down.

### B4: `change_hood` on someone who is not verified is refused, not left as it was

- **What the audit said:** "users whom staff moved with `change_hood` while unverified lose read access until verified. Decide whether `change_hood` should also verify."
- **What the code does:** the admin page only offers "Move to another Hood" for a verified neighbour (`neighbour-detail-page.tsx`), so the API accepting it for anyone else was never a workflow. After B4 it would have sent "Your feed now shows …" to someone whose feed shows nothing.
- **What was done:** the API now refuses `change_hood` for a neighbour who is not verified (400, "Verify them to place them in a Hood"). `verify` already sets the Hood.
- **Risk:** a script or a future client that relied on moving unverified people gets a 400 with a message saying what to do.

### B4: group membership was a second way to keep reading

- **What the audit said:** every Hood-scoped read checks `viewer.hoodId`, so making it null for unverified accounts closes read access.
- **What the code does:** groups also let a *member* in whatever their Hood (`GroupsService.loadVisible`), so a rejected neighbour kept reading the posts and member lists of every group they had joined.
- **What was done:** membership now counts only for someone who has a Hood on their request, which after B4 means a verified neighbour. An invite link still shows the group's card to its holder, as before.

### B7: counters stay in memory, and a library default hides the rate-limit header

- **What the audit recommended:** per-person limits, Redis-backed counters "with more than one instance", and reading the server's retry header in the web client.
- **What was done:** the first and the last. Redis-backed counters are deferred: they matter only when the API runs as several instances, and adding them is a separate, attributable change. Until then each instance enforces the limits on its own, so the effective limit is multiplied by the number of instances.
- **Also found:** the throttler names its header after the limit that was met (`Retry-After-medium`). The guards now also send the standard `Retry-After`, and the API exposes it through CORS so a browser can read it. That CORS line (`main.ts`) is not exercised by any test, because the test harness does not call `enableCors`.

### B10: the default page stays at 500

- **What the audit recommended:** return the newest 50 by default, with a `before` cursor, and deploy the web change with or straight after the API.
- **What was done:** the bug is that messages (and comments) after the 500th were never returned. The API now returns the *newest* 500 instead of the oldest 500, and accepts `before` and `limit`. The default size is unchanged, so the web build that is live today keeps working and starts showing new messages again without being redeployed. The web thread gained "Load earlier messages".
- **Why:** it removes the deploy-order risk the audit itself flags, at no cost to the fix. A smaller default can follow once comments have a "load earlier" control too (see finding 9).

### B14: the limit is per person, not per IP

- **What the audit recommended:** "add a per-IP limit" to the three lookup routes.
- **What was done:** they now require a session, so the limit is keyed on the signed-in person. B7 is about exactly this: neighbours behind one mobile-carrier or estate address must not spend each other's allowance. In mock mode, where no session exists, it falls back to the address.

## New findings

Severity uses the audit's scale.

### 1. One integration suite failed on Windows checkouts (fixed)

- **Problem:** `test/helpers/web-contract.ts` parses the web's type files with patterns written for LF line endings. With `core.autocrlf=true` the working tree has CRLF, nothing matched, and all 7 `admin-contract` tests failed with "web type … not found".
- **Location:** `apps/api/test/helpers/web-contract.ts`.
- **Severity:** P3 (test harness only; Linux CI is unaffected).
- **Action taken:** the helper normalises line endings. It was needed to verify the admin changes on this machine.

### 2. `@SkipThrottle()` with no arguments does nothing here

- **Problem:** the throttler has named limits (`short`, `medium`, `long`, and now `flood`). `@SkipThrottle()` skips only a limit named `default`, which does not exist, so the decorator on the live event stream has no effect.
- **Location:** `apps/api/src/realtime/realtime.controller.ts`.
- **Severity:** P3. A tab reconnecting its stream counts against the person's ordinary allowance.
- **Why it matters:** the code says the stream is exempt and it is not. With per-person limits a burst of reconnects (flaky mobile data) could use up someone's minute.
- **Recommended action:** name the limits to skip, as the session routes do.

### 3. Hood centres can still be found by probing

- **Problem:** hiding centre and radius (B3) stops the list handing them out, but `GET /neighborhoods/nearby?lng&lat&maxDistance` still says which Hoods have their centre within a chosen distance of a chosen point (down to 100 m), and `POST /users/me/verify-location` says whether a point is inside one.
- **Location:** `apps/api/src/hoods/hoods.controller.ts`, `apps/api/src/users/users.service.ts`.
- **Severity:** P2. It takes a scripted search instead of one request, and a new account can still claim any address; the cooldown stops an account hopping afterwards.
- **Recommended action:** nothing in the web app calls `/neighborhoods` or `/neighborhoods/nearby`; consider restricting both to staff. The real fix is stronger verification, already on the roadmap.

### 4. There is no screen for a suspended account

- **Problem:** the audit asked to confirm that the web's suspended screen links to the decisions page. There is no such screen. A suspended person can now read their notifications and decisions and file an appeal (B9), but the app does not lead them there: every other request answers 403.
- **Location:** `apps/web/src/components/layout/app-shell/`.
- **Severity:** P2 (the appeal path exists but is hard to find).
- **Recommended action:** when `/users/me` reports `accountStatus: "suspended"`, show a page that says so and links to `/settings/moderation`.

### 5. An upload is received in full before it is refused

- **Problem:** who may upload depends on `purpose`, which arrives in the multipart body, so the file (up to 100 MB) is streamed to a temporary file before the capability check can run. Nothing is stored and the temporary file is removed.
- **Location:** `apps/api/src/storage/storage.controller.ts`.
- **Severity:** P3 (bandwidth, not storage; limited to 30 requests a minute per person).
- **Recommended action:** send `purpose` as a query parameter or header so a guard can refuse before the body is read, or lower the multipart limit for people who may only upload a profile photo.

### 6. Hood Lead votes outlive a reopened case

- **Problem:** when a dismissed case is reopened by a new report and routed to Hood Leads again, the votes from the first round are still attached to it (one vote per Lead per case), so the earlier tally can decide the new round at the first new vote.
- **Location:** `apps/api/src/moderation/moderation.service.ts` (the existing "dismissed" branch), `hood-leads.service.ts`.
- **Severity:** P2 (suspected: established by reading, not reproduced).
- **Recommended action:** clear or archive a case's votes when it reopens. The new reopening path added for B8 avoids the problem by sending reopened cases to staff.

### 7. Onboarding blames the address for every failed lookup

- **Problem:** the onboarding page shows "We couldn't find that address" for any non-200 from `/api/geocode`, which now includes 429 (too many lookups) and 503 or 504 (lookup unavailable or slow).
- **Location:** `apps/web/src/app/onboarding/page.tsx`.
- **Severity:** P3.
- **Recommended action:** show "try again in a moment" for 429 and 5xx.

### 8. Posts hidden by a deactivation stay on open screens until they refresh

- **Problem:** deactivating hides the person's posts at once in the API, but no live event tells open feeds, so a neighbour who already has the feed on screen keeps seeing them until the next refetch.
- **Location:** `apps/api/src/users/users.service.ts` (`deactivate`).
- **Severity:** P3.
- **Recommended action:** publish a Hood-wide "refetch" hint on deactivate and restore.

### 9. The comment count on the web is the length of the loaded list

- **Problem:** the comments section reports `comments.length` as the post's comment count. It is correct only while every comment is loaded, which is what stops comments being paged like messages.
- **Location:** `apps/web/src/features/post/comments-section.tsx`.
- **Severity:** P3. Comments now return the newest 500, so a post with more shows "500".
- **Recommended action:** take the count from the post (`commentCount`), then add "load earlier" using the `before` cursor the API now accepts.

### 10. The privacy policy's 30-day promise depends on a switch

- **Problem:** the policy says that 30 days after deactivation "we delete or anonymise your personal data". The job that does it now exists, but `DATA_DELETION_MODE` starts at `dry-run`, as the audit asked, so nothing is deleted until someone sets it to `live`.
- **Location:** `apps/api/src/users/account-deletion.service.ts`, `apps/api/src/config/configuration.ts`.
- **Severity:** P1 until it is live.
- **Recommended action:** deploy, read a week of `[dry run]` log lines, take an Atlas backup, set `DATA_DELETION_MODE=live`.

### 11. Running the integration tests downloads a 600 MB MongoDB archive

- **Problem:** the first `pnpm test:e2e:api` on a machine downloads the MongoDB server archive (about 600 MB) into the home directory, even when a copy already sits under the repository's `node_modules/.cache`.
- **Location:** `apps/api/test/setup/global-setup.ts` (`mongodb-memory-server` defaults).
- **Severity:** P3 (developer experience; slow or metered connections).
- **Recommended action:** pin the download directory (`MONGOMS_DOWNLOAD_DIR`) so every package shares one copy, and cache it in CI.

### 12. Requiring a confirmed email depends on email that is not yet deliverable

- **Problem:** `backlog-status.md` lists "Verify Resend sending domain" as outstanding: until it is done, mail reaches only the Resend account owner. The confirmation link is sent by email, so with the new rule on, nobody who signed up with a password could confirm, and so nobody could post or message. People who sign in with Google are unaffected.
- **Location:** `apps/api/src/shared/authz/roles.ts`, `apps/api/src/verification/email-verification.service.ts`.
- **Severity:** P0 for a deploy that leaves the rule on before the domain is verified.
- **Recommended action:** set `EMAIL_CONFIRMATION_REQUIRED=false` on the API host now. Verify the sending domain, confirm a real verification email arrives, then remove the variable. Before that, count the accounts it will affect: `db.users.countDocuments({ verificationStatus: "verified", emailVerifiedAt: null, deactivatedAt: null })`.

### 13. What account deletion leaves behind

- **Problem:** after deletion the uid, and nothing else about the person, remains on: moderation cases, reports and audit events (deliberately); their reactions, poll votes and RSVPs (so counts stay right); the email delivery log (`communications`, which holds no address or body); and business applications and support threads, which were not examined in the audit or here.
- **Location:** `apps/api/src/users/account-deletion.service.ts` and the modules registered with `AccountLifecycle`.
- **Severity:** P2. A uid with no record behind it identifies nobody, but business applications and support threads hold names, emails and message text typed by the person.
- **Recommended action:** have the lawyer review confirm the retained items, and decide what deletion should do to business applications and support threads.

### 14. A deletion that keeps failing stops being retried

- **Problem:** a deletion job that fails five times is kept as `failed` and logged as an error. That account is then not queued again, so it stays undeleted until someone looks.
- **Location:** `apps/api/src/jobs/jobs.service.ts`, `apps/api/src/users/account-deletion.service.ts`.
- **Severity:** P2 (a deletion that silently never happens is the failure the job exists to prevent).
- **Recommended action:** alert on `failed` jobs of type `account.purge`. The same applies to the only-owner case, which is logged hourly and deletes nothing.

### 15. A deleted or expired account is left on an error screen

- **Problem:** `GET /users/me` answers 410 for a deleted account, and for one past its 30 days once deletion is live. The web shows its generic "couldn't load your account" state and leaves the person signed in to Firebase.
- **Location:** `apps/web/src/context/AuthContext.tsx`.
- **Severity:** P3.
- **Recommended action:** on 410, sign out and show the message the API sent.
