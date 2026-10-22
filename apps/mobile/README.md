# myHoodora mobile

The iOS and Android app: Expo SDK 57, React Native 0.86, Expo Router. It talks to the same API and Firebase project as the web. Decisions, inventories and versions are in [`docs/mobile/`](../../docs/mobile/).

**What it does today:** a first-launch intro and a welcome screen; log in, create an account, reset a password; onboarding (find your Hood from your location or a typed address, confirm it, or ask to join a nearby one); the Hood feed and post detail with comments (read-only); notifications, with push to the phone; account (log out, sign out everywhere, links to the web for everything else).

## Run it

Push notifications and secure session storage need native code, so the app runs as a **development build**, not in Expo Go.

```bash
pnpm install                                   # from the repository root
cp apps/mobile/.env.example apps/mobile/.env.local   # then fill it in (docs/environment.md → Mobile)
pnpm --filter @myhoodora/mobile android        # or: ios (needs Xcode); builds and installs a dev build
pnpm --filter @myhoodora/mobile dev            # later runs: start Metro for the installed dev build
```

Without Xcode or Android Studio, build the dev client on EAS instead: `npx eas-cli build --profile development --platform android` (or `ios`), install it, then `pnpm --filter @myhoodora/mobile dev`.

The phone must reach the API and the web app: set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` to your computer's LAN address (not `localhost`), or to staging.

## Checks

| Command (`pnpm --filter @myhoodora/mobile …`) | What it does |
| --- | --- |
| `lint` · `check-types` · `test` | Also run by the root `pnpm lint`, `pnpm check-types`, `pnpm test` |
| `doctor` | Dependencies match Expo SDK 57, and `expo-doctor` |
| `export:check` | Bundles for iOS and Android (what CI runs) |

Brand images, photos and app-screen images come from the web: `node apps/mobile/scripts/capture-web-screens.mjs "$PWD"` (web running on :3000), then `node apps/mobile/scripts/make-assets.cjs "$PWD"`.

Add native packages with `npx expo install <name>` from this folder, never `pnpm add` with a guessed version.

## Layout

```text
src/app/          routes only (Expo Router); paths match the web's (/news-feed, /p/[id], /notifications)
src/core/         config, Firebase, API client, session, push, location
src/features/     auth, onboarding, feed, notifications, account
src/shared/       theme (from @myhoodora/design-tokens), UI components, utilities
```

`core/` and `shared/` never import `features/` or `app/`, and nothing imports `apps/web` (ESLint enforces both). Code both apps need goes in `packages/api-contract` or `packages/design-tokens`.

## Push notifications

The API pushes every notification the person would see in the app, following their per-category settings (contract §30). The app registers the phone after sign-in once notifications are allowed (the feed asks, in context, before the system prompt), removes it on logout, and opens the matching screen when a push is tapped.

Before pushes reach real phones, once per Expo project:

1. **Android:** upload an FCM V1 service-account key: `npx eas-cli credentials` → Android → Google Service Account → FCM V1.
2. **iOS:** let EAS create an APNs key for `com.myhoodora.app` (`npx eas-cli credentials` → iOS → Push Notifications). Needs the Apple Developer account.
3. If "enhanced push security" is turned on for the Expo project, create an access token and set it as `EXPO_ACCESS_TOKEN` on the API.

## Builds and releases

`eas.json` has three profiles, each with its own channel and EAS environment: `development` (dev client, internal), `preview` (internal testing), `production` (store). Set the `EXPO_PUBLIC_*` values per environment with `eas env:create`. `runtimeVersion` follows the app version, so an over-the-air update never reaches a binary with different native code; anything that changes native code (a new native package, `app.config.ts` plugins, permissions) needs a new build. Store submission and production updates are a release decision, not something CI does.
