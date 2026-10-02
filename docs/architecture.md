# Architecture

```text
                    Browser
        ┌──────────────┴───────────────┐
        │ pages, session cookie        │ data: Bearer <Firebase ID token>
        ▼                              ▼
  apps/web (Next.js)   ───────►   apps/api (NestJS)  ───►  MongoDB (Atlas)
   proxy.ts page gate   server       REST + SSE       ───►  Redis (realtime fan-out)
   /api/auth/* routes   to server                     ───►  Cloudinary (media)
        │                                             ───►  Resend (email)
        └──────────────► Firebase Auth ◄──────────────┘     (Admin SDK verifies tokens)
```

Two things to hold on to:

1. **The browser talks to the API directly for all data**, with the signed-in person's Firebase ID token. The web server is not a data proxy.
2. **The web server only decides which page to serve.** It does that from a session cookie, and asks the API two narrow questions about it (still live? staff?).

## Repository

```text
apps/
  web/        Next.js 16 app (marketing, signed-in app, admin)
  api/        NestJS 10 API
  mobile/     Expo starter. Post-MVP, outside the pnpm workspace
packages/
  ui/                  shared React components
  eslint-config/       shared ESLint config
  typescript-config/   shared tsconfig bases
docs/         this documentation
brand/        brand system (logos, palette)
```

pnpm workspace (`apps/*`, `packages/*`, minus `apps/mobile`), orchestrated by Turborepo (`turbo.json`).

## Web app (`apps/web`)

```text
src/
  proxy.ts            the page gate (runs before every page request)
  app/
    page.tsx, about/, privacy/, …   public pages
    (auth)/           login, register, forgot/reset password, verify email
    (app)/            the signed-in app: news-feed, alerts, events, for-sale, groups, inbox, …
    onboarding/       address verification
    admin/            staff portal
    api/auth/         session + logout route handlers (set and clear the cookie)
    api/geocode/      address lookup (server-side key)
    robots.ts, sitemap.ts
  context/AuthContext.tsx   Firebase user, profile, server-session state
  features/           one folder per product area (feed, chat, groups, admin, settings, …)
  components/         layout (app shell, marketing header/footer) and shared pieces
  lib/
    api/              typed API client, one file per domain; `mock/` is the in-browser sample backend
    auth/             session cookie (server), session sync (client), page-gate checks
    firebase/         Firebase client setup and sign-in helpers
    realtime/         SSE client
    routes.ts         every URL, and which are public / guest-only / protected
    theme.ts, site.ts theme preference; site origin and page metadata
```

- **Routing and protection:** `lib/routes.ts` lists the public pages. Everything else is protected by default, so a new page cannot ship public by accident. `proxy.ts` enforces it (see `authentication.md`).
- **Data:** `lib/api/client.ts` attaches the ID token, times out, and turns failures into typed errors. Each feature calls its `lib/api/<domain>.ts`.
- **Mock mode:** `NEXT_PUBLIC_USE_MOCKS=true` serves every API call from `lib/api/mock`. `ENDPOINTS` in `lib/api/config.ts` can also switch a single domain to the mock while the rest is live. In mock mode there is no server session and no server-side gate.
- **Live updates:** `lib/realtime` keeps one SSE stream; hooks refetch when a relevant event arrives.
- **Theming:** design tokens (CSS variables) in `app/globals.css`, light and dark. `lib/theme.ts` applies the choice; only the signed-in app, onboarding and admin are themed.

## API (`apps/api`)

A modular monolith. One Nest module per domain under `src/`:

```text
shared/         guards, authorisation (roles → capabilities), HTTP helpers, logging
auth/           web session cookie, sign out everywhere, email-verification endpoints
users/ hoods/ posts/ comments/ listings/ groups/ chat/ businesses/
moderation/     reports → cases → decisions, Hood Leads, appeals
notifications/ communications/ verification/ audit/ platform/
admin/          /admin/* read models and staff actions over the modules above
inbound/        contact, careers, support inbox
storage/        uploads behind a StorageProvider port (Cloudinary adapter)
search/ realtime/ telemetry/
database/       migrations + runner, seed script
config/         typed configuration, env validation, Firebase Admin setup
```

Rules the code follows:

- **Four global guards, in order:** rate limit → Firebase token → account state (`AccountGuard` loads the person and blocks suspended accounts) → capability (`@Can("…")`).
- **Capabilities, not role checks.** `shared/authz/roles.ts` derives what someone can do from their role *and* account state.
- **Scope comes from the server.** A person's Hood is read from their record, never from the request. Content outside it answers 404.
- **Multi-document writes use transactions**, so MongoDB must be a replica set.
- **Ports and adapters for infrastructure:** email (`EmailProvider`), storage (`StorageProvider`), realtime bus (Redis / Mongo change streams / memory), SMS (port only). Swapping a vendor is one adapter.
- **Side effects after commit.** Emails and notifications are sent once the write has succeeded.
- **One error shape:** `{ statusCode, message }`.
- **Long work doesn't hold a request.** Admin broadcasts answer immediately and deliver in batches; each notification has a unique key, so delivery is safe to repeat.

Interactive API docs (Swagger) are at `/api/docs` outside production, or in production with `SWAGGER_ENABLED=true`. The contract the web relies on is [`api-contract.md`](./api-contract.md).

## Data

MongoDB via Mongoose. Collections follow the modules (users, neighbourhoods, posts, reactions, comments, listings, groups, conversations, messages, notifications, reports, moderation cases, audit log, media assets, broadcasts, communications…). Migrations are idempotent and recorded in a `migrations` collection. Unique indexes carry real rules (one reaction per person per post, one vote per poll, one notification per broadcast per person), and are created at boot unless `MONGO_AUTO_INDEX=false`.

## Why these choices

- **Firebase for identity, our API for everything else:** no passwords or OAuth flows to run ourselves; roles, Hoods and account state stay in our database where the API can enforce them.
- **Session cookie only for page routing:** the proxy can send a signed-in person straight to their feed (and a signed-out one to login) without waiting for JavaScript, while data access stays behind a short-lived token checked on every call.
- **No queue or worker:** current volumes fit in-process batches made safe to retry. If broadcasts or email grow past that, a hosted queue is the next step, behind the same interfaces.

## Where the time goes

Measured on a development laptop on 2 October 2026, signing in and loading a page:

| Step | Time locally | In production |
| --- | --- | --- |
| Firebase sign-in (browser → Google) | 0.3–1.5 s, sometimes several seconds | Depends on the user's own connection to Google |
| Revocation check (API → Google) | about 330 ms, **once per user per 30 seconds** (it used to be every request) | Tens of milliseconds from a cloud host |
| Each MongoDB round trip (API → Atlas) | about 165 ms | A few milliseconds when the API runs in the same region as the cluster |
| Minting the session cookie (API → Google) | about 0.5 s, once per sign-in | Faster from a cloud host |

An authenticated API call costs about 0.27 s on a laptop, which is two database round trips to a distant cluster. It was about 0.67 s before the revocation check stopped calling Google on every request. In production it should be a few tens of milliseconds. **Put the API in the same region as the Atlas cluster**; nothing else changes this as much.

Two design choices add time on purpose:

- **Revocation is checked on every request, but Google is asked at most once per user per 30 seconds** (`auth/session-revocation.service.ts`, `AUTH_REVOCATION_CACHE_SECONDS`). This is the usual pattern for token-based sessions: verify the signature locally, keep your own fast record of revocations, and re-check with the identity provider occasionally. "Sign out everywhere" and admin suspensions are still immediate, because they are also recorded on our own user record, which is read on every request. Only changes made directly in Firebase (a password reset, or disabling a user in the console) can take up to 30 seconds to reach the API.
- **After sign-in the app does a full page load** rather than a client-side navigation, so the browser cannot replay a cached redirect to the login page. That costs one extra start-up (a Firebase lookup and a profile request).

