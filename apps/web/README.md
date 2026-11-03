# myHoodora web

The Next.js app: the marketing site, the signed-in app for residents, and the staff admin at `/admin`.

Project documentation is in [`/docs`](../../docs/README.md). The most relevant pages: [architecture](../../docs/architecture.md), [authentication](../../docs/authentication.md), [environment](../../docs/environment.md), [testing](../../docs/testing.md).

## Run

```bash
cp .env.example .env.local     # Firebase web config, API URL
pnpm --filter web dev          # http://localhost:3000
```

The API must be running too (`pnpm dev` from the root starts both), or use mock mode: `NEXT_PUBLIC_USE_MOCKS=true pnpm --filter web dev` runs the UI on in-browser sample data.

## Scripts

| Script | Does |
| --- | --- |
| `dev` · `build` · `start` | Develop · production build · serve the build |
| `lint` | ESLint, zero warnings allowed |
| `check-types` | Next type generation + TypeScript |
| `test` | Unit tests (Vitest, `src/**/*.test.ts`) |
| `test:e2e` | Browser tests (Playwright, `e2e/`). The signed-in tests need the API and a test account |
| `test:e2e:public` | The signed-out browser tests only (no API needed) |

## Layout

```text
src/
  proxy.ts        page gate: who may see which page
  app/            routes: public pages, (auth), (app), onboarding, admin, api/auth
  features/       one folder per product area
  components/     app shell, marketing layout, shared pieces
  context/        AuthContext (user, profile, server session)
  lib/            API client (+ mock backend), auth, firebase, realtime, routes, theme
e2e/              Playwright tests
```

Stack: Next.js 16 (App Router), React 19, Tailwind CSS 4, components from `@myhoodora/ui`, Firebase Auth, react-hook-form + zod.

## Things that will bite you

- A new page is **protected by default**. To make it public, add it to `PUBLIC_PATHS` in `src/lib/routes.ts` (and to `src/app/sitemap.ts`).
- A new third-party script, frame or API called from the browser must be added to the content policy in `next.config.js`.
- Use colour tokens (`bg-card`, `text-foreground`…), not fixed colours, or dark mode breaks.
- `NEXT_PUBLIC_*` variables are fixed at build time.
