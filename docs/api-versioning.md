# API versioning

How the API changes without breaking the web app or app builds already on people's phones. Built 3 November 2026; the model is Nextdoor's public API, which versions its endpoints and announces deprecations before removing anything.

## How it works

- Every route answers at **`/api/v1/…`**. The unversioned **`/api/…`** is an alias for v1, so app builds already installed and existing environment settings (`NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_API_URL`, both ending in `/api`) keep working.
- The web and the app call `/api/v1/…`: `versionedApiUrl()` in `packages/api-contract/src/api-version.ts` adds the version to the configured base. Environment variables don't change.
- Every response carries **`API-Version: 1`**, so a bug report or a client can tell which version answered.
- **`GET /api/version`** (public) → `{ current: "1", supported: ["1"], deprecated: [] }`.
- An unknown version (`/api/v9/…`) is a `404`, never a silent fallback to v1.

Code: `apps/api/src/shared/http/versioning.ts` (`applyApiVersioning`, used by `main.ts` and the test app). Tests: `apps/api/test/api-versioning.e2e-spec.ts`.

## What counts as breaking

**Not breaking, so it ships in v1:**
- a new route;
- a new optional field in a request;
- a new field in a response;
- a new value in a list of reasons or kinds that clients already show with a fallback.

Clients must ignore response fields they don't know.

**Breaking, so it needs v2 of that route:**
- removing or renaming a field;
- changing a field's type or meaning;
- making an optional field required;
- changing a status code that clients act on (for example a `200` that becomes `204`, or a new `403` on an existing path);
- changing pagination.

## Making a breaking change

1. Add the new handler beside the old one, marked `@Version("2")`. Don't edit the v1 handler's shape.
2. Mark the v1 handler `@DeprecatedRoute({ since, sunset, successor })`. Every v1 response then carries `Deprecation`, `Sunset` and a `Link` to the successor (RFC 9745, RFC 8594).
3. Add the version to `SUPPORTED_API_VERSIONS` and to `deprecated` in `GET /api/version`.
4. Move the web to v2 (`API_VERSION` in `packages/api-contract/src/api-version.ts`), together with the code that reads v2's shapes.
5. Ship an app build on v2. Keep v1 until **both**: 6 months have passed since v2 shipped, **and** the minimum supported app version (see below) excludes every build that still calls v1.
6. Remove the v1 handler on the sunset date. Record it in [api-contract.md](./api-contract.md).

## Not done yet: app release versions

Agreed to come back to later (3 November 2026). Intended shape:

- `GET /api/version` also returns `minAppVersion` (and `latestAppVersion`).
- The app compares these with `Constants.expoConfig.version` on launch. Below the minimum it shows "Please update", which links to the store. Below the latest, a dismissable nudge.
- The web and API report their release (git SHA or tag) in the same response for support.
- Release numbering for `apps/mobile/app.config.ts` `version` and the build numbers (EAS `autoIncrement`).
