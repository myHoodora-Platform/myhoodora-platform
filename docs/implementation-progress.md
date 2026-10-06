# Audit implementation progress

_Tracks the work in [codebase-audit.md](./codebase-audit.md), item by item. Work ran on 6 October 2026 on `development` at commit `c1a1811`, the commit the audit was written against, so its line references held. The overview is [implementation-summary.md](./implementation-summary.md); decisions still needed, changes to the audit's plan and new findings are in [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)._

**Statuses:** Not Started · In Progress · Implemented (code and tests written, not fully validated) · Verified (the relevant tests and checks passed) · Blocked (needs something outside the repository) · Deferred (intentionally not done, with the reason).

**What "Verified" means here.** Verified locally: the item's regression tests failed before the fix (or could not compile against the old code, where noted) and pass after it, and the full suites, type-check, lint and build pass with it in place. Local runs used Node v25.2.1 on Windows, not the Node 24 line the repository now pins. Nothing has run on GitHub Actions, been deployed, or been exercised against real Firebase, Atlas or Cloudinary, or clicked through in a browser.

**Nothing is committed.** All of this is in the working tree, for review.

## Audit items

In the audit's fix order.

| ID | Issue / Change | Priority | Status | Implementation | Tests | Notes |
|----|----------------|----------|--------|----------------|-------|-------|
| B1 | Storage credential in remote git history, rotation outstanding | P0 | Blocked | Secret scanning added to CI (`secrets` job: gitleaks over the commits a push or pull request adds) | None possible locally | **Rotating the Cloudinary key and the Atlas password needs the account owner.** The CI job has never run |
| B16 | CI does not run on pushes to the working branch | P2 | Implemented | `ci.yml`, `README.md`, `docs/development.md` now say `development` | Needs a push: watch the first run | Cannot be verified from a workstation |
| B17 | Node 20 is past end of life | P2 | Implemented | `engines` 24.x; CI installs Node 24; docs updated | Suites pass locally on Node 25.2.1, not 24 | Hosts must move too. Commit separately from behaviour changes, as the audit asks |
| B2 | A failed Firebase lookup signs everyone out | P1 | Verified | API: typed "lookup unavailable" error; the guard answers 503, not 401; a user's last known state is reused for up to 5 minutes. Web: its own token verifier had the same flaw, which the audit missed | API: 4 integration, 5 unit, 6 contract tests against the real SDK. Web: 15 tests incl. a real-SDK contract test and a new proxy suite | Two corrections to the audit: see the notes |
| — | `blockedUids` index | Perf | Verified | Multikey index on `users.blockedUids` | Query-plan test: `COLLSCAN` before, `blockedUids_1` after | Built at boot by `autoIndex`. On a large collection, build it in Atlas first |
| B4 | Rejecting a verification does not remove Hood read access | P1 | Verified | `viewer.hoodId` only for verified neighbours; rejection clears the Hood (kept as `lastNeighborhoodId`); group membership no longer outlives it; `change_hood` refused for unverified neighbours | `hood-access` suite: 12 routes checked per account state, both flag settings | Behind `HOOD_ACCESS_STRICT` (on by default). **Count affected accounts before deploying**: the query is in the audit under B4 |
| B3 | Hood membership is self-asserted and unlimited | P1 | Verified (parts 1 to 3) | 90-day cooldown on moving Hood by address check (409 inside it); the move is audited as `hood_self_change`; Hood centre and radius only for staff and a Hood's own members | `hood-access` suite | **Part 4 (require a confirmed email to post or message) is not done: a product decision.** Same flag as B4 |
| B15 | Moderators receive home addresses the contract reserves for admins | P2 | Verified | `location` on neighbour detail needs the new `neighbours.address` capability (admin, owner): the contract as written | Integration test per role; role unit test | **Open:** verification attempts still carry the address typed at the time |
| — | Job runner | Arch | Verified | `src/jobs/`: MongoDB-backed queue, atomic claim, retry with backoff, takeover of a dead worker's job | `jobs` suite: 10 tests on a real replica set | Jobs run at least once: handlers must be safe to repeat |
| B6 | Alert notifications are sent inside the POST request | P1 | Verified | Fan-out is a job after the response; notification writes batched; `clientId` on `POST /posts` with a unique partial index; the web composer sends one | `alert-fanout` suite: 13 tests incl. 2,000 members; 3 web tests | Tests could not compile against the old code (new API). Removes the old 5,000-member cap |
| B7 | Per-IP rate limits versus direct browser traffic | P1 | Verified (parts 1, 3, 4) | Per-person limits after sign-in, a generous per-IP flood limit before it; RSVPs embedded in event posts; the web handles 429 with a friendly message and a retry | `rate-limits` suite: 5 tests; 2 engagement tests; 4 web tests | **Part 2 (Redis-backed counters) deferred:** only matters with more than one API instance. **Limits unmeasured.** The CORS `exposedHeaders` line is not covered by a test. No "requests on feed mount" test: the web has no component test setup |
| B12 | Uploads need no capability and have no per-user quota | P2 | Verified | Capability per purpose (content media needs the standing to post; a profile photo needs an account); daily allowance per person (200 files, 1 GB), with an index | `upload-rules` suite: 15 tests; 4 unit tests | Two new environment variables. The file is still received before the capability check (finding 5) |
| B5 | Deactivation leaves posts visible and never deletes anything | P1 | **Hide: Verified. Delete: Deferred** | Hide: posts and listings flagged and filtered; "Former neighbour" on comments, group posts and conversations; restored on sign-in; `reason` and `details` kept | `deactivation` suite: 12 tests | **Deletion after 30 days is not built.** The audit says to ship it separately, in dry-run first, and it awaits a legal decision (notes, decision 4). **The privacy policy's promise is therefore still untrue.** The restore window is not enforced either: it only makes sense once deletion exists |
| B13 | Media is never deleted with its content | P2 | Deferred | — | — | The audit ties it to the B5 deletion job ("one discard mechanism") |
| B8 | Reports on an already-decided case are swallowed | P2 | Verified | A new report reopens a resolved case whose content is still up; the earlier decision stays on it and stays appealable; reopened cases go to staff | `moderation-fixes` suite | Appeals are still one per person per case, as the audit notes |
| B9 | Suspended users cannot appeal their suspension | P2 | Verified | `@AllowSuspended()` on my-decisions, appeals, the notification list and unread count | `moderation-fixes` suite, incl. the overturn that reinstates | **The web has no suspended-account screen** to lead people there (finding 4) |
| B11 | The person who started a conversation cannot report it | P2 | Verified | Only participants may report a conversation (404 otherwise); the report is about the other person; `reportedUid` stored per report and shown to staff | `moderation-fixes` suite | |
| B20 | Overturning a "keep" removes content without telling the author | P3 | Verified | The case's resolution becomes the removal, by the reviewer; the author gets the usual notice and can appeal to someone else | `moderation-fixes` suite | |
| B10 | Conversations stop showing new messages after 500 | P2 | Verified | Messages and comments return the newest page, with `before` and `limit`; the web thread gained "Load earlier messages" | `paging` suite: 11 tests; 6 web tests | **Default page stays 500** (the audit suggested 50) so the live web keeps working: see the notes. Comments have no "load earlier" yet (finding 9) |
| B14 | Unauthenticated geocoding proxies on the web server | P2 | Verified | The three routes need a valid session cookie, are limited per person, validate what they forward, and time out | 27 route tests | **Open:** replacing or licensing ip-api.com (decision 5) |
| B18 | Group notifications can exceed length limits after the action committed | P3 | Verified | Titles and bodies shortened inside `notify()` | Direct test of both write paths; a group test at maximum lengths | |
| B19 | A group can be left with no members and no admin | P3 | Verified | The last member leaving archives the group | `staff-and-groups` suite | Archived, not deleted: former members' posts are kept, and the name stays taken |
| B21 | Bulk neighbour actions stop midway with no per-item result | P3 | Verified | Each neighbour handled on their own; `{ updated, results[] }`; 403 only for what the caller may not do to anyone. The admin dialog reports partial failures | `staff-and-groups` suite; 6 web tests | |
| B22 | Hood resize skips the overlap check; legacy Hood writes are unaudited | P3 | Verified | Growing a radius into another Hood is 409; the old `/neighborhoods` write routes are audited like the admin ones | `staff-and-groups` suite | |
| B23 | "Profile visibility" setting has no effect | P3 | Blocked | — | — | Needs a product decision: implement or remove the controls (decision 7) |
| B24 | Some staff actions write their audit record outside the transaction | P3 | Verified | Content remove/restore, alert actions, Hood create/update and Hood Lead appointments commit with their audit record or not at all | `staff-and-groups` suite: each action with the audit write made to fail | |
| B25 | Express 5 declared, Express 4 running | P3 | Deferred | — | — | A dependency change belonging to the audit's hardening phase; no defect was found |

The audit's improvement lists (code quality, architecture, performance, security, developer experience) and its product enhancements were not started, apart from the job runner and the `blockedUids` index, which the fixes depended on.

## Checks

| Check | Before any change | With all the work in place |
| --- | --- | --- |
| API integration tests | 10 of 11 suites; 111 of 118 tests (one suite failed on Windows line endings: finding 1) | 20 suites, 230 tests: pass |
| API unit tests | 18 suites, 115 tests: pass | 19 suites, 128 tests: pass |
| API type-check, lint | Pass | Pass |
| Web unit tests | 32 files, 177 tests: pass | 39 files, 238 tests: pass |
| Web type-check, lint | Pass | Pass |
| Workspace lint, type-check, build (from the root, as CI runs them) | Not run | Pass |
| Browser tests (Playwright) | Not run | Not run |
