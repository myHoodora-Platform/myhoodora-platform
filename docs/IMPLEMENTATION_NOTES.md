# Implementation notes

_Things found while implementing [codebase-audit.md](./codebase-audit.md) that the audit did not record. Started 6 October 2026. Progress per audit item is in [implementation-progress.md](./implementation-progress.md)._

Three kinds of entry:

- **[Decisions still needed](#decisions-still-needed)**: questions only the owner can answer. Each says what was done in the meantime.
- **[Corrections to the audit](#corrections-to-the-audit)**: where the audit's recommendation did not match the code, what was done instead, and why.
- **[New findings](#new-findings)**: problems outside the task in hand. Recorded and, unless stated, not fixed, so that each change stays reviewable.

## Decisions still needed

| # | Question | Audit item | What the code does now |
| --- | --- | --- | --- |
| 1 | Has the Cloudinary key been replaced and the Atlas password changed? | B1 | Nothing in the repository can do this. Secret scanning was added to CI for new commits |
| 2 | Should posting and messaging need a confirmed email? It would lock out existing accounts that never confirmed | B3, part 4 | Not required, as before |
| 3 | May moderators see the address a neighbour typed during an address check? They need it for the verification queue, but the contract says addresses are for admins | B15 | The profile address (`location`) is admins-only, as the contract says. Verification attempts are unchanged and still carry the typed address |
| 4 | When an account is deleted, what happens to the other person's copy of a conversation, and may moderation records keep the uid? The audit asks for a lawyer's answer | B5, deletion | Deletion is not implemented (see the progress page). Deactivation hides the person; nothing is ever deleted |
| 5 | Replace or license ip-api.com? Its free tier is HTTP-only and for non-commercial use | B14 | Still used as the last fallback when GPS fails and the host provides no location headers. It is now behind sign-in, a per-person limit, input validation and a timeout |
| 6 | What should the per-person rate limits be? The audit asks for a browser measurement of a feed and an events page load first | B7 | The old numbers (10 a second, 60 a minute, 500 an hour), now per person instead of per address |
| 7 | Implement "profile visibility" and the "contacts" messaging option, or remove the controls? | B23 | Unchanged: the controls are stored and have no effect |

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

### 10. The privacy policy still promises deletion after 30 days

- **Problem:** the policy says that 30 days after deactivation "we delete or anonymise your personal data". Nothing does. This is B5's second step, deferred here because it is irreversible and waiting on decision 4.
- **Location:** `apps/web/src/components/legal/privacy-policy.tsx`, `apps/api/src/users/users.service.ts`.
- **Severity:** P1 (the audit's own rating for B5).
- **Recommended action:** implement the deletion job in dry-run mode, as the audit's roadmap describes, as soon as decision 4 is made. Until then the policy text is inaccurate.

### 11. Running the integration tests downloads a 600 MB MongoDB archive

- **Problem:** the first `pnpm test:e2e:api` on a machine downloads the MongoDB server archive (about 600 MB) into the home directory, even when a copy already sits under the repository's `node_modules/.cache`.
- **Location:** `apps/api/test/setup/global-setup.ts` (`mongodb-memory-server` defaults).
- **Severity:** P3 (developer experience; slow or metered connections).
- **Recommended action:** pin the download directory (`MONGOMS_DOWNLOAD_DIR`) so every package shares one copy, and cache it in CI.
