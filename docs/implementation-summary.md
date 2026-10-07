# Audit implementation summary

_What was done on 6 and 7 October 2026 to implement [codebase-audit.md](./codebase-audit.md). Item-by-item detail is in [implementation-progress.md](./implementation-progress.md); the owner's decisions, changes to the audit's plan and new findings are in [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)._

## Executive summary

Twenty-three of the audit's 25 findings are now implemented and tested. One more (B1, the exposed credentials) was reported rotated by the owner, and one (B25) is deferred. Redis-backed rate-limit counters, part of B7, are also deferred. The full API and web suites, type-check, lint and production build pass with everything in place.

The work came in two rounds:

- **6 October:** twenty findings and the groundwork they needed. This is committed and pushed to `development` (commits `f023ebc`..`f346439`).
- **7 October:** the owner's answers to the seven open decisions: a confirmed email to post or message, the privacy settings, account deletion 30 days after deactivation, and deleting media with its content. This is in the working tree, not yet committed.

Three things must happen outside the code before this is safe to deploy:

1. **Set `EMAIL_CONFIRMATION_REQUIRED=false` on the API host until verification emails can be delivered.** Posting now needs a confirmed email, the confirmation link goes by email, and the Resend sending domain is still unverified. Deployed as it stands, nobody who signed up with a password could post or message.
2. **Deletion starts as a dry run.** `DATA_DELETION_MODE` defaults to `dry-run`: it logs what it would delete and deletes nothing. The privacy policy's 30-day promise is kept only once it is set to `live`, which cannot be undone.
3. **Count the accounts the access changes affect** before deploying: those with a Hood on record but no verification (B4), and verified accounts with no confirmed email (B3).

Everything was verified on one Windows workstation running Node 25, with Firebase stubbed and MongoDB in memory. It has not met real Firebase, Atlas, Cloudinary or a browser, and whether CI has run could not be checked from here.

## Completed audit items

"Verified" means locally, as described above.

| ID | Sev | What changed | Round |
| --- | --- | --- | --- |
| B1 | P0 | Reported rotated by the owner (not checkable from the repository). Secret scanning added to CI | 1, 2 |
| B2 | P1 | A Google outage is 503, never 401; a user's last known session state is reused for up to 5 minutes. The web server's own token check got the same fix | 1 |
| B3 | P1 | A verified neighbour can move Hood by address check once every 90 days, audited. Hood boundaries go only to staff and a Hood's own members. Posting and messaging need a confirmed email | 1, 2 |
| B4 | P1 | Only verified neighbours read a Hood. Rejecting a verification removes the Hood | 1 |
| B5 | P1 | Deactivating hides the person and their posts. Thirty days later the account is deleted; the other person keeps each conversation, with "Deleted User" in place of the name and no id pointing at anyone | 1, 2 |
| B6 | P1 | Alerts are announced by a background job after the response, in batches, each neighbour once. A retried post with the same `clientId` is the same post | 1 |
| B7 | P1 | Rate limits are per person once signed in, at the existing numbers. Event posts carry their RSVPs. The web handles 429 properly | 1 |
| B8 | P2 | A new report reopens a decided case when the content is still up | 1 |
| B9 | P2 | A suspended account can read its decisions and notifications and file an appeal | 1 |
| B10 | P2 | Messages and comments return the newest page, with a cursor for earlier ones | 1 |
| B11 | P2 | Either person in a conversation can report it; nobody else can | 1 |
| B12 | P2 | Uploading media for content needs the standing to post. Each person has a daily upload allowance | 1 |
| B13 | P2 | Stored files nothing uses are deleted: an hour after a post or listing is deleted, 31 days after staff remove content | 2 |
| B14 | P2 | The web server's three lookup routes need a session, are limited per person, validate input and time out | 1 |
| B15 | P2 | A neighbour's profile address goes to admins only, as the contract says | 1 |
| B16 | P2 | CI triggers on `development` | 1 |
| B17 | P2 | The repository pins Node 24 | 1 |
| B18 | P3 | Over-long notification titles and bodies are shortened, not refused | 1 |
| B19 | P3 | A group whose last member leaves is archived | 1 |
| B20 | P3 | Overturning a "keep" records the removal and tells the author, who can appeal | 1 |
| B21 | P3 | Bulk neighbour actions report on each neighbour and don't stop at the first failure | 1 |
| B22 | P3 | Growing a Hood into its neighbour is refused. The old Hood write routes are audited | 1 |
| B23 | P3 | "Who can see your full profile" and "Only people I've messaged" now do what they say | 2 |
| B24 | P3 | Staff actions commit together with their audit record | 1 |
| — | — | Job runner (`apps/api/src/jobs`) and the `blockedUids` index | 1 |

## The seven decisions

| # | Decision | What was done |
| --- | --- | --- |
| 1 | Mark the credentials as rotated | Recorded in the audit, `security.md` and `backlog-status.md` as reported rotated on 7 October 2026 |
| 2 | Posting requires a confirmed email | Built for posting **and messaging**, as the audit's item proposed. Say if messaging should be left out |
| 3 | Moderators may see addresses | No code change: they keep the addresses in verification attempts and the queue. The profile `location` on the neighbour page stays admins-only, as the contract says. Say if that should open too |
| 4 | Deletion clears the person's id from conversations; the other side is kept and shows "Deleted User" | Built that way, as part of the full deletion job |
| 5 | Leave the IP lookup | Unchanged |
| 6 | Keep the rate-limit numbers, per person | Unchanged |
| 7 | Implement profile visibility | Built, with the messaging option the same audit entry covers |

## Deferred items

| ID | Sev | Why | What it needs |
| --- | --- | --- | --- |
| B7, part 2 | P1 | Redis-backed rate-limit counters only matter when the API runs as more than one instance | A decision to scale out |
| B25 | P3 | A dependency alignment the audit places in its hardening phase; no defect found | Its own change, with a full test run |

The audit's improvement lists and product enhancements were not started, apart from the job runner and the index.

## Files changed

Round 1 is in git history (commits `f023ebc`..`f346439`). Round 2, uncommitted: 41 files modified and 4 new.

| Area | Round 2 changes |
| --- | --- |
| Confirmed email | `shared/authz/roles.ts` (the rule), `account.guard.ts`, `can.decorator.ts` (one place decides what to tell someone who may not write), `storage.controller.ts`; the web's email banner |
| Privacy settings | `users.service.ts` (`publicProfile`), `hoods.service.ts` (`nearbyHoodIds`), `chat.service.ts` |
| Deletion | New `users/account-deletion.service.ts`. `users/account-lifecycle.ts` gained `purge`; posts, listings, comments, groups, chat, Hood Leads, notifications, email verification and storage each register their part. `users.service.ts` refuses to restore a deleted or expired account |
| Media clean-up | `storage.service.ts` (`sweepUnreferenced`, reference sources), `storage.module.ts` (hourly timer); posts, listings, groups and users declare what they still use |
| Web | `conversation-thread.tsx` and `lib/api/users.ts` show "Deleted User" with no profile link and no composer |
| Configuration and docs | Two new variables; `api-contract.md` §27; `security.md`, `testing.md`, `environment.md`, `backlog-status.md`, `current-state.md`, the audit's status table and the three implementation pages |

**Suggested commits for round 2:** (1) confirmed email; (2) privacy settings; (3) account deletion with media clean-up; (4) docs.

## Database changes

All additive, in both rounds. No migration script; no existing data is rewritten by deploying.

| Collection | Round 1 | Round 2 |
| --- | --- | --- |
| `users` | Index on `blockedUids`; fields `lastNeighborhoodId`, `deactivation` | Field `purgedAt` |
| `posts` | Fields `clientId`, `authorDeactivated`; unique partial index on `(authorUid, clientId)` | Index on `mediaUrls` |
| `listings` | Field `sellerDeactivated` | Index on `photos` |
| `media_assets` | Index on `(ownerUid, createdAt)` | Field `referenceCheckedAt` and an index on it |
| `reports`, `moderation_cases` | Fields `reportedUid`, `reopenedAt` | — |
| `jobs` | New collection | New job type `account.purge` |

**Data that changes at run time:**

- Rejecting a verification clears `neighborhoodId` (kept in `lastNeighborhoodId`).
- Deactivating flags the person's posts and listings; signing in removes the flags.
- **With `DATA_DELETION_MODE=live` only:** accounts deactivated more than 30 days ago are deleted, and stored files nothing uses are deleted. Neither can be reversed except from a backup.

**Before deploying:** take an Atlas backup; run the two count queries (in the audit under B4, and in the notes under finding 12); build the new indexes in Atlas first if the collections are large.

**Rollback:** the previous build runs against the same data. `HOOD_ACCESS_STRICT=false`, `EMAIL_CONFIRMATION_REQUIRED=false` and `DATA_DELETION_MODE=off` each turn one change off without a deploy.

## API changes

Full detail is in `api-contract.md` §26 (round 1) and §27 (round 2). Round 2:

- **403 on writing without a confirmed email:** posts, comments, listings, groups, content uploads, starting a conversation, sending a message. The message says to confirm the email.
- **`GET /users/:uid/public`** answers for verified neighbours of a nearby Hood when the profile's owner chose "Nearby neighbourhoods too".
- **`POST /conversations`** with the recipient set to "Only people I've messaged" succeeds for someone they have written to.
- **410 from `GET /users/me`** for a deleted account, and for one deactivated more than 30 days ago once deletion is live.
- **Conversations with a deleted person** carry the stand-in uid `"deleted-user"` and the card `{ displayName: "Deleted User" }`; sending to one is 403.
- **Author cards** for a deleted account are `{ uid, displayName: "Deleted User" }`.

## Tests added and modified

| | Before the audit work | After round 1 | Now |
| --- | --- | --- | --- |
| API integration | 11 suites, 118 tests | 20 suites, 230 tests | 23 suites, 271 tests |
| API unit | 18 suites, 115 tests | 19 suites, 128 tests | 19 suites, 129 tests |
| Web unit | 32 files, 177 tests | 39 files, 238 tests | 39 files, 238 tests |

- **Three new suites in round 2:** `email-confirmation` (8), `privacy-settings` (8), `account-deletion` (25: deletion in live, dry-run and off modes, and the media sweep).
- **The test harness's "member" now has a confirmed email**, because a member is someone who can post. Tests that need an unconfirmed neighbour ask for one.
- **The Firebase stub can delete a user**, and can fail to.
- **No existing test was weakened or deleted.**
- **Not covered:** anything rendered in a browser, including the "Deleted User" conversation screen; the CI workflow; the CORS `exposedHeaders` line.

## Verification results

Run on 7 October 2026, Windows 10, Node v25.2.1, pnpm 9.15.9, against the current tree (round 1 as merged, plus round 2).

| Command | Result |
| --- | --- |
| `pnpm --filter @myhoodora/api test:e2e` | Pass: 23 suites, 271 tests |
| `pnpm --filter @myhoodora/api test` | Pass: 19 suites, 129 tests |
| `pnpm --filter web test` | Pass: 39 files, 238 tests |
| `pnpm run lint` (root) | Pass |
| `pnpm run check-types` (root) | Pass |
| `pnpm run build` (root: API and web production builds) | Pass |
| Playwright browser tests | **Not run** |
| The same on Node 24 | **Not run**: no Node 24 on this machine |
| GitHub Actions | **Not checked**: the GitHub CLI is not installed here |

## Remaining risks

| Risk | Why it matters | What reduces it |
| --- | --- | --- |
| Confirmed email with undeliverable email | Nobody with a password sign-up could post or message | `EMAIL_CONFIRMATION_REQUIRED=false` until the Resend domain is verified and a real link arrives |
| Deletion is irreversible | A wrong deletion can only be undone from a backup | It starts as a dry run; read a week of logs and back up before `live` |
| Deletion is off until someone turns it on | Until then the privacy policy's promise is not kept | Schedule the switch to `live` |
| The media sweep trusts each module to say what it uses | A place that stores a file's URL without declaring it would have its files deleted | Four sources exist today (posts, listings, groups, profile photos) and the sweep refuses to run if any is missing. A new place that stores upload URLs must register |
| Two decisions were read narrowly | Messaging was included in the email rule; the profile address stays admins-only | Both are marked in the notes and are small to change |
| What deletion leaves | The bare uid stays on moderation history, reactions, votes and RSVPs. Business applications and support threads were not examined | Finding 13 in the notes; a question for the lawyer review |
| A deletion job that keeps failing stops being retried | That account stays undeleted until someone looks | Alert on failed `account.purge` jobs (finding 14) |
| B4 changes who can read | Accounts with a Hood on record but no verification lose access on deploy | Count them first. `HOOD_ACCESS_STRICT=false` reverses it |
| Nothing ran on Node 24 here; CI not checked | The pinned runtime and the workflow edits are unconfirmed | Look at the Actions runs for the pushes already made |
| Rate-limit counters and job polling are per instance | With several API instances the effective limit multiplies | Redis-backed counters before scaling out |
| The web changes were not seen in a browser | Type-checked and unit-tested only | Click through them before release |

## Recommended next steps

1. **Set `EMAIL_CONFIRMATION_REQUIRED=false` on the API host**, then verify the Resend sending domain and remove it.
2. **Review and commit round 2**, and check the Actions runs for round 1 (this settles B16 and B17).
3. **Before deploying:** back up, run the two count queries, build the new indexes, deploy the API before the web.
4. **Run deletion as a dry run for a week**, read the log lines, back up, then set `DATA_DELETION_MODE=live`.
5. **Confirm the two narrow readings** (messaging under the email rule; the profile address for moderators).
6. **Click through the changed web screens**, and add a suspended-account screen and a clean sign-out on 410 (findings 4 and 15).
7. **Then the audit's later phases:** the shared visibility predicate, generated API types, observability, and the hardening list, including B25 and Redis-backed counters.
