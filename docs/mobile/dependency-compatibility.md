# Mobile: dependency compatibility

Rule: versions of anything that ships native code are chosen by `expo install` for the selected SDK, never copied from npm's `latest`. Re-run the checks below after every dependency change.

## Baseline (npm registry, 20 October 2026)

| | Current starter | **Chosen: SDK 57** | SDK 58 (later) |
| --- | --- | --- | --- |
| `expo` | ~56.0.8 | ~57.0.30 | ~58.0.16 |
| `react-native` | 0.85.3 | 0.86.3 | 0.88.0 |
| `react` / `react-dom` | 19.2.3 | 19.2.3 | 19.3.0 |
| `expo-router` | ~56.2.8 | ~57.0.28 | ~58.0.24 |
| `react-native-reanimated` | 4.3.1 | 4.5.1 | 4.7.1 |
| `react-native-worklets` | 0.8.3 | 0.10.1 | — |
| `react-native-screens` | 4.25.2 | ~4.26.0 | — |
| `react-native-safe-area-context` | ~5.7.0 | ~5.7.0 | ~5.10.1 |
| `react-native-gesture-handler` | ~2.31.1 | ~2.32.0 | — |
| `expo-secure-store` | — | ~57.0.4 | ~58.0.2 |
| `@react-native-async-storage/async-storage` | — | 2.2.0 | 2.2.0 |
| `jest-expo` | — | ~57.0.6 | ~58.0.11 |
| TypeScript (template) | ~6.0.3 | ~6.0.3 | — |
| Node (`engines` on `expo`) | — | not declared | `^22.13 \|\| ^24.3 \|\| ^26 \|\| >=27` |

Sources: `bundledNativeModules.json` and `package.json` of `expo@57.0.30` and `expo@58.0.16`, and the `expo-template-default@sdk-57` manifest. A dash means the value was not read. Always confirm against <https://docs.expo.dev/versions/v57.0.0/>.

**Node:** use 24 LTS, matching the root `engines`, CI and `.nvmrc`. EAS builds use Node 24.19.0 and pnpm 9.15.9 (`eas.json` → `base`). If the project moves to SDK 58, it needs Node 24.3 or later.

## Repository constraints

| Constraint | Effect on mobile |
| --- | --- |
| Web resolves `react@19.2.0`; mobile will resolve `19.2.3` | Allowed (separate per package under pnpm). Shared packages take `react` only as a `peerDependency` |
| Root TypeScript `5.9.2`; template `~6.0.3` | Mobile keeps 6.0 for itself. Shared packages must compile under both |
| `zod@3.25.76`, `react-hook-form@7.84.0` in the web | Mobile uses the same majors, so schemas can be shared later |
| `firebase@^12.14.0` in the web | Mobile uses the same major (ADR-003). Verify that `getReactNativePersistence` resolves under Metro with package exports in Phase 3 |

## Planned additions, each to pass the gate

| Package | Native code | Install with | Gate notes |
| --- | --- | --- | --- |
| `@tanstack/react-query` | No | `pnpm add` | Pure JS |
| `react-hook-form`, `zod@3` | No | `pnpm add` | Match the web's majors |
| `firebase@12` | No | `pnpm add` | Verify RN persistence and Hermes compatibility |
| `@react-native-google-signin/google-signin` | **Yes** (config plugin) | `npx expo install` | Needs a development build; not in Expo Go. Check that it supports New Architecture on RN 0.86 |
| `expo-secure-store` | Yes (Expo) | `npx expo install` | |
| `@react-native-async-storage/async-storage` | Yes | `npx expo install` | Non-sensitive data only |
| `expo-location` | Yes (Expo) | `npx expo install` | Foreground permission; add the iOS usage string |
| `expo-image-picker` | Yes (Expo) | `npx expo install` | Phase 6 (media) |
| `@react-native-community/netinfo` | Yes | `npx expo install` | Offline detection |
| `react-native-svg` + `lucide-react-native` | Yes / No | `npx expo install` / `pnpm add` | Same icons as the web |
| `@expo-google-fonts/outfit` | No | `npx expo install` | |
| `@testing-library/react-native` | No | `pnpm add -D` | With `jest-expo` |

The template's `@expo/ui`, `expo-glass-effect` and `expo-symbols` are iOS-leaning extras. Remove them if no screen uses them, so they don't need maintaining.

### Gate (before any native dependency)

1. Supports RN 0.86 and the New Architecture (the only architecture on current SDKs).
2. Its peer ranges accept React 19.2.3.
3. Config plugin or native setup understood and documented.
4. Works in an EAS development build, and in Expo Go if that matters.
5. Maintained, with no open blocking issues for this SDK.
6. Not already covered by an installed Expo or React Native API.

## Checks to run (from Phase 1 onwards)

```bash
pnpm --filter @myhoodora/mobile exec expo install --check
pnpm --filter @myhoodora/mobile exec expo-doctor
pnpm why react --filter @myhoodora/mobile         # exactly one version
pnpm why react-native --filter @myhoodora/mobile  # exactly one version
```

Never use `--force`, `--legacy-peer-deps` or broad `pnpm.overrides` to get a clean install. If a check fails, fix the cause or record the exception here with a reason.

## Installed (20 October 2026)

`expo install --check`: "Dependencies are up to date". `expo-doctor`: 21/21 checks passed. `pnpm why` shows one `react` (19.2.3) and one `react-native` (0.86.3) for the mobile app.

| Package | Version | Note |
| --- | --- | --- |
| `expo` · `expo-router` | ~57.0.30 · ~57.0.28 | |
| `react` · `react-native` | 19.2.3 · 0.86.3 | |
| `expo-secure-store` · `expo-notifications` · `expo-location` · `expo-application` | ~57.0.4 · ~57.0.23 · ~57.0.21 · ~57.0.3 | |
| `@react-native-async-storage/async-storage` · `@react-native-community/netinfo` · `react-native-svg` | 2.2.0 · 12.0.1 · 15.15.4 | SDK-pinned |
| `firebase` · `@firebase/auth` | ^12.14.0 (12.16.0) · 1.13.3 | `@firebase/auth` direct, pinned to firebase's own (ADR-003) |
| `@tanstack/react-query` · `zod` · `lucide-react-native` · `@expo-google-fonts/outfit` | ^5.104 · ^3.25.76 · ^1.60 · ^0.4.3 | Pure JS |
| `jest-expo` · `eslint-config-expo` | ~57.0.6 · ~57.0.2 | |
| `@testing-library/react-native` | ^14.1.0 | `render` and `fireEvent` are async in v14 |
| `typescript` · `@types/react` | ~6.0.3 · ~19.2.18 | |

## Exceptions

- **`expo install` fell back to SDK 58 versions** of `jest-expo` and `eslint-config-expo` when its version lookup timed out on the network (20 October 2026). They were replaced with the SDK 57 versions from `expo/bundledNativeModules.json`. If `expo install` prints a network error, check what it wrote before keeping it.
