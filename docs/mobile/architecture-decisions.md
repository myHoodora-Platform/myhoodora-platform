# Mobile: architecture decisions

Each record has a status. All the Proposed records were approved on 20 October 2026, together with building push notifications and the mobile address lookup. Where the implementation differs from the original text, the record says so under **Outcome**. The facts behind them are in [repository-audit.md](./repository-audit.md).

---

## ADR-001 · Expo SDK 57, regenerated over the SDK 56 starter · Accepted, done

**Context.** `apps/mobile` is an unmodified SDK 56 starter with two real files. SDK 57 (RN 0.86.3, React 19.2.3) is stable. SDK 58 (RN 0.88.0, React 19.3.0) was released on 15 October 2026, five days ago.

**Decision.** Use **SDK 57**. Regenerate the template rather than upgrading 56 to 57 in place. There is no code worth migrating, and a fresh template avoids leftover SDK 56 configuration. Keep these values from the existing `app.json`: `bundleIdentifier`/`package` (`com.myhoodora.app`) and the EAS `projectId`, subject to ADR-011. Change `name` to `myHoodora`, and `slug`/`scheme` to `myhoodora`.

**Why not SDK 58 now.** It is five days old. React 19.3.0 differs from the web's 19.2.0, and the iOS 27 support it adds is not needed yet. Plan a deliberate move to 58 after the first vertical slice.

**Consequence.** The `AGENTS.md` docs link moves to v57. Do not mix SDK 57 and 58 package sets.

**Outcome.** Regenerated at `expo@57.0.30`. The name is `myHoodora` and the scheme `myhoodora`, and, since the EAS project was recreated under the organisation (ADR-011), the slug is `myhoodora` too. `app.json` became `app.config.ts`.

## ADR-002 · Bring `apps/mobile` into the pnpm workspace · Accepted, done

**Context.** Mobile is excluded from the workspace on purpose and has its own `package-lock.json`. The plan requires one lockfile and one package manager.

**Decision.**

- Remove `!apps/mobile` from `pnpm-workspace.yaml`.
- Delete `apps/mobile/package-lock.json` and `apps/mobile/node_modules`.
- Install with pnpm from the root, using pnpm's default isolated linker. Expo supports it from SDK 54 onwards. Switch to `node-linker=hoisted` only if Metro or autolinking demonstrably fails, and record it here.
- Name the package `@myhoodora/mobile`, matching `@myhoodora/api`.
- Add `.nvmrc` with `24` so that local runs match CI. This machine runs Node 26.

**Consequences.**

- CI's `pnpm install --frozen-lockfile` now installs Expo dependencies. Installs get slower; it does not need Xcode or Android.
- Turborepo's `lint`, `check-types` and `test` pick up mobile automatically, so a mobile failure can block a web merge. That is intended.
- TypeScript: mobile stays on the template's `~6.0.3` for now, because pnpm isolates it per package. Shared packages must type-check under both 5.9 and 6.0. Aligning the whole repository is a separate decision.
- React: mobile resolves 19.2.3 and web 19.2.0. They are separate per package and allowed, but shared packages must declare `react` as a **peer** dependency, never a direct one. `pnpm why react --filter @myhoodora/mobile` must show exactly one version.
- Update the docs and READMEs that say "post-MVP, outside the workspace": the root `README.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/backlog-status.md` and `apps/mobile/README.md`.

**Outcome.** Done with the default isolated linker; Metro needed no custom configuration (`metro.config.js` is Expo's default). Two side effects were fixed:

- **One `@types/react`.** Mobile's `~19.2.4` became the version pnpm hoists for packages without their own React types (lucide), which broke the web's type-check against its pinned `19.2.2`. The web and `@myhoodora/ui` now use `~19.2.4` too (it resolves to 19.2.18), so the whole repository has one copy.
- **TypeScript 6** no longer includes every `@types` package by default, so the mobile `tsconfig.json` lists `"types": ["jest"]`.

## ADR-003 · Auth: Firebase JS SDK with Bearer ID tokens, and no session cookie · Accepted, done (email and password)

**Context.** The API trusts only a Firebase ID token on each request. The session cookie exists solely for the web's page gate (`docs/authentication.md`). The web uses the `firebase` JS SDK v12.

**Decision.**

- Use the **`firebase` JS SDK** (the same library and project as the web), initialised with `initializeAuth` and React Native persistence.
- `apiFetch` calls `user.getIdToken()` on every request, exactly as the web does. Firebase refreshes the token. Mobile never calls `/auth/session*`.
- **Log out:** `signOut(auth)`, clear the query cache, clear the realtime stream, then go to the auth stack.
- **Sign out everywhere:** `POST /auth/logout-everywhere`, then log out.
- A realtime `session.changed` event triggers a profile refetch and a stream reconnect.
- A 401 means signing out; a 503 must never be treated as a 401 (contract §26).
- **Google sign-in:** `@react-native-google-signin/google-signin`, which returns a Google ID token, passed to `signInWithCredential`. This is the same flow as the web's One Tap path, so it resolves to the same UID. It needs a development build (it is a native module) and OAuth clients for iOS and Android (manual task M2 below).
- **Apple:** stays off, matching the web (`APPLE_SIGN_IN_ENABLED`). **App Store guideline 4.8** requires Sign in with Apple in an iOS app that offers Google sign-in. This must be settled before the iOS store release, not for the foundation.

**Alternative considered.** `@react-native-firebase/auth` keeps the refresh token in the native Keychain or Keystore and is more native. It adds native configuration files (`GoogleService-Info.plist`, `google-services.json`) and a second Firebase SDK in the repository. It was rejected for the foundation: the JS SDK keeps one auth model across web and mobile.

**Open security point (decide in Phase 3).** The JS SDK's React Native persistence writes the refresh token to AsyncStorage, which is not encrypted. Option A: accept it (the default for this SDK; the device sandbox protects it). Option B: a small custom `Persistence` adapter over `expo-secure-store`, which has per-value size limits that need testing. The recommendation is **B** if testing shows it works, because the refresh token is a long-lived credential.

**Auth states (mobile).**

```text
BOOTSTRAPPING ── Firebase restores user ──► PROFILE_LOADING ── GET /users/me ok ──► READY (onboarded) | NEEDS_ONBOARDING
      │                                          └── network or 5xx ──► PROFILE_ERROR (retry; keep the user signed in)
      └── no user ──► SIGNED_OUT
READY ── logout | 401 | account disabled ──► SIGNED_OUT
READY ── session.changed ──► PROFILE_LOADING (silent refetch)
```

The splash screen stays up through `BOOTSTRAPPING`, so protected screens never flash. `PROFILE_ERROR` is not `SIGNED_OUT`, which mirrors the web's `profileStatus`.

**Outcome.**

- **Session storage:** option B. Firebase's React Native persistence writes to `expo-secure-store`, with the keys encoded (`src/core/firebase/secure-storage.ts`). If the platform refuses a value, that key falls back to AsyncStorage and a warning is logged; this has **not yet been seen on a device**.
- **Imports:** the `firebase/auth` wrapper has no `react-native` export condition, so mobile imports `@firebase/auth` directly, pinned to the version `firebase@12.16` uses. A one-function type declaration covers `getReactNativePersistence`, which the package's top-level types omit. The bundle check confirmed the React Native build is the one bundled.
- **States:** implemented as `sessionPhase()` (`src/core/auth/session-phase.ts`, unit-tested) and routed with Expo Router's `Stack.Protected`.
- **Google sign-in:** built (`@react-native-google-signin/google-signin` 16.1.5, then a Firebase credential). It works on Android with the web client ID; iOS needs the iOS OAuth client ID (task M2) and a new build.

## ADR-004 · App structure · Accepted (from the plan, adjusted to the starter)

The SDK 57 template puts routes in **`src/app/`**, not root `app/`. Keep that, and add the plan's layers beside it:

```text
apps/mobile/src/
  app/                 Expo Router routes and layouts only: (auth)/, (app)/(tabs)/, onboarding/
  core/                api/ (client, errors, retry), auth/, config/ (typed env), realtime/, storage/, logging/
  features/<area>/     feed, post, for-sale, alerts, events, groups, chat, notifications, profile, settings, onboarding
  shared/              ui/, theme/, hooks/, utils/
  test/
```

Feature areas mirror `apps/web/src/features/` so that the two apps can be read side by side. Use typed API modules and TanStack Query hooks. Add repository or use-case classes only where a workflow justifies them.

**Import rules (ESLint `no-restricted-imports` plus `import/no-cycle`):** nothing in `apps/mobile` imports `apps/web`; `core/` never imports `app/` or `features/`; one feature imports another only through its `index.ts`; shared packages never import an app.

## ADR-005 · Shared packages: extract only platform-neutral code · Accepted, done

**Context.** The web has pure TypeScript that mobile needs verbatim: `lib/api/types.ts` (398 lines, no imports), the error classification in `lib/api/client.ts` (the `ApiError`/kind/message logic, apart from `fetch`, `XMLHttpRequest` and the Firebase `User` type), `lib/realtime/sse-parser.ts` and `types.ts`, and the token values in `app/globals.css`. Copying them would create two copies of the contract that drift apart.

**Decision.** Create two packages:

| Package | Contents | Web change |
| --- | --- | --- |
| `@myhoodora/design-tokens` | Colours (light and dark, semantic names as in `globals.css`), type scale, weights, radii and spacing as TypeScript constants. Sourced from the brand palette and `globals.css`, with a test asserting the two agree | None at first. The web keeps its CSS variables; the test guards against drift. Generating `globals.css` from the tokens is a later option |
| `@myhoodora/api-contract` | `types.ts`, the realtime event types, the SSE parser, and `ApiError` with status classification and friendly messages | Web files re-export from the package (`export * from "@myhoodora/api-contract"`), so no web call sites change |

**Not shared:** `@myhoodora/ui` (DOM/Radix), `AuthContext`, anything that uses `next/*`, `window` or `document`, and the web's mock store.

**Outcome.** `@myhoodora/api-contract` holds:

| File | Contents |
| --- | --- |
| `types.ts` | Moved from the web, plus `UserProfile` |
| `errors.ts` | `ApiError`, its classification and wording, `REQUEST_TIMEOUT_MS`, `MAX_RETRY_AFTER_MS` |
| `lookups.ts` | Geocode result types, plus `addressProblem`, `joinAddress`, `splitAddress` and `EMPTY_ADDRESS` from web onboarding |
| `auth-validation.ts` | The web's Zod sign-in and sign-up schemas (`zod` as a peer dependency) |
| `auth-errors.ts` | The Firebase error wording |
| `push.ts` | Push payload and registration types |

The web's old modules re-export from it, so no web call site changed. The web's `withRetry` and its transport (`fetch`, XHR) stay in the web. The realtime SSE parser is **not** moved yet; it moves when mobile gets the live stream.

## ADR-006 · Libraries · Accepted, subject to the compatibility gate

TanStack Query (server state), React Hook Form with Zod (same major as the web, `zod@3`), `expo-secure-store`, `@react-native-async-storage/async-storage` (non-sensitive preferences only), `expo-font` with `@expo-google-fonts/outfit`, `lucide-react-native` with `react-native-svg` (the same icon set as the web), `jest-expo` with React Native Testing Library. No global store. Versions are fixed by `expo install` (see [dependency-compatibility.md](./dependency-compatibility.md)).

**Outcome.** All are installed except React Hook Form. The forms so far are small and validate with the shared Zod schemas directly; add it when the post composer arrives.

## ADR-007 · Onboarding location: GPS, and the web's geocoder with a Bearer token · Accepted, done (supersedes the GPS-only proposal)

**Context.** Address verification calls `POST /users/me/verify-location/preview` and `POST /users/me/verify-location` with **coordinates**. The web gets those coordinates from a map pin, browser geolocation, or its own cookie-gated `/api/geocode`, which mobile cannot use.

**Decision for the foundation.** On mobile, use **device GPS** (`expo-location`, foreground permission only), then confirm on a map or with a pin, then call the existing API endpoints. No backend change is needed.

**Outcome.** Typed addresses were requested too. `guardLookup` (`apps/web/src/lib/auth/lookup-guard.ts`) now accepts `Authorization: Bearer <ID token>` as well as the cookie, checked locally, with one per-person allowance across both (tests in `lookup-routes.test.ts`). This keeps one geocoder and one API key instead of copying the provider into the API. Mobile onboarding follows the web's order:

1. GPS (prefilled through `/api/reverse-geocode`), or a typed street, area and city (`/api/geocode`).
2. Preview the Hood.
3. Confirm.
4. `PATCH /users/me/onboarding`.
5. `verify-location` with the confirmed Hood ID. A 409 returns to the address step. Outside every Hood, the person can ask to join a nearby one.

There is no map yet. When only the area was found, the app says so and suggests using the current location instead.

## ADR-008 · Turborepo and CI tasks · Accepted, done (CI checks run on every push)

- Rename the existing `build` script (`node scripts/ci-build.js`, which starts EAS builds) to `eas:build`. **No mobile task named `build`**, so that `turbo run build` in CI never starts a paid native build.
- Add mobile scripts: `lint`, `check-types`, `test` (jest-expo) and `export:check` (`expo export --platform android --platform ios` into a temporary directory, as a bundle smoke check).
- Add one CI step, `pnpm --filter @myhoodora/mobile exec expo install --check` (with `expo-doctor` alongside), plus `export:check`, run only when `apps/mobile/**` or `packages/**` changed.
- EAS builds in CI wait for Phase 5, in a separate workflow using a protected environment, never on pull requests from forks.

**Outcome.** `scripts/ci-build.js` was removed, and `eas:build` is a plain `eas build`. Mobile `lint`, `check-types` and `test` run through Turborepo. CI runs `expo install --check` and `export:check` on every run, not only when mobile files change: about two minutes, and simpler than path filters. Revisit this if CI time matters.

## ADR-009 · Out of scope for the foundation · Updated

**Push notifications were brought into scope** on 20 October 2026 and built (contract §30). The API part (`PUT`/`DELETE /push/devices`, pushes from `NotificationsService`) is a `PushProvider` port with Expo and log adapters, like `EMAIL_PROVIDER`. The app part is registration after sign-in, the in-context permission prompt, logout clean-up and tap routing. Device delivery needs the credentials in `apps/mobile/README.md`.

Still out of scope: the admin portal (staff use the web), the marketing pages, a mobile mock mode (mobile talks to a real API; the local API or a staging API is the development target), and Hoodora AI.

## ADR-010 · App icon, splash and in-app logos · Accepted, done

Replace the Expo default assets with the logos the web shows (originally proposed as `mark.svg` on brand teal; see the outcome). If the original 4K brand exports exist outside the repository, prefer them. Store artwork is a design task, so record the source of each file.

**Outcome (corrected 20 October 2026).** The first version used the flat house badge (`mark.svg`), which only the web's favicons still use. The web's actual identity is the **mascot set** (`packages/ui/src/logo.tsx`: `MascotWordmark` in the app header and onboarding, `MascotLockup` on the sign-in pages). The app now matches:

- **App icon and Android adaptive icon:** the mascot house (coral roof, four-pane window) on white.
- **Splash:** the mascot wordmark on white, with the reversed wordmark on the dark canvas in dark mode.
- **In the app:** the mascot lockup above the login, register and reset forms; the wordmark in the feed header and on onboarding (`src/shared/ui/brand.tsx`).

All of these are generated from `apps/web/public/logo` by `apps/mobile/scripts/make-assets.cjs`.

**Open:** the web's favicons and PWA icons still use the old house badge. Whether they should move to the mascot house is a brand decision.

## ADR-011 · App identity and accounts · Decided

- **Bundle ID:** `com.myhoodora.app` (confirmed 20 October 2026).
- **Expo owner:** the company organisation **`myhoodora-mvp`** (display name "myHoodora"). `owner` in `app.config.ts` is the unique name, not the display name.
- **EAS project:** created fresh under the organisation on 21 October 2026, rather than transferring the one a personal account had made. It is **`@myhoodora-mvp/myhoodora`**, ID `f817f499-081f-4a30-9f95-d90bbd66b819` (`EAS_PROJECT_ID` in `app.config.ts`, checked with `eas project:info`). The slug is now `myhoodora`. Nothing had been built, signed or stored on the old project (`2fd0a651-…`, slug `mobile`, under `kingslayer_double07`), so nothing needed moving; it can be deleted by its owner.
- **Still open:** confirm the Apple Developer and Google Play accounts are in the company's name.

## Manual tasks this work creates

| # | Task | Needed by |
| --- | --- | --- |
| M1 | Confirm the store accounts are the company's; optionally delete the old personal EAS project (ADR-011) | Store submission |
| M2 | Register the iOS app (`com.myhoodora.app`) in Firebase and put its `CLIENT_ID` in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; add the Android app with the signing SHA-1 from EAS | Google sign-in on iOS (and on Android release builds) |
| M3 | Decide Sign in with Apple before the iOS store submission (guideline 4.8) | iOS release |
| M4 | Pick the development API target for devices (a LAN address for the local API, or staging) | First run on a phone |
| M5 | Push credentials: an FCM V1 key and an APNs key in the EAS project (and `EXPO_ACCESS_TOKEN` on the API if enhanced push security is on) | Pushes reaching phones |
| M6 | First development build on a real Android phone and iPhone, then walk through sign-in → onboarding → feed → push | Calling the foundation verified on devices |
