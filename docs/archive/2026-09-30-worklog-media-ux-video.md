# Worklog: media UX, video, profile photo, onboarding 404 (2026-09-30)

A resumable checklist. Continue from the first unticked box. Keep `tsc`, `eslint` and tests green.

## Findings (inspected)
- **Profile photo lost** (account "Peace JAmes"): `photoURL` is saved but the Cloudinary file answers **404**. Three bugs chained:
  1. `PhotoPicker` kept the local blob preview after upload and revoked it, so the tile went blank (the screenshot).
  2. Pressing ✕ deletes a same-session upload from Cloudinary, even when it's already the saved photo.
  3. Profile save sends `photoURL: undefined` when removed, so the account keeps pointing at a deleted file.
- **Onboarding "We couldn't find what you were looking for."**: `PATCH /users/me/onboarding` 404s ("Profile not found.") when the Firebase user has no Mongo document yet. Only `GET /users/me` creates it. The web app then maps 404 to a generic message and sends the person back to step 1.
- **Post photos look "too bold"**: a single photo spans the card at its natural height (clamped only by `max-h-[28rem]`), with a centre crop that cuts off heads. Feeds (Instagram, Facebook) keep feed images between **1.91:1 and 4:5** and crop the rest; Cloudinary `g_auto` crops around faces and subjects.
- **Video**: the API accepts MP4/MOV/WebM (≤ 50 MB, posts only), but the web app has no video picker or player. Nextdoor: "up to 10 images **or** a short video clip" per post.

## Steps
- [x] V1. Profile photo:
  - The picker shows the uploaded URL once done and revokes the blob only then. Removing a photo never deletes a file the parent may have saved; server-side cleanup instead.
  - Profile gets a proper avatar control (circle, "Change photo" / "Remove"), **saved immediately** like Facebook and Nextdoor.
  - API: `PATCH /users/me` accepts `photoURL: null` and deletes the *previous* uploaded avatar (ours only) after a change.
- [x] V2. Onboarding self-heal: `PATCH /users/me/onboarding` (and the other `/users/me` writes in the onboarding flow) create the account from the token when it's missing, the same as `GET /users/me`. Web: a clear message instead of the generic 404 text, and no reset to step 1 for this case.
- [x] V3. Smart feed media:
  - A web `mediaUrl()` loader (like Next.js image loaders): for Cloudinary URLs it adds size, `c_fill,g_auto` and the aspect ratio; any other URL passes through unchanged.
  - One photo shows at its own ratio, clamped to 1.91:1…4:5. Grids crop smartly. `srcset` so phones download small files.
- [x] V4. Video:
  - API: max **60 s** (checked after upload; longer videos are deleted and rejected), still 50 MB, **one video per post** (photos *or* a video). Deliver as `.mp4` (`q_auto`, ≤ 1280 px) so any provider's URL is recognisable by extension.
  - Web: the composer picks a photo or video (client checks type, size and duration), shows a video tile with its duration, and the post card gets an inline player (`controls`, `playsInline`, `preload="metadata"`, no autoplay with sound).
- [x] V5. Tests (API + web), docs (contract §20), Chrome check: avatar persists across logout, a portrait photo is framed properly, a video posts and plays.

## Progress notes
- V1 done: `AvatarField` (instant save, Change/Remove), `PATCH /users/me` accepts `photoURL: null`, `StorageService.discardByUrl` deletes the replaced avatar server-side; picker shows the stored URL after upload.
- V2 done: `UsersService.ensureAccount` on onboarding / PATCH me / verify-location; clear web message for a 404.
- V3 done: `lib/media/media-url.ts` (imageUrl/imageSrcSet/clampAspect/isVideoUrl/videoPoster, 8 tests) used by the gallery, avatars and listing photos. Verified on the real Cloudinary account: `g_auto` keeps the face in frame.
- V4 done: API 60 s limit (delete + 400), MP4 delivery ≤ 1280 px with eager async, `mediaMixProblem` (photos or one video); web `checkMedia`, `apiUpload` (XHR progress), picker video tile + % ring, `VideoPlayer` in the gallery. API 62+ tests, web 105.
- Added mid-task (user asks): "Add from link" `POST /media/import` (safe remote fetch, `remote-file.ts`, 6 tests; the user's Pexels link imports as a 10 s MP4), and Camera / Record video buttons on touch devices.
- V5 done: live scripts 15/15 (video, limits, mix rule, avatar cleanup, onboarding self-heal) + 6/6 (import, SSRF). Chrome: avatar persists and loads (200, tracked), portrait photo shown whole, 2-photo grid smart-cropped, video poster + plays (1080×1920 MP4), viewer with arrows. Contract §20 updated.
