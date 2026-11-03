# Worklog: direct-to-storage video upload (2026-09-30)

**Problem:** `POST /media` buffers the whole file in API memory (multer) before sending it to Cloudinary. A few 50 MB videos at once could exhaust a small Render instance, and the limit can't grow.

**Fix:** the browser uploads straight to the provider with a one-time signed ticket; the API only signs and then verifies. Both steps are behind the `StorageProvider` port (optional methods), so another provider can add them later and callers don't change.

Verified by prototype on the real account (2026-09-30):
- A signed upload to `api.cloudinary.com/v1_1/<cloud>/video/upload` works from any client.
- Changing the signed `public_id` → 401 "Invalid Signature", so a ticket is good for exactly one file.
- `api.resource(id, { resource_type: "video", media_metadata: true })` returns the real `duration` and `bytes`, so limits are enforced on what Cloudinary stored, not on what the browser claims.

## Steps
- [x] D1. Port: optional `createDirectUpload()` + `describe()`. Cloudinary adapter: sign `{ timestamp, public_id, eager (MP4 delivery), eager_async }`; `describe` via the Admin API with `media_metadata`.
- [x] D2. Service + API:
  - `POST /media/direct { purpose, mimetype, size }` → `{ id, upload: { url, fields, fileField, expiresAt } }`, or `{ upload: null }` when the provider can't. Records a *pending* `media_assets` row (TTL 2 h).
  - `POST /media/:id/complete` → reads the stored file back, enforces ≤ 100 MB and ≤ 60 s (deletes and 400 otherwise), marks the row ready, returns the normal media shape.
  - Videos only for now; photos (≤ 10 MB) keep the server path, which applies the size cap and metadata stripping.
- [x] D3. Web: `uploadMedia` for videos → ticket → XHR straight to the provider (progress) → complete; falls back to `POST /media` if `upload` is null. Client video limit 100 MB.
- [x] D4. Tests (adapter signing/describe, service ticket/complete rules), live test on the real account, docs (contract §20), Chrome check.

## Progress notes
- All done. API storage tests 37 (signing, describe, ticket/complete/limits). Web 106 (direct path test with fake XHR). Live 14/14 on the real account: a 65.8 MB video went straight to Cloudinary in 20.6 s and was verified at 65.8 MB / 25 s; a 65 s clip was deleted + 400; tampered signature 401; TTL index present. CORS OK for localhost:3000 and myhoodora.com. Chrome: the composer upload went the direct path (signed id, status ready), and removing the clip deleted it (404).
- Known leftover: a file uploaded but never completed stays in Cloudinary (its pending row expires). Optional later: a sweep job.

## Follow-up (same day): direct off, API path hardened
The user chose the API path because of the free plan's Admin API quota. `STORAGE_DIRECT_UPLOADS` defaults to off (web: `media.direct` "planned"); the code stays for a paid plan.
- Disk streaming (multer `dest`) + a single streamed `uploader.upload(path)`. Tried `upload_large` first: it returns a stream, not a promise, reads the file itself (deleting the temp file crashed the process), and measured 231 s / +365 MB against 18.8 s / ~+2 MB. Dropped.
- Magic-byte sniffing (`sniffMediaType`), `UploadGate` (4 at once, queue 20, then 503), 20-min request timeout, link downloads to temp files (fixed a race that left 0-byte files), and a stale temp sweep (startup + hourly).
- Limits: photos 10 MB; videos 100 MB / 60 s through the API.
- Live 11/12 (memory check re-measured separately: warm-up once, then +1–5 MB per 65.8 MB upload). Chrome: a composer video went through the API (Cloudinary-generated id, no `/media/direct` call). Deleted 3 orphans my tests left in the dev folder.
- Status badges: `listingStatusTone()` next to `listingStatusLabel()` (green available, amber pending, neutral sold, teal given away; solid on photos, soft on buttons). The listing photo card no longer stretches.
