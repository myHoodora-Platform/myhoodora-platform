# Audit implementation summary

_What was done on 6 October 2026 to implement [codebase-audit.md](./codebase-audit.md), on `development` at commit `c1a1811`. Item-by-item detail is in [implementation-progress.md](./implementation-progress.md); decisions still needed, changes to the audit's plan and new findings are in [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)._

## Executive summary

Twenty of the audit's 25 findings are implemented, plus the first half of a twenty-first (B5) and the two pieces of groundwork they needed (a background job runner and a missing database index). Eighteen of the twenty are verified locally by regression tests; the other two (B16 and B17) are configuration changes that only a CI run can confirm. The full API and web suites, type-check, lint and production build pass with everything in place.

Read these four points before relying on that:

1. **Nothing is committed, deployed or run in CI.** The work is in the working tree for review. It was verified on one Windows workstation running Node 25, with Firebase stubbed and MongoDB in memory. It has not met real Firebase, Atlas, Cloudinary or a browser.
2. **The P0 is still open.** The exposed Cloudinary key and MongoDB password (B1) can only be replaced by whoever holds those accounts. This should happen before anything else.
3. **The privacy policy is still untrue.** Deactivating an account now hides the person and their posts, as the settings dialog promises. Deleting their data after 30 days, which the privacy policy promises, is not built. It was left out on purpose: it is irreversible, the audit says to ship it separately in dry-run mode, and it waits on a legal decision.
4. **Seven questions need an owner's answer.** They are listed in the notes. In each case the code does the cautious thing in the meantime.

Six places where the audit's recommendation was not followed as written are explained in the notes. The most important: the audit said the web app needed no change for B2, but the web server had the same sign-everyone-out flaw in its own token check, and that was fixed too.

## Completed audit items

"Verified" means locally, as described above.

| ID | Sev | What changed | Status |
| --- | --- | --- | --- |
| B2 | P1 | When Google is unreachable the API answers 503, never 401, and reuses a user's last known session state for up to 5 minutes. The web server's own token check got the same fix | Verified |
| B3 | P1 | A verified neighbour can move Hood by address check once every 90 days, and the move is audited. Hood centres and radii go only to staff and a Hood's own members | Verified, except requiring a confirmed email (a decision) |
| B4 | P1 | Only verified neighbours read a Hood. Rejecting a verification removes the Hood. Group membership no longer outlives it | Verified |
| B5 (hide) | P1 | Deactivating hides the person's posts and listings and replaces their name with "Former neighbour" elsewhere. Signing in restores everything | Verified. Deletion: see Deferred |
| B6 | P1 | Alerts are announced by a background job after the response, in batches, each neighbour once. A retried post with the same `clientId` is the same post | Verified |
| B7 | P1 | Rate limits are per person once signed in. Event posts carry their RSVPs. The web handles 429 properly | Verified, except Redis-backed counters (deferred) and measured limits (a decision) |
| B8 | P2 | A new report reopens a decided case when the content is still up | Verified |
| B9 | P2 | A suspended account can read its decisions and notifications and file an appeal | Verified |
| B10 | P2 | Messages and comments return the newest page, with a cursor for earlier ones. The chat thread has "Load earlier messages" | Verified |
| B11 | P2 | Either person in a conversation can report it; nobody else can | Verified |
| B12 | P2 | Uploading media for content needs the standing to post. Each person has a daily upload allowance | Verified |
| B14 | P2 | The web server's three lookup routes need a session, are limited per person, validate input and time out | Verified |
| B15 | P2 | A neighbour's profile address goes to admins only, as the contract says | Verified |
| B16 | P2 | CI triggers on `development` | Implemented; needs a green run on GitHub |
| B17 | P2 | The repository pins Node 24 | Implemented; not run on Node 24 |
| B18 | P3 | Over-long notification titles and bodies are shortened, not refused | Verified |
| B19 | P3 | A group whose last member leaves is archived | Verified |
| B20 | P3 | Overturning a "keep" records the removal and tells the author, who can appeal | Verified |
| B21 | P3 | Bulk neighbour actions report on each neighbour and don't stop at the first failure | Verified |
| B22 | P3 | Growing a Hood into its neighbour is refused. The old Hood write routes are audited | Verified |
| B24 | P3 | Staff actions commit together with their audit record | Verified |
| — | — | Job runner (`apps/api/src/jobs`) and the `blockedUids` index | Verified |

## Deferred items

| ID | Sev | Why it was not done | What it needs |
| --- | --- | --- | --- |
| B1 | P0 | Rotating credentials happens in the Cloudinary and Atlas consoles | The account owner. Secret scanning for new commits was added to CI |
| B5 (delete) | P1 | Irreversible. The audit says not to combine it with hiding, to run it in dry-run mode for a week first, and to confirm with a lawyer what happens to other people's copies of conversations and to moderation records | That decision, then the job, built on the new job runner |
| B13 | P2 | The audit ties media deletion to the B5 deletion job ("one discard mechanism") | Ships with B5 deletion |
| B7, part 2 | P1 | Redis-backed rate-limit counters only matter when the API runs as more than one instance | A decision to scale out |
| B3, part 4 | P1 | Requiring a confirmed email before posting locks out existing unconfirmed accounts | A product decision |
| B23 | P3 | "Implement the settings or remove the controls" is a product choice | A product decision |
| B25 | P3 | A dependency alignment the audit places in its hardening phase; no defect found | Its own change, with a full test run |

The audit's improvement lists and product enhancements were not started, apart from the two pieces of groundwork above.

## Files changed

114 files: 83 modified and 31 new, of which 17 are test files. In the modified files, code and configuration account for about 1,600 added lines and 300 removed.

| Area | Significant changes |
| --- | --- |
| API, authentication | `firebase-auth.guard.ts` splits "bad token" (401) from "couldn't check" (503). `session-revocation.service.ts` has the typed error and the bounded reuse of old answers. New `firebase-outage.ts` |
| API, access | `account.guard.ts` gives a Hood only to verified neighbours. `users.service.ts` (cooldown, deactivation), `staff-users.service.ts`, `hoods.controller.ts` (boundaries), `groups.service.ts`. New `users/account-lifecycle.ts` |
| API, throughput | New `jobs/` module. `notifications.service.ts` writes in batches. `posts.service.ts` (fan-out job, `clientId`, embedded RSVPs). New `shared/throttle/throttle.guards.ts`; `app.module.ts` now has five global guards |
| API, storage | `storage.controller.ts` (capability per purpose), `storage.service.ts` (daily allowance) |
| API, moderation and staff | `moderation.service.ts`, `appeals.service.ts`, `moderation.controller.ts`, `chat.service.ts`, `admin.controllers.ts`, `content-actions.service.ts`, `hoods.service.ts`, `leads-roster.service.ts` |
| API, threads | `chat.service.ts`, `comments.service.ts`, `shared/http/pagination.ts` |
| Web | `lib/auth/session-cookie.ts`, `proxy.ts`, the session route (B2). `lib/api/client.ts` (429). New `lib/auth/lookup-guard.ts` and the three lookup routes (B14). Composer `clientId`, RSVP buttons, chat "load earlier", the admin bulk dialog |
| Configuration | `.github/workflows/ci.yml` (branch, Node 24, secret scan), `package.json` (`engines`), `turbo.json` and `.env.example` (four new variables) |
| Docs | `api-contract.md` (new §26 and corrections), `security.md`, `testing.md`, `environment.md`, `current-state.md`, `backlog-status.md`, the audit's status table, and three new pages |

One test helper was changed for a reason unrelated to the audit: `test/helpers/web-contract.ts` assumed LF line endings, which made a whole suite fail on Windows checkouts.

**Suggested commits**, since the audit asks for some of these to ship apart: (1) CI branch and secret scan; (2) Node 24, alone; (3) B2; (4) the index; (5) B4, B3 and B15; (6) the job runner; (7) B6; (8) B7; (9) B12; (10) B5 hiding; (11) B8, B9, B11, B20; (12) B10; (13) B14; (14) B18, B19, B21, B22, B24; (15) docs.

## Database changes

All additive. There is no migration script, and no existing data is rewritten.

| Collection | Change |
| --- | --- |
| `users` | New index on `blockedUids`. New optional fields `lastNeighborhoodId` and `deactivation` |
| `posts` | New optional fields `clientId` and `authorDeactivated`. New unique index on `(authorUid, clientId)`, partial: it applies only to posts that have a `clientId`, and no existing post does |
| `listings` | New optional field `sellerDeactivated` |
| `media_assets` | New index on `(ownerUid, createdAt)` |
| `reports`, `moderation_cases` | New optional fields `reportedUid` and `reopenedAt` |
| `jobs` | New collection, with indexes on `(status, runAt)`, a unique partial index on `dedupeKey`, and a 7-day expiry for finished jobs |

**Before deploying:**

- Take an Atlas backup.
- Count the accounts B4 affects (they have a Hood on record but are not verified, and will stop reading it). The query is in the audit under B4.
- The new indexes are built at start-up by `autoIndex`. On large collections build them in Atlas first, as the audit advises.

**Data that changes at run time:** rejecting a verification now clears `neighborhoodId` (the old value is kept in `lastNeighborhoodId`). Deactivating flags the person's posts and listings; signing in removes the flags.

**Rollback:** every schema change is additive, so the previous build runs against the same data. `HOOD_ACCESS_STRICT=false` turns the B3 and B4 rules off without a deploy.

## API changes

Full detail is in `api-contract.md` §26. All are compatible with the web build that is live today except where marked.

- **New status codes on existing routes:** 503 from any authenticated route when Google is unreachable (was 401). 409 from `POST /users/me/verify-location` inside the cooldown. 403 and 429 from the upload routes. 400 from `change_hood` on an unverified neighbour. 409 from a Hood resize that overlaps.
- **Narrower responses:** `GET /neighborhoods*` omits centre and radius for most callers (**breaking** for a client that used other Hoods' geometry; the web does not). `GET /admin/neighbours/:uid` omits `location` for moderators. Unverified accounts get 404 from Hood-scoped routes.
- **New optional inputs:** `clientId` on `POST /posts`. `before` and `limit` on the messages and comments lists.
- **New response fields:** `rsvp` on event posts. `results` on the bulk neighbour action. `reopenedAt` on reports, and `reported` on each report in the detail view.
- **Changed defaults:** messages and comments return the newest 500, not the oldest 500. Rate limits count per person. A rate-limiter 429 has a friendlier message and a `Retry-After` header.
- **Opened to suspended accounts:** their decisions, appeals, and notifications.
- **Web server routes:** `/api/geocode`, `/api/reverse-geocode` and `/api/ip-location` now need a session cookie.

## Tests added and modified

| | Before | After |
| --- | --- | --- |
| API integration | 11 suites, 118 tests | 20 suites, 230 tests |
| API unit | 18 suites, 115 tests | 19 suites, 128 tests |
| Web unit | 32 files, 177 tests | 39 files, 238 tests |

- **Nine new API integration suites:** `hood-access`, `jobs`, `alert-fanout`, `rate-limits`, `upload-rules`, `deactivation`, `moderation-fixes`, `paging`, `staff-and-groups`. `security` and `moderation-engagement` were extended.
- **The Firebase stub can now fail** the way the real SDK does, which is what made B2 invisible before.
- **Two contract tests run the real `firebase-admin` SDK** with its network blocked, one per app. The outage detection matches on the SDK's message text, so these fail if an upgrade rewords it.
- **No existing test was weakened or deleted.** One existing unit spec (`storage.service.spec.ts`) needed its stand-in model extended, because the service now makes a query it did not make before; this was caught by running the full unit suite.
- **Not covered:** the CORS `exposedHeaders` line; anything rendered in a browser (the web has no component-test setup); the CI workflow itself.

## Verification results

Run on 6 October 2026, Windows 10, Node v25.2.1, pnpm 9.15.9.

| Command | Result |
| --- | --- |
| `pnpm --filter @myhoodora/api test:e2e` | Pass: 20 suites, 230 tests |
| `pnpm --filter @myhoodora/api test` | Pass: 19 suites, 128 tests |
| `pnpm --filter web test` | Pass: 39 files, 238 tests |
| `pnpm run lint` (root, all packages) | Pass |
| `pnpm run check-types` (root, all packages) | Pass |
| `pnpm run build` (root: API and web production builds) | Pass |
| Playwright browser tests | **Not run** |
| The same on Node 24 | **Not run**: no Node 24 on this machine |
| GitHub Actions | **Not run**: nothing was pushed |
| Secret scan job | **Not run**: needs GitHub Actions |

Checked against the final diff:

1. Every item marked Verified has a test that exercises the fixed behaviour.
2. No P0 to P2 item was skipped silently: each is implemented, or listed above with its reason.
3. The changed-file list contains only files these fixes needed; the build left no tracked file modified.
4. The application builds.
5. The docs named in the audit's "Definition of done" were updated with the behaviour.

## Remaining risks

| Risk | Why it matters | What reduces it |
| --- | --- | --- |
| Credentials are still exposed (B1) | Anyone with repository access can read or delete all stored media, and reach the database | Rotate both now |
| The privacy policy promises deletion that does not happen | A legal exposure that grows with each deactivation | Build the deletion job, or correct the policy until it exists |
| B4 changes who can read | Accounts with a Hood on record but no verification lose access on deploy | Count them first. `HOOD_ACCESS_STRICT=false` reverses it without a deploy |
| Nothing ran on Node 24 or in CI | The pinned runtime and the workflow edits are untested | Push to a branch and watch the first run before merging behaviour changes |
| Rate-limit numbers are unmeasured | 60 a minute per person may be too tight for a busy page, or too loose | Measure a feed and an events page load, as the audit asks |
| Limits and job polling are per instance | With several API instances the effective rate limit multiplies | Redis-backed counters before scaling out. Jobs are already safe across instances |
| Jobs can run more than once | A handler that is not safe to repeat would duplicate its effect | The one handler today is. Keep the rule for new ones (it is documented on `JobsService`) |
| Outage detection matches SDK message text | A `firebase-admin` upgrade could reword it | The two contract tests fail if it does |
| The web changes were not seen in a browser | "Load earlier messages", the RSVP buttons, the bulk-action toast and the composer were type-checked and unit-tested only | Click through them before release |
| A suspended person has no screen leading to their appeal | B9 opened the route, not the path to it | Finding 4 in the notes |

## Recommended next steps

In order:

1. **Rotate the Cloudinary key and the Atlas password** (B1).
2. **Review and commit this work** in the groups suggested above, push to a branch, and get a green CI run on Node 24.
3. **Answer the seven decisions** in the notes. Decision 4 (deletion) unblocks the largest remaining item.
4. **Build the B5 deletion job with B13**, in dry-run mode first, on the job runner. Correct the privacy policy in the meantime if this will take more than a few days.
5. **Before deploying:** back up, count the accounts B4 affects, build the new indexes, and deploy the API before the web.
6. **Click through the changed web screens**, and add the suspended-account screen (finding 4).
7. **Measure page loads and set the rate limits**; add Redis-backed counters before running more than one API instance.
8. **Then the audit's later phases:** the shared visibility predicate (it would have prevented B4), generated API types, observability, and the hardening list, including B25 and restricting remote image URLs.
