# Development

## Prerequisites

- Node.js 24
- pnpm 9 (`corepack enable` picks up the version in `package.json`)
- A Firebase project with Email/Password (and Google) sign-in enabled
- MongoDB as a **replica set** (Atlas is one; a standalone local `mongod` is not, and transactions will fail)

## First run

```bash
pnpm install
cp apps/api/.env.example apps/api/.env          # then fill it in
cp apps/web/.env.example apps/web/.env.local    # then fill it in
pnpm dev                                        # web on :3000, API on :3001
```

What to put in each file is in [`environment.md`](./environment.md). Locally the API can read Firebase Admin credentials from a service-account file: download it from the Firebase console, save it as `apps/api/serviceAccountKey.json` (git-ignored), and set `GOOGLE_APPLICATION_CREDENTIALS` to its path.

To seed the launch neighbourhoods: `pnpm --filter @myhoodora/api seed:neighborhoods`.

### Without a backend

```bash
NEXT_PUBLIC_USE_MOCKS=true pnpm --filter web dev
```

The UI runs on in-browser sample data. Sign-in is still real Firebase. There is no server session in this mode, so pages protect themselves in the browser only.

## Commands

From the repository root:

| Command | Does |
| --- | --- |
| `pnpm dev` | Web and API in watch mode |
| `pnpm build` | Production build of everything |
| `pnpm lint` | ESLint, no auto-fix, zero warnings allowed in the web app |
| `pnpm check-types` | TypeScript across the workspace |
| `pnpm test` | Unit tests: API (Jest) and web (Vitest) |
| `pnpm test:e2e:api` | API integration tests (in-memory MongoDB) |
| `pnpm test:e2e:web` | Browser tests (Playwright) |
| `pnpm format` | Prettier |

Per app: `pnpm --filter web <script>` and `pnpm --filter @myhoodora/api <script>`. The API also has `lint:fix`, `migrate`, `migrate:dry` and `seed:neighborhoods`.

## Git workflow

- Branch from `development`; open a pull request into it.
- Commit messages follow Conventional Commits (`feat(scope): …`, `fix(scope): …`). This is a convention: nothing enforces the format.
- Husky hooks: **pre-commit** runs `pnpm lint && pnpm check-types`; **pre-push** runs `pnpm test`.
- CI runs on pushes to `main` and `development` and on every pull request (see [`testing.md`](./testing.md)).

## Conventions worth knowing

- **New page?** It is protected unless you add it to `PUBLIC_PATHS` in `apps/web/src/lib/routes.ts`. Public pages also belong in `app/sitemap.ts`.
- **New third-party script, frame or API called from the browser?** Add its origin to the content policy in `apps/web/next.config.js`, or the browser will block it.
- **New environment variable?** Add it to the app's `.env.example`, to `turbo.json` (`globalEnv`) and to `environment.md`.
- **New API route?** It needs a token unless marked `@Public()`, and a capability if it isn't for every signed-in person. Add an integration test and a line in `api-contract.md`.
- **New infrastructure (email, storage, SMS, queue)?** Put it behind a port with an adapter, like `EMAIL_PROVIDER` and `STORAGE_PROVIDER`.
- **Colours:** use the tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`…), not `bg-white` or `text-slate-…`, or the screen will break in dark mode.
- **Comments in `lib/api`:** `live:` means the API serves it; the non-live branch is the mock.

## The mobile app

`apps/mobile` is an Expo starter kept for later (see `roadmap.md`). It is not part of the pnpm workspace. To work on it: `cd apps/mobile && npm install && npx expo start`.
