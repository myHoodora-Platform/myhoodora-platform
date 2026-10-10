# myHoodora

A neighbourhood network for Nigeria: verified neighbours share posts, safety alerts, events and items for sale within their own "Hood".

**Documentation lives in [`docs/`](./docs/README.md).** Start with [current state](./docs/current-state.md) for what exists, and [development](./docs/development.md) to run it.

## What's here

```text
apps/
  web/       Next.js 16 app: marketing site, the signed-in app, the staff admin
  api/       NestJS 10 REST API on MongoDB
  mobile/    Expo starter. Post-MVP, not part of the workspace or CI
packages/
  ui/                  shared React components
  eslint-config/       shared ESLint config
  typescript-config/   shared TypeScript config
docs/        documentation of record (and an archive of older plans)
```

**Stack:** TypeScript · Next.js (React 19, Tailwind 4) · NestJS · MongoDB (Mongoose) · Firebase Authentication · Cloudinary (media) · Resend (email) · Redis (live updates) · pnpm workspaces + Turborepo.

## Quick start

Needs Node.js 24, pnpm 9, a Firebase project and a MongoDB replica set (Atlas works).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env          # fill in: MongoDB, Firebase Admin, …
cp apps/web/.env.example apps/web/.env.local    # fill in: Firebase web config
pnpm dev                                        # web → http://localhost:3000, API → http://localhost:3001/api
```

Every variable is explained in [`docs/environment.md`](./docs/environment.md). To explore the UI with no backend at all: `NEXT_PUBLIC_USE_MOCKS=true pnpm --filter web dev`.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Web and API in watch mode |
| `pnpm build` | Production build |
| `pnpm lint` · `pnpm check-types` | ESLint · TypeScript |
| `pnpm test` | Unit tests (API and web) |
| `pnpm test:e2e:api` | API integration tests (in-memory MongoDB) |
| `pnpm test:e2e:web` | Browser tests (Playwright) |
| `pnpm format` | Prettier |

Before opening a pull request: lint, types, tests and build should pass (CI checks the same). See [`docs/testing.md`](./docs/testing.md).

## Contributing

- Branch from `development`, open a pull request into it.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(feed): …`, `fix(api): …`, `docs: …`.
- Git hooks (Husky) run lint and type-check before a commit and unit tests before a push.
- When behaviour changes, update the matching page in `docs/` in the same pull request.

## Deploying

The API is deployed before the web app. The full runbook, with checks and rollback, is [`docs/deployment.md`](./docs/deployment.md). Several launch tasks are manual (secret rotation, domain verification, legal review): see [`docs/backlog-status.md`](./docs/backlog-status.md).
