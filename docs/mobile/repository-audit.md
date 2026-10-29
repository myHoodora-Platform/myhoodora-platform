# Mobile: repository audit (Phase 0)

Audited 20 October 2026 on branch `mobile_flow` at `17b5656`, with a clean working tree. Everything under **Confirmed** was read from the repository or the npm registry on that date. **Assumptions** and **Gaps** are labelled as such.

Related: [architecture-decisions.md](./architecture-decisions.md) · [dependency-compatibility.md](./dependency-compatibility.md) · [api-integration-inventory.md](./api-integration-inventory.md) · [ui-reference-inventory.md](./ui-reference-inventory.md)

## Confirmed

### Workspace

| Area | Finding |
| --- | --- |
| Package manager | pnpm `9.15.9` (`packageManager` in the root `package.json`). One root `pnpm-lock.yaml`. `.npmrc` is empty, so the default isolated `node_modules` linker is used |
| Workspace globs | `apps/*`, `packages/*`, **minus `apps/mobile`** (`pnpm-workspace.yaml`, with a comment saying mobile is post-MVP) |
| Task runner | Turborepo `^2.9.16`. Tasks: `build` (outputs `.next/**`, `dist/**`), `lint`, `check-types`, `test`, `dev`. Long `globalEnv` list. No mobile tasks |
| Apps | `apps/web` (Next.js `16.2.0`, React `^19.2.0`, which resolves to `19.2.0`), `apps/api` (NestJS 10), `apps/mobile` (see below) |
| Packages | `@myhoodora/ui` (**web-only**: Radix, Tailwind class names, `next` dev dependency), `@myhoodora/eslint-config`, `@myhoodora/typescript-config` |
| TypeScript | Root and web `5.9.2`. API `^5.3.0` (resolves to `5.7.2`) |
| Brand | `brand/myhoodora_brand_system/`: only `06_Mascot` and `08_Guidelines` are in the repository (palette `.css`/`.json`, guidelines PDF). `FILE_INDEX.md` lists `01_Primary`–`05_Social` and app icons that are **not** in the repository. Web-ready logos are in `apps/web/public/logo/*.svg`, plus favicons and 192/512 icons in `apps/web/public/favicon/` |

### The existing `apps/mobile`

This is an unmodified Expo starter (its own README says so). It is **not** in the workspace, CI, lint, type-check or tests.

| Item | Value |
| --- | --- |
| Expo SDK | **56** (`expo ~56.0.8`, `expo-router ~56.2.8`) |
| React Native / React | `0.85.3` / `19.2.3` |
| TypeScript | `~6.0.3` (the rest of the repository uses `5.9.2`) |
| Lockfile | Its own **`package-lock.json`** (npm), tracked in git, plus a local `node_modules` |
| Routes | `src/app/_layout.tsx` (bare `<Stack />`) and `src/app/index.tsx` (placeholder text) |
| `app.json` | `name`/`slug` `"mobile"`, scheme `"mobile"`, bundle ID and package `com.myhoodora.app`, `typedRoutes` and `reactCompiler` experiments on, EAS `projectId` set, `owner: "kingslayer_double07"` |
| Colours in `app.json` | Splash and adaptive-icon background `#1c736a`. **Not** a brand value: brand teal is `#147C73`, UI primary is `#11706a` |
| Icons and images | Expo defaults (Expo and React logos, `expo.icon`), not myHoodora assets |
| `eas.json` | `development` (dev client, internal), `preview` (internal), `production` (`autoIncrement`); `appVersionSource: remote`. No channels and no runtime-version policy |
| `metro.config.js` | Already watches the repository root and resolves from root `node_modules` (monorepo-ready) |
| `scripts/ci-build.js` | The **`build` script runs `eas build`** (Android, plus iOS if `APP_STORE_CONNECT_KEY_JSON` is set) whenever `EXPO_TOKEN` is present |
| ESLint | `eslint-config-expo` flat config. Not the shared `@myhoodora/eslint-config` |
| Tests | None |
| Agent notes | `AGENTS.md` points to the Expo v56 docs; `.claude/settings.json` enables the Expo plugin |

### Runtime

| Item | Value |
| --- | --- |
| Root `engines.node` | `24.x` |
| CI | GitHub Actions, Node `24`, `pnpm install --frozen-lockfile` |
| This machine | Node `v26.7.0`, npm `11.19.0`, pnpm `9.15.9`. **Outside the repository's `24.x` range** (pnpm only warns, because `engine-strict` is not set) |
| Version file | No `.nvmrc` or `.node-version` |

### CI (`.github/workflows/ci.yml`)

One workflow, with these jobs: `build` (lint → check-types → unit tests → API e2e → build), `browser` (Playwright signed-out suite), `secrets` (gitleaks on new commits) and `verify` (the required aggregate). Runs on pushes to `main`/`development` and on every pull request. There is no Expo or EAS step and no `EXPO_TOKEN`.

### Quality commands (root)

`pnpm lint`, `pnpm check-types`, `pnpm test` (Vitest for web, Jest for the API), `pnpm test:e2e:api`, `pnpm test:e2e:web`, `pnpm build`. The web lint uses `--max-warnings 0`.

### Backend facts that shape mobile (detail in [api-integration-inventory.md](./api-integration-inventory.md))

- Data auth is `Authorization: Bearer <Firebase ID token>` on every call. **Mobile needs no cookie.** The session cookie and `/auth/session*` routes exist only for the web's page gate.
- One error shape (`{ statusCode, message }`), with a client classification documented in contract §0.
- CORS is configured, but native `fetch` is not subject to CORS, so mobile needs no API change for that.
- Realtime is SSE at `GET /realtime/stream`, which needs the `Authorization` header, so it must be read as a streamed `fetch`.
- No push-notification support in the API (no device-token storage, no FCM/APNs sending).
- Address geocoding is **not** in the API. It is in Next.js routes (`/api/geocode`, `/api/reverse-geocode`, `/api/ip-location`) gated by the **web session cookie**, so mobile cannot call them.

### Version facts (npm registry, 20 October 2026)

| Dist-tag | `expo` | React Native | React | `engines.node` |
| --- | --- | --- | --- | --- |
| `sdk-56` (current starter) | 56.0.23 | 0.85.3 | 19.2.3 | — |
| `sdk-57` | 57.0.30 | 0.86.3 | 19.2.3 | not declared |
| `latest` (SDK 58) | 58.0.16 | 0.88.0 | 19.3.0 | `^22.13 \|\| ^24.3 \|\| ^26 \|\| >=27` |

Read from each version's `bundledNativeModules.json`. The SDK 57 default template uses TypeScript `~6.0.3`.

## Assumptions (not verified)

- The EAS project in `app.json` (`owner: kingslayer_double07`) belongs to a team member's personal Expo account rather than an organisation account. It needs confirming before production signing is set up.
- `com.myhoodora.app` is the intended permanent bundle ID and package. Nothing in the repository contradicts it, but no store listing was checked.
- The Firebase project has no iOS or Android apps registered yet. Nothing in the repository references `GoogleService-Info.plist` or `google-services.json`.

## Gaps

| Gap | Effect | Where it is decided |
| --- | --- | --- |
| No API geocoding for typed addresses | Mobile onboarding cannot turn a typed street into coordinates | ADR-007 |
| No push notifications in the API | Mobile cannot notify people while the app is closed | ADR-009 (out of scope for the foundation) |
| Brand source assets (app icons, primary lockups) not in the repository | Store icons must be produced from `apps/web/public/logo/*.svg` or supplied | ADR-010 |
| Local Node 26 against the repository's 24.x | Possible differences between local and CI behaviour | ADR-002 |
| `apps/mobile` uses SDK 56, npm and TypeScript 6 | Conflicts with the one-lockfile rule and the plan's SDK 57 baseline | ADR-001, ADR-002 |
| The `build` script triggers EAS | If mobile joins Turborepo's `build`, any CI run with `EXPO_TOKEN` set would start paid native builds | ADR-008 |

## Web regression baseline

Not run during Phase 0, because no code changed. Phase 1 must record the result of `pnpm lint && pnpm check-types && pnpm test && pnpm build` on Node 24 **before** touching the workspace, so that later results can be compared against it.
