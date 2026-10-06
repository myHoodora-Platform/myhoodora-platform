# Current state

_Last verified against the code: 2 October 2026._

myHoodora is a neighbourhood network for Nigeria: verified neighbours share posts, alerts, events and items for sale within their own "Hood". This page says what exists, in five words used consistently:

- **Implemented**: in the code, tested, working.
- **In progress**: partly there; the gap is stated.
- **Planned**: agreed for the MVP, not started.
- **Post-MVP**: deliberately deferred until after launch.
- **Removed / deferred**: was in the product or docs, now taken out.

## The MVP

The web app and the API, used by residents and by staff. A resident can sign up, confirm their neighbourhood, read and write in their Hood, message neighbours, and manage their account. Staff can moderate, verify, manage Hoods and message residents from the admin.

## Apps and packages

| Path | What | Status |
| --- | --- | --- |
| `apps/web` | Next.js 16 (App Router, React 19, Tailwind 4): marketing site, the signed-in app, the admin | Implemented |
| `apps/api` | NestJS 10 REST API on MongoDB | Implemented |
| `packages/ui` | Shared React components (buttons, inputs, dialogs, sidebar…) | Implemented |
| `packages/eslint-config`, `packages/typescript-config` | Shared lint and TypeScript settings | Implemented |
| `apps/mobile` | Expo starter project, no screens | **Post-MVP.** Outside the workspace: not installed, linted, tested or built with the rest |

## Features

| Area | Status | Notes |
| --- | --- | --- |
| Email + password sign-up and sign-in | Implemented | Firebase Auth |
| Google sign-in (button and One Tap) | Implemented; **needs a manual click-test** | Enabled in Firebase. See `authentication.md` for what could and couldn't be verified automatically |
| Apple sign-in | Removed / deferred | Hidden behind one flag (`APPLE_SIGN_IN_ENABLED`); not enabled in Firebase |
| Password reset, email verification | Implemented | Reset by Firebase email link; verification by our own single-use tokens |
| Onboarding and address verification | Implemented | GPS match to a Hood; "ask to join" a nearby Hood when outside every one |
| Alternative verification (phone OTP, estate code, invite) | Post-MVP | |
| Home feed, posts, photos, video, reactions, comments, polls | Implemented | |
| Alerts (categories, urgent, active windows, resolve) | Implemented | |
| Events (RSVP, reminders, follow-ups) | Implemented | |
| For Sale & Free (listings, status, message seller) | Implemented | |
| Groups (open/private, requests, invites) | Implemented | |
| Chat and support conversations, typing indicators | Implemented | Live over Server-Sent Events |
| Notifications (in-app, email by preference) | Implemented | |
| Search (posts, listings, neighbours in your Hood) | Implemented | |
| Profiles and settings (profile, account, notifications, privacy, blocking, appearance) | Implemented | |
| Dark mode | Implemented for the signed-in app, onboarding and admin | Marketing, legal and sign-in pages are light-only by design |
| Business Pages (apply, staff review, claim) | Implemented | Business posts, recommendations and Local Ads are Post-MVP |
| Admin: moderation, appeals, Hood Leads, verification, Hoods, content, businesses, inbox, broadcasts, insights, team, settings | Implemented | Broadcasts are delivered in batches after the request |
| "Marketplace" on the marketing site | Post-MVP | Shown as "Soon" and links to a page that says so. (Neighbour-to-neighbour For Sale & Free *is* live, inside the app.) |
| Public neighbourhood pages (`/neighbourhood/[slug]`), logged-out post previews | Post-MVP | Posts are private to their Hood, so there are no public post pages to preview |
| SMS (phone numbers, OTP) | Post-MVP | The API has an `SmsProvider` interface and nothing behind it |
| Link previews, `robots.txt`, sitemap, canonical URLs | Implemented | Public pages only |
| Mobile app | Post-MVP | |

## How it is built

**Frontend.** Next.js App Router. Three areas: public pages (marketing, legal, sign-in), the signed-in app under the `(app)` route group, and `/admin`. Pages are client-rendered shells that call the API from the browser with the signed-in person's Firebase ID token. `src/proxy.ts` decides which pages a request may see. A mock mode (`NEXT_PUBLIC_USE_MOCKS=true`) runs the whole UI on in-browser sample data with no API.

**API.** A modular NestJS monolith: one module per domain (posts, comments, listings, groups, chat, businesses, moderation, notifications, admin, storage, search, realtime…). Every request passes five global guards in order: a per-IP flood limit, Firebase token, a per-person rate limit, account state, capability. Work that must outlive a request (telling a Hood about an alert) runs as a background job recorded in MongoDB (`src/jobs`). Authorisation is by capability, derived from role *and* account state.

**Database.** MongoDB (Atlas, a replica set: transactions depend on it) through Mongoose 9. Data migrations are code (`apps/api/src/database/migrations`) run with `pnpm migrate`; missing indexes are created at boot.

**Authentication.** Firebase Auth in the browser; the API verifies the ID token on every call. For page routing the web app holds a Firebase *session cookie*, minted by the API. Details: `authentication.md`.

**Storage.** Photos and videos go through the API (`POST /media`) to Cloudinary behind a `StorageProvider` interface. The browser never sees storage credentials.

**Email.** Resend, behind an `EmailProvider` interface, with a delivery log and signed webhooks. Without an API key, emails are logged instead of sent.

**Realtime.** One Server-Sent Events stream per tab. Events fan out across API instances over Redis, falling back to MongoDB change streams, then in-memory.

**External services.** Firebase Auth, MongoDB Atlas, Cloudinary, Resend, Redis (Upstash), OpenFreeMap (map tiles), maps.co (address lookup), Google Identity Services (One Tap).

**Deployment.** Two deployables: the API (a Node process) and the web app (Next.js). The API must be deployed first. The repository holds no hosting configuration; the runbook is `deployment.md`.

**Development workflow.** pnpm workspace + Turborepo. Husky runs lint and type-check before a commit and unit tests before a push. CI runs lint, types, unit tests, API integration tests, the build, and the signed-out browser tests.

**Testing.** API: Jest unit tests and integration tests against an in-memory MongoDB. Web: Vitest unit tests and Playwright browser tests. Details and gaps: `testing.md`.

## Known gaps

These are real and open; none is hidden behind "done".

- Google sign-in has not been clicked through with a real Google account (it needs one).
- Browser tests cover sign-in, sessions, the admin and accessibility, but not a verified resident posting, commenting or uploading: there is no verified test resident account. The API integration tests cover those flows.
- The page gate's memory of "this session is live" is per server instance (60 seconds). See `authentication.md`.
- The content policy allows inline scripts (`'unsafe-inline'`), which Next.js needs without per-request nonces. See `security.md`.
- Legal pages have not had a lawyer's review.
- Several production tasks are manual and outstanding: `backlog-status.md`.
- The October 2026 audit ([`codebase-audit.md`](./codebase-audit.md)) is partly implemented and **not yet committed, deployed or run in CI**: see [`implementation-progress.md`](./implementation-progress.md). Still open from it: rotating the two exposed credentials, deleting data 30 days after deactivation (the privacy policy promises it; nothing does it), removing media when its content is deleted, and a set of decisions listed in [`IMPLEMENTATION_NOTES.md`](./IMPLEMENTATION_NOTES.md).
