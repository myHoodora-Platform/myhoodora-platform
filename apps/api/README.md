# myHoodora API

The NestJS backend for myHoodora. It serves the REST API described in [`docs/api-contract.md`](../../docs/api-contract.md) and consumed by `apps/web`.

- **Stack:** NestJS 10, TypeScript, MongoDB Atlas via Mongoose 9, Firebase Admin (auth), Resend (email), Cloudinary (media), Redis (live updates).
- **Project documentation:** [`/docs`](../../docs/README.md), in particular [architecture](../../docs/architecture.md), [authentication](../../docs/authentication.md), [security](../../docs/security.md) and the [deployment runbook](../../docs/deployment.md).
- **History:** the original audit and change logs are in [`docs/archive`](../../docs/archive/README.md).

## Run it

```bash
cp .env.example .env          # then fill in MONGODB_URI + Firebase
pnpm --filter @myhoodora/api dev
```

Swagger (every route, with request schemas generated from the DTOs) is at `/api/docs`, with the JSON at `/api/docs-json`. It's on outside production, and in production when `SWAGGER_ENABLED=true`.

| Command | What it does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start:prod` | Watch mode / compile to `dist/` (cleaned each build) / run the build |
| `pnpm check-types` · `pnpm lint` · `pnpm lint:fix` | Type-check · ESLint (reports only) · ESLint with auto-fix |
| `pnpm test` | Unit tests (`src/**/*.spec.ts`) |
| `pnpm test:e2e` | Integration tests (`test/*.e2e-spec.ts`), described below |
| `pnpm migrate:dry` · `pnpm migrate` | Show / apply pending data migrations (`src/database/migrations`) |
| `pnpm seed:neighborhoods` | Seed the Lagos Hoods |

## Environment

Every variable, with what is required in production, is in [`docs/environment.md`](../../docs/environment.md); the template is `.env.example`. In short:

- **Required in production** (the API refuses to start without them): `MONGODB_URI`, `APP_URL`, `CORS_ORIGIN`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `MAIL_FROM`, and Firebase Admin credentials (`FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`, or `GOOGLE_APPLICATION_CREDENTIALS`).
- **Locally:** set `PORT=3001` (the web app expects `http://localhost:3001/api`) and point `GOOGLE_APPLICATION_CREDENTIALS` at a service-account file (`serviceAccountKey.json` here is git-ignored).
- `MONGODB_URI` must be a replica set: transactions depend on it.
- Secrets live only in the server environment. None of these may be given a `NEXT_PUBLIC_` prefix.

## Architecture: a modular monolith

```
src/
  auth/          web session cookie (mint, liveness, staff gate), sign out everywhere, email-verification endpoints
  shared/        auth (Firebase guard, AccountGuard, @CurrentViewer), authz (roles → capabilities, @Can),
                 http (error filter, pagination, ObjectId pipe), db (withTransaction), logging (redaction)
  users/         self-service (me, onboarding, verify-location, preferences, blocks, deactivate, public profile)
                 + StaffUsersService (the only place account enforcement happens)
  hoods/         neighbourhoods: geo lookup, overlap checks, archive instead of delete
  posts/         feed, typed post fields, reactions, polls, RSVPs, alert lifecycle
  comments/      comments (+ denormalised commentCount)
  listings/      For Sale & Free
  groups/        groups, members, join requests, invite links, group posts
  chat/          conversations + messages (unread counts, preferences, blocks)
  businesses/    Business Page applications, staff review, claim links
  moderation/    reports → one case per item, claims, decisions; Hood Leads (routing, votes,
                 consensus, 48 h escalation); appeals; ModerationRegistry
  notifications/ in-app notifications (+ email per the neighbour's preferences)
  communications/ EmailProvider port → Resend adapter / log adapter, delivery log, Resend webhook
  verification/  email verification tokens
  audit/         append-only staff action history
  platform/      platform settings (report reasons, alert windows)
  admin/         /admin/* (contract §13): read models + staff actions over the modules above
  inbound/       contact, careers, AI pilot, feedback, in-app support → staff inbox
  storage/       uploads behind a StorageProvider port (Cloudinary adapter), media shapes, upload sweeps
  search/        posts, listings and neighbours in the caller's Hood
  realtime/      Server-Sent Events stream; bus over Redis, Mongo change streams or memory
  telemetry/     anonymous daily counters (kindness reminders)
  database/      migrations + runner, seed scripts
```

Rules the code follows:

- **Every request passes four global guards in order.** Rate limit, then Firebase token, then `AccountGuard` (loads the neighbour and blocks suspended accounts unless the route has `@AllowSuspended()`), then `CapabilityGuard` (`@Can("…")`).
- **Authorization uses capabilities, not role checks.** `capabilitiesOf(user)` in `shared/authz/roles.ts` combines role *and* account state. For example, a restricted admin still can't post, and a suspended one has no capabilities at all. Services receive a `Viewer` and never trust ids from the body.
- **Scope comes from the Viewer.** A neighbour's Hood comes from their profile, never from the client. Out-of-Hood content returns 404.
- **Multi-document writes use transactions** (`withTransaction`). Never run parallel operations inside one, and let errors (including duplicate keys) propagate so Mongo can abort cleanly.
- **Moderation doesn't import content modules.** Posts, comments, listings, groups, conversations and Business Pages register `load`/`setRemoved` with `ModerationRegistry`. Staff actions, Hood Lead consensus and appeal overturns all go through it.
- **Side effects happen after commit.** Emails and notifications are sent once the transaction succeeds, and `sendEmail` never throws into the caller.
- **Errors use one shape:** `{ statusCode, message }` (contract §0). Unknown errors are logged server-side and returned as a generic 500.

## Email

- `CommunicationsService.sendEmail()` is the only entry point. Every send has an idempotency key (our unique index plus Resend's `Idempotency-Key`) and is recorded in the `communications` collection.
- Resend webhooks (`POST /api/webhooks/resend`) are verified with the Standard Webhooks/Svix scheme on the **raw** body (`webhook-signature.ts`, node crypto; the `svix` package is ESM-only). They're applied idempotently per `svix-id`, and a status never moves backwards.
- **Setup:**
  1. Verify `mail.myhoodora.com` in Resend (SPF, DKIM and DMARC DNS records).
  2. Create a sending-only API key for that domain.
  3. Add a webhook to `https://<api-host>/api/webhooks/resend` for the `email.*` events.
  4. Put the key and signing secret in the server environment.

## Tests

`pnpm test:e2e` boots the real `AppModule` against `mongodb-memory-server` (a replica set, so transactions run). Only Firebase is stubbed: `test/helpers/firebase-mock.ts` turns tokens like `t:<uid>:<v|u>:<provider>` into users.

| Suite | Covers |
| --- | --- |
| `security` | Audit findings F1–F4, suspended/restricted/unverified gates, ownership, admin capabilities, owner rules, the web session-cookie routes |
| `media-search-realtime` | Uploads (type from bytes, ownership, delete), search scoping and validation, the live event stream |
| `broadcasts` | Batched delivery, no duplicates on re-run, double-send guard, failure + retry, resume after restart |
| `communications` | Welcome sent once, confirm / reuse / expiry, resend limit, webhook signature, replay, idempotency, status ordering |
| `moderation-engagement` | Report → case → claim → decision → feed/audit/notifications; reactions (incl. concurrent), polls (410), comments, blocks, urgent-alert limit |
| `marketplace-chat` | Listing scope/limits/sold visibility, idempotent listing threads, unread counts, messaging preferences, blocks, reports |
| `groups` | Creation limits, unique names, boundaries, join/requests/invites (incl. revoked links), last-admin rules, delete rule, user search, staff archive |
| `inbound-business` | Public forms (validation, dedupe, acks), support inbox replies, Business Page apply → approve → claim, capabilities |
| `leads-appeals` | Lead appointment, routing, voting + consensus, 48 h escalation, author/reporter appeals, reviewer ≠ decider, overturn, telemetry |
| `admin-contract` | Every `/admin/*` response has the fields the web's TypeScript types require (parsed from `apps/web`) |
| `migrations` | Dry run writes nothing; legacy data is migrated once; re-runs are no-ops |

## Deploying

The API is deployed **before** the web app. The full runbook (order, health checks, migrations, rollback) is [`docs/deployment.md`](../../docs/deployment.md). In short:

1. Set the environment. Swagger is off in production and `trust proxy` is set automatically.
2. `pnpm --filter @myhoodora/api build`, then `node dist/main.js`. It shuts down cleanly on `SIGTERM`.
3. `pnpm migrate:dry`, read the output, then `pnpm migrate`. Migrations are idempotent and recorded in the `migrations` collection.
4. Missing indexes are created at boot unless `MONGO_AUTO_INDEX=false`.

## File storage

Photos and videos are uploaded through `POST /api/media`; the browser never talks to a storage vendor and never sees its credentials (contract §20).

- **Layers:** business modules → `StorageService` (`src/storage/storage.service.ts`: validation, folders, ownership in `media_assets`) → `StorageProvider` port (`providers/storage-provider.ts`) → an adapter. `CloudinaryStorageAdapter` is the only file that imports the `cloudinary` SDK.
- **How files travel:** uploads stream to a temp file (`os.tmpdir()/myhoodora-uploads`), the real type is read from the bytes, and the adapter streams the file from disk to the provider in one request. Temp files are always deleted, and stale ones are swept at startup and hourly. At most `STORAGE_MAX_CONCURRENT_UPLOADS` go at once per instance.
- **Cloudinary:** set `CLOUDINARY_URL` from the Cloudinary console (API Keys). Its shape is checked at startup and the value is never logged. Files land in `myhoodora/<NODE_ENV>/<purpose>/`.
- **Switching provider:** write `providers/<name>-storage.adapter.ts` implementing `upload`, `delete` and `url`, add a `case` in `createStorageProvider()` (`storage.module.ts`), then set `STORAGE_PROVIDER=<name>`. Nothing else changes. An unknown `STORAGE_PROVIDER` stops the API at startup.
- **Tests:** `storage.service.spec.ts` (fake provider), `cloudinary-storage.adapter.spec.ts` (fake SDK), `storage.module.spec.ts` (selection).
