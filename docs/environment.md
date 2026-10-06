# Environment variables

Names and meanings only. Real values live in each host's environment settings and in git-ignored local files (`apps/api/.env`, `apps/web/.env.local`). Templates: `apps/api/.env.example`, `apps/web/.env.example`.

**Rule:** anything prefixed `NEXT_PUBLIC_` is compiled into the browser bundle. Never give a secret that prefix. All secrets belong to the API.

## API (`apps/api/.env`)

In production the API refuses to start if a **Required** variable is missing (`validateEnv` in `src/config/configuration.ts`).

| Variable | Required in production | Purpose |
| --- | --- | --- |
| `NODE_ENV` | yes (`production`) | Turns on env validation, proxy trust, and turns Swagger off |
| `PORT` | no (default 3000; use 3001 locally) | Port to listen on. Most hosts set it for you |
| `MONGODB_URI` | **Required** | MongoDB connection string. Must be a replica set |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | **Required** (all three), unless… | Firebase Admin service account. The API verifies every token with it |
| `GOOGLE_APPLICATION_CREDENTIALS` | …this is set instead | Path to a service-account JSON file. The usual choice locally |
| `CORS_ORIGIN` | **Required** | Comma-separated web origins allowed to call the API |
| `APP_URL` | **Required** | The web app's public URL, for links in emails |
| `RESEND_API_KEY` | **Required** | Sending-only Resend key. Empty outside production = emails are logged, not sent |
| `RESEND_WEBHOOK_SECRET` | **Required** | `whsec_…` signing secret of the Resend webhook |
| `MAIL_FROM` | **Required** | Sender, e.g. `myHoodora <hello@mail.myhoodora.com>` |
| `MAIL_REPLY_TO` | no | Reply-To address |
| `CLOUDINARY_URL` | needed for uploads | `cloudinary://<key>:<secret>@<cloud>`. Without it `POST /media` answers 503. Its shape is checked at startup and it is never logged |
| `STORAGE_PROVIDER` | no (default `cloudinary`) | Which storage adapter to use |
| `STORAGE_MAX_CONCURRENT_UPLOADS` | no (default 4) | Uploads one instance sends to storage at once |
| `STORAGE_DAILY_UPLOADS` | no (default 200) | Files one person may upload in any 24 hours (counted from the files they still have stored) |
| `STORAGE_DAILY_UPLOAD_MB` | no (default 1024) | Total size, in MB, one person may upload in any 24 hours |
| `STORAGE_DIRECT_UPLOADS` | no (default off) | `true` lets browsers upload videos straight to storage |
| `REDIS_URL` | recommended with more than one instance | Live updates across instances. Without it: MongoDB change streams, then in-memory |
| `REALTIME_BUS` | no (default `auto`) | `auto` \| `redis` \| `mongo` \| `memory` |
| `REALTIME_ENV` | no (defaults to `NODE_ENV`) | Keeps environments that share Redis or MongoDB apart |
| `SESSION_COOKIE_TTL_DAYS` | no (default 7) | Lifetime of the web session cookie; clamped to Firebase's 5 minutes–14 days |
| `AUTH_REVOCATION_CACHE_SECONDS` | no (default 30, max 300) | How long the API trusts Firebase's last answer about a user's sessions. `0` asks Google on every request |
| `NEARBY_BUFFER_M` | no (default 3000) | How far outside a Hood an address can be and still ask to join |
| `HOOD_CHANGE_COOLDOWN_DAYS` | no (default 90) | Days a verified neighbour must wait before an address check can move them to a different Hood. `0` removes the wait |
| `HOOD_ACCESS_STRICT` | no (default on) | Rollback switch for the Hood access rules (see [security.md](./security.md)). `false` restores the behaviour before October 2026. Temporary: remove once the rules have bedded in |
| `EVENT_REMINDERS_ENABLED` | no (default on) | `false` pauses the reminder scheduler |
| `MONGO_AUTO_INDEX` | no (default on) | `false` once indexes are managed in Atlas |
| `SWAGGER_ENABLED` | no | `true` exposes `/api/docs` in production |

Local-only, never set in production: `QA_OWNER_EMAIL` / `QA_OWNER_PASSWORD` (and `QA_ADMIN_…`, `QA_MODERATOR_…`), the test staff accounts the browser tests use.

Removed: `JWT_SECRET`, `JWT_EXPIRES_IN`. The API never issued its own tokens; nothing read them.

## Web (`apps/web/.env.local`)

| Variable | Needed | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_STORAGE_BUCKET`, `…_MESSAGING_SENDER_ID`, `…_APP_ID` | yes | The Firebase web app's config. Public identifiers, not secrets |
| `NEXT_PUBLIC_API_URL` | yes in production | The API, including `/api`. Default `http://localhost:3001/api`. Also feeds the content policy's allowed connections |
| `NEXT_PUBLIC_APP_URL` | yes in production | This site's public origin. Used for canonical URLs, link previews, `robots.txt` and the sitemap |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | optional | OAuth web client ID of the Firebase Google provider. Enables the One Tap prompt. Public |
| `NEXT_PUBLIC_USE_MOCKS` | no (default off) | `true` runs on in-browser sample data. Never in production |
| `GEOCODE_MAPS_CO_API_KEY` | for address search | Server-side key for onboarding's address lookup (`/api/geocode`) |

`NEXT_PUBLIC_*` values are fixed at **build** time: changing one means rebuilding the web app.

## Tests and CI

| Variable | Used by | Purpose |
| --- | --- | --- |
| `E2E_BASE_URL` | Playwright | Test an already-running site instead of starting `pnpm dev` |
| `E2E_EMAIL`, `E2E_PASSWORD` | Playwright (`auth.spec.ts`) | The test account. Default to the QA moderator from `apps/api/.env` when run locally |
| `TEST_MONGO_URI` | API integration tests | Set by the test setup (in-memory MongoDB); not something you provide |
| `CI` | Playwright | Enables a retry and the HTML report |

## Adding a variable

1. Read it in `apps/api/src/config/configuration.ts` (API) or directly as `process.env.X` (web).
2. Add it to the matching `.env.example` with a comment and a safe example value.
3. Add it to `globalEnv` in `turbo.json` so builds are not cached across different values.
4. Add a row here.
