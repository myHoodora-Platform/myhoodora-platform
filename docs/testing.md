# Testing

## What runs where

| Suite | Command (from the root) | Needs | In CI |
| --- | --- | --- | --- |
| API unit (Jest, `apps/api/src/**/*.spec.ts`) | `pnpm test` | nothing | yes |
| Web unit (Vitest, `apps/web/src/**/*.test.ts`) | `pnpm test` | nothing | yes |
| API integration (Jest, `apps/api/test/*.e2e-spec.ts`) | `pnpm test:e2e:api` | nothing (in-memory MongoDB) | yes |
| Browser, signed-out (Playwright, `apps/web/e2e/public.spec.ts`) | `pnpm --filter web test:e2e:public` | the web app | yes |
| Browser, signed-in (Playwright, `apps/web/e2e/auth.spec.ts`) | `pnpm --filter web test:e2e` | web + API running, a test account | **no** |

Also in CI: `pnpm lint`, `pnpm check-types`, `pnpm build`. Husky runs lint and types before each commit and the unit tests before each push.

## API integration tests

They boot the real `AppModule` against `mongodb-memory-server` in replica-set mode, so guards, validation, transactions and unique indexes all run for real. Only Firebase is replaced (`test/helpers/firebase-mock.ts`): a token `t:<uid>` is that user's ID token, `s:<uid>` their session cookie. Tests never touch a shared Redis or a real storage account, whatever is in a local `.env`.

| Suite | Covers |
| --- | --- |
| `security` | Authorisation findings, account-state gates, ownership, the web session cookie routes, per-credential rate limits, a Firebase outage answering 503 (never 401), who sees a neighbour's address |
| `hood-access` | Who may read a Hood: every Hood-scoped route per account state, rejection, the 90-day cooldown on moving, Hood boundaries, and the `HOOD_ACCESS_STRICT=false` rollback |
| `jobs` | The background job runner: runs once, retries with a growing delay, survives a restart, takes over from a dead worker, two instances at once |
| `alert-fanout` | Alerts announced after the response, in batches, each neighbour once (2,000 members); `clientId` making a retried post the same post; notification length limits |
| `rate-limits` | Limits per person once signed in, per address on public routes, the flood ceiling, `Retry-After` |
| `upload-rules` | Who may upload for which purpose, and the daily allowance |
| `deactivation` | Deactivating hides posts, listings and the person's name; signing in restores them |
| `moderation-fixes` | Reopening a decided case, appeals by a suspended account, reporting a conversation, overturning a "keep" |
| `paging` | Messages and comments past 500: newest page first, `before` and `limit` |
| `staff-and-groups` | Bulk neighbour actions per neighbour, Hood resize overlap, audited legacy Hood routes, staff actions atomic with their audit record, the last member leaving a group |
| `media-search-realtime` | Upload, ownership and deletion of media; search scoping and validation; the live event stream |
| `broadcasts` | Batched delivery, no duplicates on re-run, the double-send guard, failure and retry, resume after restart |
| `moderation-engagement` | Reports to decisions, reactions, polls, comments, blocks, media shapes on posts |
| `marketplace-chat` | Listings, threads, unread counts, messaging preferences |
| `groups`, `leads-appeals`, `inbound-business`, `communications` | Their domains end to end |
| `admin-contract` | Every `/admin/*` response has the fields the web's types require |
| `migrations` | Dry run writes nothing; migrations are idempotent |

## Browser tests (Playwright)

```bash
pnpm --filter web exec playwright install chromium   # once
pnpm --filter web test:e2e                           # everything
pnpm --filter web test:e2e:public                    # signed-out only
E2E_BASE_URL=https://staging.example pnpm --filter web test:e2e   # against a deployed site
```

Playwright starts `pnpm dev` unless something is already on port 3000 or `E2E_BASE_URL` is set.

**`public.spec.ts`** (no API, no account): the landing page and its security headers; no auth requests for anonymous visitors; every protected route redirects to login with the right `next`; a forged cookie is refused and removed; form validation on login, register and forgot-password; a wrong password stays on the form; the Google button opens Google's window and cancelling is silent; One Tap loads within the content policy; `robots.txt`, the sitemap and link-preview tags; accessibility (axe) on the main public pages; the public site stays light in a dark-mode browser.

**`auth.spec.ts`** (real sign-in): the session cookie is created *before* navigation, with the right attributes and a 7-day life; it survives reload and a new tab; `/` and the auth pages send a signed-in person into the app; protected pages and the staff admin load; accessibility in light and dark on ten signed-in pages; the theme setting; skip-to-content from the keyboard; logout clears only this browser; **sign out everywhere** signs this browser out and turns a second signed-in browser away; signing in again works.

It needs `E2E_EMAIL` and `E2E_PASSWORD`. Run locally, they default to the QA moderator in `apps/api/.env`. The suite ends by signing that account out everywhere. It is not in CI because CI has no API, database or test account.

## What is not covered

Be clear about these when deciding whether a release is safe:

- **A verified resident in the browser.** Posting, commenting, uploading, searching and messaging are tested at the API, and their logic in web unit tests, but not clicked through: there is no verified test resident account. Creating one (and adding `E2E_MEMBER_EMAIL`-style tests) is the most valuable next test.
- **Completing Google sign-in**, which needs a real Google account.
- **Sign-up to onboarding in the browser**, because it creates a real account and sends real email. The API side is integration-tested.
- **Safari, Firefox and real phones.** Playwright runs Chromium only.
- **Email delivery and password-reset emails** beyond the API's own tests.
- **Load.** Batched broadcasts are tested with a few thousand recipients, not hundreds of thousands.
- The **marketing long tail** (`/ai`, `/press`) still has decorative elements under AA contrast (product mock-ups and brand-colour swatches).

## Writing tests

- API: add to the suite for that domain; use `createTestApp()` and `t.auth(uid)`. A new route needs at least "works", "needs auth" and "wrong person is refused".
- Web logic: a `*.test.ts` next to the file.
- Browser: prefer roles and labels (`getByRole`, `getByLabel`) over CSS. Signed-in pages hold a live stream open, so never wait for `networkidle`; wait for content.
