# Security

What the code enforces, what it deliberately doesn't, and what only a person can do. For sign-in and sessions see [`authentication.md`](./authentication.md).

## API

| Control | Where | Notes |
| --- | --- | --- |
| Authentication on every route | `FirebaseAuthGuard` (global) | Verifies the Firebase ID token and checks revocation (Firebase's record is re-read at most every 30 seconds per user; "sign out everywhere" is immediate from our own record). Routes are private unless marked `@Public()` |
| Account state | `AccountGuard` (global) | Suspended accounts are blocked except on a few routes that explain their status |
| Authorisation | `CapabilityGuard`, `@Can("…")` | Capabilities derive from role and account state. Scope (the person's Hood) always comes from the server |
| Input validation | Global `ValidationPipe` | Whitelist on; unknown fields are a 400 |
| Rate limiting | `ThrottlerGuard` (global) | 10/s, 60/min, 500/h per IP; stricter per route. The web server's two session routes are limited per credential instead, because they all arrive from one IP |
| Security headers | `helmet` in `main.ts` | `nosniff`, HSTS, frame protection, no `X-Powered-By`. Cross-origin resource policy is `cross-origin` because the web app is on another origin (CORS still decides who may read) |
| CORS | `main.ts` | Only origins in `CORS_ORIGIN` |
| Compression | `compression` in `main.ts` | The live event stream is excluded: compressing it would buffer events |
| Graceful shutdown | `enableShutdownHooks`, `forceCloseConnections` | On a deploy the API stops accepting work, lets modules clean up, and closes open streams |
| Startup checks | `validateEnv` | Production refuses to start without the database, email, CORS and Firebase Admin settings |
| Uploads | `storage/` | Type read from the file's bytes, size and duration limits enforced server-side, storage credentials never leave the API |
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

## Secrets

- All secrets are API-side. The web app needs none except the geocoding key (server-side only).
- `.env`, `.env.*` and `apps/api/serviceAccountKey.json` are git-ignored; only `.env.example` files are tracked.
- **History check before you push:** a real Cloudinary URL was once committed in `apps/api/.env.example` (commits `532fc3c`, `a8fa360`). It has been removed from the file, but it is still in git history. Rotate that key (below).

## Manual actions (cannot be done from the repository)

| Action | Why | How |
| --- | --- | --- |
| Rotate the Cloudinary API key | It is in git history | Cloudinary console → Settings → API Keys → generate new, delete old. Put the new `CLOUDINARY_URL` in the API host's environment and your local `.env` |
| Rotate the MongoDB password | It was shared in plain text during development | Atlas → Database Access → edit user → new password. Update `MONGODB_URI` on the API host and locally |
| Verify the sending domain in Resend | Until then, mail only reaches the Resend account owner | Add the DNS records Resend shows for `mail.myhoodora.com`; use a sending-only key |
| Add production origins to Firebase and Google | Sign-in fails on unknown domains | Firebase → Authentication → Settings → Authorised domains; Google Cloud → Credentials → the web client → Authorised JavaScript origins |
| Disable the QA staff accounts | They are full-access logins | Firebase console → disable; set their role to `member` |
| Lawyer review of Privacy, Terms and Guidelines | They were written for NDPA 2023 without legal review | |

## Not done, on purpose

- No CSRF tokens: the API authenticates with a bearer header, not a cookie, and the only cookie-setting routes check the request's origin.
- No call to Google on every request. The page gate asks the API at most once a minute per session, and the API re-reads Firebase's revocation state at most every 30 seconds per user. Revocations made through this app are immediate regardless.
- No web application firewall or bot protection, and no automated dependency audit in CI: decide on these when planning the launch.
