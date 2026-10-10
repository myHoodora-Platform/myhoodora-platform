# Deployment runbook

Two things are deployed: the **API** (`apps/api`, a Node process) and the **web app** (`apps/web`, Next.js). **The API always goes first**: the web app calls API routes that may be new in the same release (sign-in depends on `POST /auth/session` and the page gate on `GET /auth/session`), and a web build pointing at an older API fails at login.

The repository contains no hosting configuration. Development has used a Node host for the API and a Next.js host for the web; the Firebase project currently authorises a `*.vercel.app` domain. Confirm hosts and domains in your own dashboards: this runbook is host-neutral.

## Before the first production deploy

Do these once. They are all manual; details in [`security.md`](./security.md).

- [ ] Rotate the Cloudinary key and the MongoDB password.
- [ ] Verify the sending domain in Resend; create a sending-only key and the webhook (`https://<api-host>/api/webhooks/resend`, `email.*` events).
- [ ] Firebase → Authentication → Settings → **Authorised domains**: add the production web domain.
- [ ] Google Cloud → Credentials → the OAuth web client → **Authorised JavaScript origins**: add the production web origin (for Google One Tap).
- [ ] Decide the web domain. HSTS is sent with `includeSubDomains`: every subdomain of the web host must serve HTTPS.
- [ ] Lawyer review of Privacy, Terms and Guidelines.

## 1. Configure and deploy the API

1. Set the environment on the API host ([`environment.md`](./environment.md)). In production the API **will not start** without: `MONGODB_URI`, `APP_URL`, `CORS_ORIGIN`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `MAIL_FROM`, and Firebase Admin credentials (`FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`, or `GOOGLE_APPLICATION_CREDENTIALS`). Also set `NODE_ENV=production`, `CLOUDINARY_URL` and, with more than one instance, `REDIS_URL`.
   - `CORS_ORIGIN` must list the exact web origin(s), comma-separated.
   - Paste `FIREBASE_PRIVATE_KEY` with `\n` for line breaks; the API converts them.
2. Build and start:
   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @myhoodora/api build
   node apps/api/dist/main.js
   ```
3. The host should send `SIGTERM` on redeploy; the API shuts down cleanly (stops accepting requests, closes open streams).

## 2. Verify the API

```bash
curl -s https://<api-host>/api/health            # 200, database "up"
curl -s -o /dev/null -w "%{http_code}\n" https://<api-host>/api/users/me     # 401: auth is on
curl -sI https://<api-host>/api/health | grep -i "strict-transport\|x-content-type"   # security headers present
curl -s -o /dev/null -w "%{http_code}\n" https://<api-host>/api/docs        # 404: Swagger is off in production
```

If it doesn't start, read the first log lines: a missing variable is named there ("Missing required environment variables: …").

## 3. Run migrations

From a machine (or a one-off job) with the production `MONGODB_URI`:

```bash
pnpm --filter @myhoodora/api migrate:dry     # read what it would do
pnpm --filter @myhoodora/api migrate         # apply
```

Migrations are idempotent and recorded in the `migrations` collection: running them twice is safe. Missing indexes are created when the API boots (unless `MONGO_AUTO_INDEX=false`).

First deploy only, if the Hoods aren't there yet: `pnpm --filter @myhoodora/api seed:neighborhoods`.

## 4. Configure the web app

Set on the web host **before building** (these are compiled in):

- `NEXT_PUBLIC_API_URL` = `https://<api-host>/api`
- `NEXT_PUBLIC_APP_URL` = the public web origin, e.g. `https://www.myhoodora.com`
- the six `NEXT_PUBLIC_FIREBASE_*` values
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional, for One Tap)
- `GEOCODE_MAPS_CO_API_KEY`
- **not** `NEXT_PUBLIC_USE_MOCKS`

## 5. Verify authentication and external services (against the API, before the web goes live)

- Sign in on the *current* web build or a preview build pointed at the new API: the feed loads.
- Upload a photo in a post: it appears (Cloudinary).
- Trigger a verification email resend (Settings banner): it arrives (Resend), and the Resend dashboard shows the webhook delivering.

## 6. Deploy the web app

```bash
pnpm install --frozen-lockfile
pnpm --filter web build
pnpm --filter web start        # or the host's Next.js runtime
```

## 7. Verify web → API

```bash
curl -sI https://<web-host>/ | grep -i "content-security-policy\|strict-transport"
curl -s https://<web-host>/robots.txt | head -3                    # the sitemap line shows the production domain
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<web-host>/news-feed    # 307 → /login
```

In the response headers, the content policy's `connect-src` must contain the production API origin. If it shows `localhost:3001`, `NEXT_PUBLIC_API_URL` was missing at build time: set it and rebuild.

## 8. Smoke test in a browser

1. Open `/` signed out: landing page, no console errors.
2. Sign up with a new email → onboarding → verify an address → the feed.
3. Sign in with Google (button, then One Tap in a fresh window).
4. Post with a photo; comment; react.
5. Close the browser, reopen, open `/`: straight to the feed, no login page.
6. Log out: back at login; `/news-feed` redirects to login.
7. As staff: `/admin` loads; as a resident it is a 404.
8. Settings → Account → Sign out everywhere, with a second browser signed in: both end at login.

Or run the automated suite against the deployment with a dedicated test account:

```bash
E2E_BASE_URL=https://<web-host> E2E_EMAIL=… E2E_PASSWORD=… pnpm --filter web test:e2e
```

(The signed-in suite signs that account out everywhere when it finishes.)

## Rollback

- **Web:** redeploy the previous build. It is stateless.
- **API:** redeploy the previous build. Check first that the *previous web build* doesn't need routes only the new API has; if both changed, roll back the web first, then the API.
- **Migrations** are forward-only and additive (new fields beside old ones). Rolling the code back does not require undoing them. If a migration itself is wrong, fix forward with a new migration.
- **Sessions:** changing the cookie format or name signs nobody out permanently: the client re-creates the cookie from the Firebase session on the next page load.

## After launch

- Disable the QA staff accounts.
- Watch the API logs for `Broadcast … failed part-way` (retry from Admin → Broadcasts) and upload sweeps.
- Rotating a secret: change it at the provider, update the host environment, redeploy the API. Nothing in the repository changes.
