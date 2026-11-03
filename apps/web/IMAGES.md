# Images — self-hosted & compressed

The marketing pages (`/`, `/about`, `/how-it-works`, and the coming-soon pages)
used to hot-link full-resolution images from Wikimedia Commons and Unsplash.
That added a third-party dependency on every page view, and the
"Aerial view of Lagos Island" file alone was **~2.3 MB** (served at full
resolution even though it only ever renders ~1600 px wide).

All marketing imagery is now **downloaded, re-encoded to WebP, and served
locally** from `apps/web/public/images/`.

| Image | Before | After |
| :--- | ---: | ---: |
| `about-aerial.webp` (Lagos Island aerial) | ~2.3 MB | **400 KB** |
| `hero-street.webp` | 720 KB | 496 KB |
| `hero-market.webp` | 601 KB | 377 KB |
| `trust-*` (5 candidates) | ~201–581 KB each | 80–351 KB each |
| **Total (11 images)** | 6.5 MB | **~2.9 MB** |

## How the pipeline works

1. **Manifest** — `scripts/fetch-images.mjs` lists every image by name, its
   remote source URL, and its attribution (`credit` / `creditUrl`).
2. **Download + compress** — the script fetches each URL and runs it through
   [`sharp`](https://sharp.pixelplumbing.com/) (`apps/web` devDependency):
   EXIF is normalized, width is capped (1920 px default, 1600 px for the
   aerial), and it is re-encoded to WebP at quality 80 (72 for the aerial).
3. **Local output** — results are written to `apps/web/public/images/<name>.webp`.

Re-run whenever a source changes:

```bash
# from the repo root
node apps/web/scripts/fetch-images.mjs
```

## How the site consumes the images

`src/lib/site-images.ts` is the single source of truth. It exports:

- `HERO_IMAGES` / `TRUST_IMAGES` — ordered arrays of candidates (each with
  `src`, `alt`, `label`, `credit`, `creditUrl`).
- `HERO_IMAGE` / `TRUST_IMAGE` — the *active* image for each slot.
- `ABOUT_AERIAL` — the compressed Lagos Island aerial used by the about hero.

**To swap an image**, change the index of the active export (all candidates are
already downloaded locally, so switching is instant):

```ts
export const HERO_IMAGE  = HERO_IMAGES[1];  // → Mile 12 market
export const TRUST_IMAGE = TRUST_IMAGES[2]; // → "Neighbors on a bench"
```

Attribution is kept inline on the page (hero credit link, trust & safety credit
line, about hero credit) to stay compliant with Wikimedia's CC BY-SA and
Unsplash's licence terms.

## Removing the external dependency entirely

Because every image now ships from `/public/images`, the remote hosts in
`next.config.js` (`images.remotePatterns` → `upload.wikimedia.org`,
`images.unsplash.com`) are no longer required for production. You can safely
delete those entries once you're sure nothing else references remote image
URLs. `googleusercontent.com` is still needed for Google profile avatars.

## Rebuilding / CI

The generated `.webp` files are committed to the repo (they are under
`apps/web/public/images/`), so `next build` works offline with no network
fetch. If you regenerate them locally, commit the diff — they are build inputs,
not build outputs.
