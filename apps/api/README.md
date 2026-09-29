# myHoodora API

The NestJS backend for myHoodora. It serves the REST API described in [`docs/api-contract.md`](../../docs/api-contract.md) and consumed by `apps/web`.

- **Stack:** NestJS 10, TypeScript, MongoDB Atlas via Mongoose 9, Firebase Admin (auth), Resend (email).
- **Design notes and audit:** [`docs/backend/BACKEND_AUDIT_AND_TARGET.md`](../../docs/backend/BACKEND_AUDIT_AND_TARGET.md).
- **Change log:** [`docs/backend/BACKEND_CHANGELOG.md`](../../docs/backend/BACKEND_CHANGELOG.md).

## Run it

```bash
cp .env.example .env          # then fill in MONGODB_URI + Firebase
pnpm --filter @myhoodora/api dev
```

Swagger is served at `/api/docs` outside production.

| Command | What it does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start:prod` | Watch mode / compile to `dist/` (cleaned each build) / run the build |
| `pnpm check-types` · `pnpm lint` | Type-check · ESLint |
| `pnpm test` | Unit tests (`src/**/*.spec.ts`: authorization rules, post codec) |
| `pnpm test:e2e` | Integration tests (`test/*.e2e-spec.ts`), described below |
| `pnpm migrate:dry` · `pnpm migrate` | Show / apply pending data migrations (`src/database/migrations`) |
| `pnpm seed:neighborhoods` | Seed the Lagos Hoods |

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | ✅ | Must be a replica set (Atlas is one); transactions depend on it |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | ✅ in prod | Or `GOOGLE_APPLICATION_CREDENTIALS` / `serviceAccountKey.json` locally |
| `PORT` | | Default `3000`. The web app expects `http://localhost:3001/api` unless `NEXT_PUBLIC_API_URL` says otherwise, so set `PORT=3001` locally |
| `CORS_ORIGIN` | ✅ in prod | Comma-separated list of web origins |
| `APP_URL` | ✅ in prod | Web app URL, used for links in emails |
| `RESEND_API_KEY` | ✅ in prod | A **sending-only** key for `mail.myhoodora.com`. If empty, emails are logged (masked), not sent |
| `RESEND_WEBHOOK_SECRET` | ✅ in prod | `whsec_…` from the Resend webhook. Without it the webhook returns 503 |
| `MAIL_FROM` / `MAIL_REPLY_TO` | | Default `myHoodora <hello@mail.myhoodora.com>` |

In production the app refuses to start if a required variable is missing (`validateEnv`). Secrets live only in the server environment. None of these may be given a `NEXT_PUBLIC_` prefix.

## Architecture: a modular monolith

```
src/
  shared/        auth (Firebase guard, AccountGuard, @CurrentViewer), authz (roles → capabilities, @Can),
                 http (error filter, pagination, ObjectId pipe), db (withTransaction), logging (redaction)
  users/         self-service (me, onboarding, verify-location, preferences, blocks, deactivate, public profile)
                 + StaffUsersService (the only place account enforcement happens)
  hoods/         neighbourhoods: geo lookup, overlap checks, archive instead of delete
  posts/         feed, typed post fields, reactions, polls, RSVPs, alert lifecycle
  comments/      comments (+ denormalised commentCount)
  moderation/    reports → one case per item, claims, decisions; ModerationRegistry
  notifications/ in-app notifications (+ email per the neighbour's preferences)
  communications/ EmailProvider port → Resend adapter / log adapter, delivery log, Resend webhook
  verification/  email verification tokens
  audit/         append-only staff action history
  platform/      platform settings (report reasons, alert windows)
  admin/         /admin/* (contract §13): read models + staff actions over the modules above
  inbound/       feedback (contact form in pass 2)
  database/      migrations + runner, seed scripts
```

Rules the code follows:

- **Every request passes four global guards in order.** Rate limit, then Firebase token, then `AccountGuard` (loads the neighbour and blocks suspended accounts unless the route has `@AllowSuspended()`), then `CapabilityGuard` (`@Can("…")`).
- **Authorization uses capabilities, not role checks.** `capabilitiesOf(user)` in `shared/authz/roles.ts` combines role *and* account state. For example, a restricted admin still can't post, and a suspended one has no capabilities at all. Services receive a `Viewer` and never trust ids from the body.
- **Scope comes from the Viewer.** A neighbour's Hood comes from their profile, never from the client. Out-of-Hood content returns 404.
- **Multi-document writes use transactions** (`withTransaction`). Never run parallel operations inside one, and let errors (including duplicate keys) propagate so Mongo can abort cleanly.
- **Moderation doesn't import content modules.** Posts and comments register `load`/`setRemoved` with `ModerationRegistry`. New content types (listings, groups, messages) plug in the same way.
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
| `security` | Audit findings F1–F4, suspended/restricted/unverified gates, ownership, admin capabilities, owner rules |
| `communications` | Welcome sent once, confirm / reuse / expiry, resend limit, webhook signature, replay, idempotency, status ordering |
| `moderation-engagement` | Report → case → claim → decision → feed/audit/notifications; reactions (incl. concurrent), polls (410), comments, blocks, urgent-alert limit |
| `admin-contract` | Every live `/admin/*` response has the fields the web's TypeScript types require (parsed from `apps/web`) |
| `migrations` | Dry run writes nothing; legacy data is migrated once; re-runs are no-ops |

## Deploying

1. Set the environment above. Keep Swagger off (automatic in production) and set `trust proxy` (automatic).
2. `pnpm --filter @myhoodora/api build`.
3. Run `pnpm migrate:dry`, read the output, then `pnpm migrate`. Migrations are idempotent and recorded in the `migrations` collection.
4. Start with `node dist/main.js`. Indexes aren't auto-built in production; create them once with `Model.syncIndexes()` or in Atlas.

## Firebase Storage rules

The feed's image upload writes to `posts/{uid}/…`. Suggested rule:

```
match /posts/{uid}/{fileName} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == uid
    && request.resource.size < 8 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
}
```
