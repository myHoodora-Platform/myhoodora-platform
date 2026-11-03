# Worklog: file storage, photo posting, search, kindness check (2026-09-30)

A resumable checklist. If a session ends mid-way, continue from the first unticked box. Every step leaves `tsc`, `eslint` and tests green.

## What exists today (inspected)
- **No backend storage.** The browser uploads straight to Firebase Storage (`apps/web/src/lib/api/media.ts`) with a 6 s timeout ("Photo uploads aren't set up yet"). The API only stores URLs: posts `mediaUrls[]` (max 10), listings `photos[]`, profile `photoURL`, all validated as https.
- One shared `ImagePicker` (post composer, listing form, group form, profile settings). Posts use **one** photo (`mediaUrls[0]`).
- Adapter pattern to copy: `communications/` (`EMAIL_PROVIDER` token, a factory in a `@Global()` module, adapters in `providers/`).
- Search: header box is a disabled placeholder. Kindness: word list in `apps/web/src/features/feed/kindness.ts`, used by the composer and comments.

## Part S: storage abstraction (API)
- [x] S1. `src/storage/`:
  - `providers/storage-provider.ts`: the `StorageProvider` port (`upload`, `delete`, `url`), the `STORAGE_PROVIDER` token and the types.
  - `providers/cloudinary-storage.adapter.ts`: the only file that imports `cloudinary`.
  - `storage.service.ts`: validation (type allowlist, size limits), per-environment folders, the `media_assets` record (owner, provider id, url) so deletes work by our id.
  - `storage.module.ts`: `@Global`, factory on `STORAGE_PROVIDER`.
  - `storage.controller.ts`: `POST /media` (multipart `file` + `purpose`), `DELETE /media/:id` (owner).
- [x] S2. Config: `storage.provider` (`STORAGE_PROVIDER`, default `cloudinary`) and `storage.cloudinaryUrl` (`CLOUDINARY_URL`). Validate the format and never log it. Missing → uploads answer 503 with a clear message; an unknown provider fails at startup. Update `.env.example` and `turbo.json`.
- [x] S3. Tests: the service (validation, folders, delete ownership) with a mocked provider; the Cloudinary adapter with a mocked SDK.

## Part P: posting photos properly (web)
- [x] P1. `lib/api/media.ts` → `uploadMedia(user, file, purpose)` via `POST /media` (FormData); drop direct Firebase Storage use.
- [x] P2. `ImagePicker` keeps its single-photo API for listing, group and profile, and deletes uploads the person removes. Composer: **up to 10 photos** with thumbnails, remove, and per-photo upload state; posts send `mediaUrls[]`.
- [x] P3. Post card: photo grid (1 / 2 / 3 / 4+ with "+N") plus a lightbox. Add `res.cloudinary.com` to `next.config` images.

## Part Q: search
- [x] Q1. API `GET /search?q&type=posts|listings|people&limit`: caller's Hood only, verified-gated like the feeds, respects blocks and removed content. Reuses the existing visibility filters and `GET /users/search` rules.
- [x] Q2. Web: enable the header box → `/search?q=` page with tabs (All · Posts · For Sale · People), Nextdoor-style.

## Part K: kindness check
- [x] K1. API `POST /moderation/check { text } → { flagged, reasons }` (the word list moves server-side, with reasons). Throttled.
- [x] K2. Web: the composer and comments call it (the mock mode keeps the local list). If the check fails, the post still goes through.

## Part Z: finish
- [x] Z1. Contract: storage (§20), search, kindness; move them out of "Planned". A short storage README section on switching providers.
- [ ] Z2. Verify: API + web tests, lint, live Cloudinary upload once `CLOUDINARY_URL` is in `apps/api/.env`, Chrome check.

## Progress notes
- Part S done: `src/storage/` (port, Cloudinary adapter, service, `media_assets`, `POST /media`, `DELETE /media/:id`), 18 tests. `cloudinary@2.11.0` added. `CLOUDINARY_URL` is not in `apps/api/.env` yet, so uploads answer 503 locally until it is.
- Part P done: `lib/api/media.ts` (`uploadMedia`, `discardMedia`; the Firebase Storage client is removed), `PhotoPicker`/`ImagePicker` (multi, parallel uploads, remove deletes), composer and listings take up to 10 photos, `PhotoGallery` + lightbox on post cards and listing detail, `res.cloudinary.com` allowed. Web 97 tests.
- Q1 done: `GET /search` (`src/search/`) reuses feed/listings/user search via a new optional `q` on `FeedQuery` and `ListingQuery`; 3 tests. K done: `src/moderation/kindness.ts` + `POST /moderation/check` (5 tests); web `lib/api/kindness.ts` (fails open after 3 s), composer and comments show the reason hint. API 57 tests.
- Q2 done: `/search` page (tabs, All shows 5 of each + "See all"). One search box: the header on desktop (shows the current query), the page's own box on phones only.
- Z1 done: contract §20–22 + status rows; README "File storage" (replaces the old Firebase Storage rules). Removed a stray "Reminders:" block that had been pasted into the contract.
- Z2: API 57 tests, web 97, lint clean; live script 16/16 (kindness, search, media with uploads off). **Still to do:** a live Cloudinary upload once `CLOUDINARY_URL` is in `apps/api/.env`, then post a multi-photo post in Chrome.
