# Backlog status

_As of 2 October 2026. Each line was checked against the code or by running it; nothing is marked verified on trust._

- ✅ **Implemented / verified**: in the code and exercised by a test or a direct check, named in the row.
- 🟡 **Requires manual action**: needs a dashboard, a credential, a domain, a lawyer or a human click. What remains is stated.
- ⏳ **Post-MVP**: deliberately deferred.
- ⚠️ **Blocked** / ❌ **Not implemented**: stated with the reason.

"Verified" means the repository's behaviour. It does **not** mean the product is production-ready: the 🟡 rows stand between this code and a launch.

## Security and operations

| Item | Status | Detail |
| --- | --- | --- |
| Rotate Cloudinary key | 🟡 | The real key was committed in `apps/api/.env.example` (commits `532fc3c`, `a8fa360`); the file is clean now but history is not. Generate a new key in the Cloudinary console, delete the old one, update the API host and local `.env`. Do this before pushing those commits anywhere |
| Rotate MongoDB password | 🟡 | Atlas → Database Access → new password → update `MONGODB_URI` on the API host and locally |
| Verify Resend sending domain | 🟡 | Add Resend's DNS records for the sending domain; create a sending-only key and the webhook. Until then mail only reaches the Resend account owner |
| Set production env on the API host | 🟡 | List in `environment.md`. The API now refuses to start in production if a required variable is missing, including Firebase credentials |
| Run `pnpm migrate` in production | 🟡 | `migrate:dry` first. Idempotent (`migrations.e2e-spec`) |
| Disable QA staff accounts at launch | 🟡 | Firebase console → disable; role → `member` |
| Lawyer review of privacy, terms, guidelines | 🟡 | Not a code task |
| `helmet`, compression, shutdown hooks in the API | ✅ | `apps/api/src/main.ts`. Checked against the running API: security headers present, `X-Powered-By` gone, the event stream is not compressed and still delivers at once |
| CSP / HSTS / frame headers on the web | ✅ | `apps/web/next.config.js`. Browser tests assert the headers and fail on any policy violation, in development and against a production build. Limitation: `script-src` allows `'unsafe-inline'` (`security.md`) |
| Require Firebase credentials in `validateEnv` | ✅ | Firebase is required: every API request is verified with the Admin SDK. Production needs the three `FIREBASE_*` values or `GOOGLE_APPLICATION_CREDENTIALS` (`configuration.spec.ts`) |
| Deployment configuration / runbook | ✅ runbook · ❌ host config | `deployment.md`: API first, health, migrations, web, smoke tests, rollback. No host-specific config files were added, because the hosts' settings aren't in the repository to check them against |

## Tests and CI

| Item | Status | Detail |
| --- | --- | --- |
| Fix `security.e2e-spec` event-date test | ✅ | Already corrected in the repository (uses a date 7 days ahead); the suite passes |
| Run unit and e2e tests in CI | ✅ written · 🟡 first run | `.github/workflows/ci.yml` now runs lint, types, unit tests, API integration tests, the build, and the signed-out browser tests. It has not run on GitHub yet: watch the first run |
| Stop `--fix` in the API lint script | ✅ | `lint` reports only; `lint:fix` fixes |
| e2e for `/media`, `/search`, `/realtime` | ✅ | `test/media-search-realtime.e2e-spec.ts` (14 tests) |
| Browser e2e (Playwright) for core flows | ✅ auth, session, admin, accessibility · ❌ resident flows | 39 tests pass. Posting, commenting, uploading and searching as a **verified resident** are not browser-tested: no verified test account exists. They are covered by API integration tests |
| Click-through test of "Sign out everywhere" | ✅ | `e2e/auth.spec.ts`: this browser signs out at once and a second signed-in browser is turned away |

## Features

| Item | Status | Detail |
| --- | --- | --- |
| Mobile app | ⏳ | Removed from the pnpm workspace, CI, and the README's product description. The Expo project is kept in `apps/mobile` |
| Apple sign-in | ⏳ | Removed from the UI; one flag (`APPLE_SIGN_IN_ENABLED`) restores it. Not enabled in Firebase |
| Google sign-in: button | ✅ wired · 🟡 click-test | Enabled in Firebase (confirmed with Firebase's API). Browser test: opens Google's window; cancelling is silent. Completing a sign-in needs a real Google account |
| Google One Tap on the landing, login and register pages | ✅ wired · 🟡 console + click-test | Uses Google Identity Services with FedCM; loads within the content policy; never shown to signed-in users. Needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and the site's origin under the OAuth client's Authorised JavaScript origins |
| Google sign-in to an existing account | ✅ | Does not overwrite or duplicate the account (`communications.e2e-spec`). Depends on Firebase's default "one account per email" setting: confirm it in the console |
| SMS provider and phone number | ⏳ | The "Phone number: coming soon" row was removed from Settings. The `SmsProvider` port stays, unused |
| Batch admin broadcasts | ✅ | Answers at once, delivers in batches of 1,000, never duplicates, guards double-sends, records failures, retries, resumes after a restart (`broadcasts.e2e-spec`, 6 tests with 2,300 recipients). Admin UI shows progress and a retry control; that UI was not browser-tested (the test account is a moderator, who cannot broadcast) |
| Media shapes on listings | ✅ code · 🟡 visual check | API returns `photoAspects`; the detail page shows photos at their own shape with a full-screen viewer; cards are square from first paint with a category-icon fallback for broken images. API-tested. Not seen in a browser: the test account has no access to For Sale |
| Direct-upload sweep | ✅ | The existing design (uploads through the API; direct browser uploads optional and off) was kept. Added: abandoned direct uploads are deleted hourly (`storage.service.spec`) |
| Link previews, `robots`, sitemap, `metadataBase` | ✅ | Public pages have their own title, description, canonical URL and preview card; signed-in pages are `noindex`. 🟡 Set `NEXT_PUBLIC_APP_URL` in production or the URLs say `localhost` |
| Public neighbourhood pages | ⏳ | |
| Alternative verification methods | ⏳ | |
| Dark mode | ✅ signed-in app, onboarding, admin · ❌ public pages (by design) | System / Light / Dark in Settings → Account. No flash on load. Axe-clean in dark on ten pages. Seen by eye on the feed, settings, admin and help; resident-only screens (a populated feed, chat, listings) were not seen in dark |
| Accessibility pass | ✅ main pages · ❌ full audit | Fixed: unlabelled form fields, an unnamed password toggle, errors not tied to inputs, two sections whose content was hidden from screen readers, sub-AA teal and grey text, coral-on-coral badges, missing reduced-motion support. Axe reports no serious issues on 7 public and 10 signed-in pages. Not done: a screen-reader walkthrough, and decorative mock-ups on `/ai` and brand swatches on `/press` remain under AA contrast |
| Marketplace nav | ⏳ (kept as "Soon") | Verified in a browser: labelled "Soon" and leads to a coming-soon page |

## Documentation and cleanup

| Item | Status | Detail |
| --- | --- | --- |
| `/docs` as the tracked source of truth | ✅ | Un-ignored in `.gitignore`. Old plans and worklogs moved to `docs/archive/`; scanned for secrets before tracking |
| Root, web, API and mobile READMEs | ✅ | Rewritten against the code; they point here |
| `apps/web/.env.example` | ✅ | Every variable the web code reads, no values. `apps/api/.env.example` corrected |
| Stale "planned" comments | ✅ | Each endpoint was checked against the API's routes before its comment was changed to `live:` |
| `users.service.ts` TODO | ✅ removed | Obsolete: "join the nearest Hood when none matches" is the hood-request feature (contract §16), already built |
| Roadmap and current state | ✅ | `roadmap.md`, `current-state.md` |
| Dead files, unused UI, `JWT_*` | ✅ | Removed after a repository-wide reference check: `lib/firebase.ts`, `confirm-overlay.tsx`, `lib/coming-soon.ts`, six unused UI components and two Radix dependencies, `JWT_SECRET` / `JWT_EXPIRES_IN` |
| Mobile package manager / TypeScript | ⏳ | Resolved by taking mobile out of the workspace: it no longer affects installs. Align it when mobile work starts |

## Known issues left open

- The page gate remembers "live" per server instance for 60 seconds.
- Revocations made directly in Firebase (password reset, disabling a user in the console) take up to 30 seconds to reach the API, in exchange for not calling Google on every request. "Sign out everywhere" and admin suspensions are immediate (`authentication.md`).
- The Google OAuth client is missing `http://localhost:3000` (and the production origin) under Authorised JavaScript origins, so Google One Tap fails with `origin_mismatch` until they are added.
- `@nestjs/swagger` 11 is installed against NestJS 10 (a peer-dependency warning on install; it works).
- `turbo build` prints "IO error: No such file or directory" after a successful build (a cache-output warning; the build is fine).
- No Safari, Firefox or real-device testing.
