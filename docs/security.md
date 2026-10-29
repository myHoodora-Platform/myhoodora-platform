# Security

What the code enforces, what it deliberately doesn't, and what only a person can do. For sign-in and sessions see [`authentication.md`](./authentication.md).

## API

| Control | Where | Notes |
| --- | --- | --- |
| Authentication on every route | `FirebaseAuthGuard` (global) | Verifies the Firebase ID token and checks revocation (Firebase's record is re-read at most every 30 seconds per user; "sign out everywhere" is immediate from our own record). Routes are private unless marked `@Public()`. A bad token is 401; **not being able to reach Google is 503**, because the web signs people out on a 401. During an outage a user's last known revocation state is reused for up to 5 minutes |
| Account state | `AccountGuard` (global) | Suspended accounts are blocked except on a few routes that explain their status and let them appeal |
| Who may write | `capabilitiesOf` (`shared/authz/roles.ts`) | Posting, commenting, listing, creating groups, uploading content media and messaging need a verified address **and a confirmed email** (our emailed link, or a sign-in provider that proved it). Reading, reacting, RSVPs and reporting don't. `EMAIL_CONFIRMATION_REQUIRED=false` turns the email part off |
| Deleting personal data | `users/account-deletion.service.ts`, `StorageService.sweepUnreferenced` | 30 days after deactivation an account is deleted: content, uploads, memberships, notifications, the Firebase sign-in, and everything personal on the record. The other person's copy of a conversation stays, with the deleted person's id replaced by a stand-in. Moderation and audit history keep the bare uid. Media is deleted an hour after its post or listing is, and 31 days after staff remove it. Both run only when `DATA_DELETION_MODE=live` (default `dry-run`) |
| Who may read a Hood | `AccountGuard`, each service's `loadVisible` | Only a **verified** neighbour has a Hood on their request (`viewer.hoodId`), and every Hood-scoped read checks it. Staff rejecting a verification clears the Hood. A verified neighbour can move Hood by address check once every 90 days; staff can move them at any time. Hood centres and radii are returned only to staff and to a Hood's own members. `HOOD_ACCESS_STRICT=false` is a temporary rollback switch |
| Authorisation | `CapabilityGuard`, `@Can("…")` | Capabilities derive from role and account state. Scope (the person's Hood) always comes from the server |
| Input validation | Global `ValidationPipe` | Whitelist on; unknown fields are a 400 |
| Rate limiting | `FloodGuard`, then `AccountThrottlerGuard` (global) | Two stages. Before sign-in is checked: a high per-IP ceiling against floods (1,000 per 10 s). After it: 10/s, 60/min, 500/h **per person** (per IP on public routes), stricter per route. Per person because browsers call the API directly and a whole estate or mobile carrier can share one address. The web server's session routes are limited per credential and skip the flood ceiling, because they all arrive from one IP. Counters are in each instance's memory |
| Security headers | `helmet` in `main.ts` | `nosniff`, HSTS, frame protection, no `X-Powered-By`. Cross-origin resource policy is `cross-origin` because the web app is on another origin (CORS still decides who may read) |
| CORS | `main.ts` | Only origins in `CORS_ORIGIN` |
| Compression | `compression` in `main.ts` | The live event stream is excluded: compressing it would buffer events |
| Graceful shutdown | `enableShutdownHooks`, `forceCloseConnections` | On a deploy the API stops accepting work, lets modules clean up, and closes open streams |
| Startup checks | `validateEnv` | Production refuses to start without the database, email, CORS and Firebase Admin settings |
| Uploads | `storage/` | Type read from the file's bytes, size and duration limits enforced server-side, storage credentials never leave the API. Media for posts, listings and groups needs the standing to post; a profile photo needs only an account. Each person has a daily allowance (200 files, 1 GB by default) |
| Background jobs | `jobs/` | Work that outlives a request (telling a Hood about an alert) is recorded in MongoDB and claimed atomically by one instance; it survives a restart and is retried. A job can run more than once, so handlers are written to be safe to repeat |
| Webhooks | `communications/` | Resend events verified by signature on the raw body, with a replay window |
| Logging | `shared/logging`, guards | Tokens, cookies and credentials are never logged; auth failures log an error code only |
| Errors | `AllExceptionsFilter` | Unknown errors return a generic message; details stay in the server log |

## Web

Sent on every response (`apps/web/next.config.js`):

| Header | Value / effect |
| --- | --- |
| `Content-Security-Policy` | See below |
| `Strict-Transport-Security` | Two years, `includeSubDomains`. Ignored over plain HTTP, so harmless locally |
| `X-Frame-Options: DENY` and `frame-ancestors 'none'` | The site cannot be framed (clickjacking) |
| `X-Content-Type-Options: nosniff` | |
| `Referrer-Policy: strict-origin-when-cross-origin` | Token-bearing pages (`/verify-email`, `/business/claim`) tighten this to `no-referrer` |
| `Permissions-Policy` | Geolocation for this site only (onboarding); camera, microphone, payment and USB off |
| `Cross-Origin-Opener-Policy: same-origin-allow-popups` | Lets the Google sign-in pop-up report back |

### Content policy: what the site may load and talk to

| Directive | Allows | Because |
| --- | --- | --- |
| `default-src` | this site | Everything not listed below is refused |
| `script-src` | this site, inline, `accounts.google.com/gsi/client`, `apis.google.com` | Google One Tap and the Google sign-in pop-up |
| `style-src` | this site, inline, Google's One Tap stylesheet | |
| `img-src`, `media-src` | this site, `data:`, `blob:`, any `https:` | Neighbours can paste a photo link from any HTTPS site; uploads come from Cloudinary |
| `connect-src` | this site, the API, Firebase Auth, Google sign-in, OpenFreeMap, Cloudinary | |
| `frame-src` | the Firebase auth domain, Google's One Tap frame | |
| `worker-src` | this site, `blob:` | The map renders in a worker |
| `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` | | |

**Known limitation:** `script-src` includes `'unsafe-inline'`, because Next.js starts pages with inline scripts. The stricter option is a per-request nonce, which makes every page server-rendered on demand. Until then the policy limits *where* scripts, frames and connections can go, but not inline script injection. Development additionally allows `'unsafe-eval'` and WebSockets for hot reload.

**When you add a third-party service** used from the browser, add its origin here or it will be blocked. The browser test suite fails on any policy violation it sees.

### Session cookie

`__Host-session` in production: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`. The `__Host-` prefix means only this exact HTTPS host can set it. On plain-HTTP localhost it is `__session` without `Secure`. The two routes that set or clear it accept same-origin requests only.

If the web app is ever served through **Firebase Hosting rewrites**, the production name must change to `__session` (`apps/web/src/lib/auth/session-cookie.ts`): Firebase Hosting forwards no other cookie. It is not deployed that way today.

### Other

- Signed-in pages are `noindex` and excluded in `robots.txt`; the admin also sends `X-Robots-Tag`.
- `?next=` after login only accepts paths inside the app (`safeNextPath`).
- Non-staff get an ordinary 404 for `/admin`; the server checks before sending any admin code.

## Dependency overrides

`package.json` → `pnpm.overrides` forces two packages that `@nestjs/platform-express` 10 pins to exact, vulnerable versions. Even its newest 10.x release keeps them, and Nest 11 still pins a vulnerable multer, so a Nest upgrade would not remove the need.

| Override | Fixes | Remove when |
| --- | --- | --- |
| `@nestjs/platform-express>multer: ^2.5.0` | Upload-form denial of service (GHSA-v52c-386h-88mc, GHSA-xf7r-hgr6-v32p, GHSA-5528-5vmv-3xc2, GHSA-72gw-mp4g-v24j, GHSA-wc9g-mqfw-jrwm, GHSA-535w-7cp7-47q4, GHSA-q7qp-rjg7-q26m) | `@nestjs/platform-express` itself depends on multer ≥ 2.5.0 |
| `@nestjs/platform-express>body-parser: ^1.20.9` | A compressed body with trailing bytes crashes the process (GHSA-27r3-jxmh-p828) | it depends on body-parser ≥ 1.20.9 |

multer's guards against crafted field names (`fieldNestingDepth`, `fieldArrayIndexLimit`) are off unless set, so `POST /media` sets both to 0 (`storage.controller.ts`). The exception filter maps multer and body-parser errors by code and status, because Nest 10 matches multer errors by message text, which multer 2.4 changed.
| `qs@>=6.7.0 <6.16.1: ^6.16.1` | Denial of service in query-string parsing (GHSA advisories for qs ≤ 6.16.0, 29 October 2026) | express and body-parser accept qs ≥ 6.16.1 (they pin `~6.14.0`) |
| `js-yaml@>=4.0.0 <4.3.2: ^4.3.2` | Quadratic CPU on crafted YAML merge keys and `!!omap` | `@nestjs/swagger` depends on js-yaml ≥ 4.3.2 (it pins exactly 4.1.1) |

These four are the only lasting overrides. Other fixes from the audit below were lockfile refreshes within the ranges the packages already allow: they stay fixed without an override.

## Dependency audit (29 October 2026)

`pnpm audit` (pnpm 9) didn't finish on this lockfile (it ran for over 15 minutes and was stopped), so the lockfile's 1,600 packages were checked against npm's advisory database directly (the same `/-/npm/v1/security/advisories/bulk` endpoint `pnpm audit` uses), keeping only advisories whose range includes an installed version, and tracing each to the app that uses it.

**Before: 46 vulnerable package versions (107 advisories). After: 17 (26).** Fixed in three batches, each checked before the next, with no major-version upgrades:

| Batch | What | Checked with |
| --- | --- | --- |
| 1. API runtime (`929c544`) | proxy-addr 2.0.8 (IP spoofing), qs 6.16.2, body-parser 2.4.0 (express 5); mongoose 9.7.4 (prototype pollution); @fastify/busboy 3.2.4, @grpc/grpc-js 1.14.6, form-data 2.5.6/4.0.6, protobufjs 7.6.6 (firebase-admin); js-yaml 3.15.2/4.3.2 | API types, unit tests, all integration suites |
| 2. Web and app builds (`e56cc1f`) | postcss, nanoid, source-map-js, picomatch 2, minimatch 3/9, brace-expansion 1/2, browserslist, baseline-browser-mapping, node-forge | web unit tests and production build; app tests and iOS/Android bundle export |
| 3. Dev tooling (`d835565`) | handlebars, vite 7.3.7, fast-uri, flatted, follow-redirects, @humanfs/node, ajv 6 | lint, web and API unit tests |

**mongoose is held at `~9.7`.** 9.10 and later bring MongoDB driver 7.7, whose connection handshake the test database (mongod 8.2) refused ("Missing required sub-document 'driver'"), failing every API test. 9.7.4 has the fix and keeps driver 7.2. Before moving past 9.7, check the newer driver against Atlas and the test database.

**Left open, with why** (none reachable in a way that matters today):

| Package | Severity | Where | Why it stays | To fix |
| --- | --- | --- | --- | --- |
| @nestjs/core 10.4.22 | moderate | API | SSE `type`/`id` aren't stripped of newlines. Ours sends only fixed event names and no `id` (`realtime.controller.ts`), so nothing user-controlled reaches them | NestJS 11 (≥ 11.1.18): a major upgrade |
| file-type 20.4.1 | moderate | API, via @nestjs/common | Only used by Nest's `FileTypeValidator`, which the API doesn't use (uploads are checked by `StorageService`) | NestJS 11 |
| zod 3.25.76 | high | web, app, contract | Memory on oversized collections. Used for form and config validation of the person's own input in their own browser or phone | zod 4: API changes across the forms |
| @grpc/grpc-js 1.9.16 | high | web, app, via the Firebase client SDK's Firestore | Firestore isn't used (Auth only), and grpc-js is Node-only, not in the browser or app bundles | a Firebase SDK release that moves off `~1.9` |
| uuid 9.0.1 / 7.0.3 | moderate | firebase-admin's google-gax; Expo's build plugins | Only affects v3/v5/v6 called with a buffer; these call v4, or run at build time | upstream releases |
| decode-uri-component 0.2.2 | moderate | app, via expo-router's query-string | Slow decoding of a crafted link on the person's own phone, not a server | an expo-router release on query-string 8+ |
| deepmerge 4.3.1 | low | build tooling | No fixed version exists | — |
| vitest 3 (tinypool, @vitest/mocker) | critical/moderate | web tests only | Never in a build or deploy | vitest 4 |
| glob 10.4.5, picomatch 4.0.1, ajv 8.12.0, webpack 5.97.1, tmp 0.0.33 | high–low | `@nestjs/cli` 10 (exact pins) | Dev CLI, trusted input only | NestJS CLI 11 |
| sharp 0.34.5 | high | web dev dependency | Not used in production builds | sharp 0.35 (0.x minor, may change output) |

Next pass: the NestJS 11 upgrade clears five of these rows at once.

## Secrets

- All secrets are API-side. The web app needs none except the geocoding key (server-side only).
- `.env`, `.env.*` and `apps/api/serviceAccountKey.json` are git-ignored; only `.env.example` files are tracked.
- **History check:** a real Cloudinary URL was once committed in `apps/api/.env.example` (commits `532fc3c`, `a8fa360`). It has been removed from the file, but it is still in git history. The owner reported that key rotated on 7 October 2026, which makes the copy in history worthless; CI now scans new commits for credentials.

## Manual actions (cannot be done from the repository)

| Action | Why | How |
| --- | --- | --- |
| ~~Rotate the Cloudinary API key~~ | It is in git history | **Reported done by the owner, 7 October 2026.** Worth one check: the old key should be refused by Cloudinary |
| ~~Rotate the MongoDB password~~ | It was shared in plain text during development | **Reported done by the owner, 7 October 2026** |
| Verify the sending domain in Resend | Until then, mail only reaches the Resend account owner. **Posting and messaging now need a confirmed email, so until then nobody who signed up with a password can post**: run the API with `EMAIL_CONFIRMATION_REQUIRED=false` in the meantime | Add the DNS records Resend shows for `mail.myhoodora.com`; use a sending-only key |
| Turn on permanent deletion | The privacy policy promises deletion 30 days after deactivation. The job that does it starts in `dry-run` | Deploy, read a week of `[dry run]` log lines, take an Atlas backup, then set `DATA_DELETION_MODE=live` |
| Add production origins to Firebase and Google | Sign-in fails on unknown domains | Firebase → Authentication → Settings → Authorised domains; Google Cloud → Credentials → the web client → Authorised JavaScript origins |
| Disable the QA staff accounts | They are full-access logins | Firebase console → disable; set their role to `member` |
| Lawyer review of Privacy, Terms and Guidelines | They were written for NDPA 2023 without legal review | |

## Not done, on purpose

- No CSRF tokens: the API authenticates with a bearer header, not a cookie, and the only cookie-setting routes check the request's origin.
- No call to Google on every request. The page gate asks the API at most once a minute per session, and the API re-reads Firebase's revocation state at most every 30 seconds per user. Revocations made through this app are immediate regardless.
- No web application firewall or bot protection, and no automated dependency audit in CI: decide on these when planning the launch.
