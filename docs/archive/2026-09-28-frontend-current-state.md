# Frontend — Current State

_Audit of `apps/web` on branch `pre-launch`, 2026-09-28. Describes what exists today, not what we want._

## Project overview

| Area | What exists |
| --- | --- |
| Framework | Next.js 16.2 (App Router), React 19.2, TypeScript 5.9 |
| Monorepo | pnpm + Turborepo. `apps/web`, `apps/api` (NestJS + MongoDB), `apps/mobile`, `packages/ui`, `packages/eslint-config`, `packages/typescript-config` |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss`; tokens in `src/app/globals.css` (`:root` + `@theme inline`) |
| UI primitives | `@myhoodora/ui` (shadcn-style): avatar, badge, breadcrumb, button, card, checkbox, dropdown-menu, input, password-input, select, sidebar, skeleton, textarea, logo, section, kicker, divider, image |
| Icons | lucide-react |
| Motion | framer-motion (landing/about), Tailwind `animate-in` classes |
| Forms | react-hook-form + zod on the auth pages; hand-rolled `useState` forms elsewhere (post composer, onboarding, settings/account) |
| Auth | Firebase Auth on the client (`onIdTokenChanged`). `/api/auth/session` exchanges the ID token for a Firebase **session cookie** minted by the API (`POST /auth/session`, 7 days); `src/proxy.ts` verifies it with the Admin SDK, asks the API whether it was revoked (remembered for 60 s) and redirects. Mock mode has no server session. `sessionReady` in `AuthContext` says when protected pages will load. See `docs/api-contract.md` §24 |
| State | React Context: `AuthContext` (user, profile, gating modal, gated actions), `FeedContext` (posts, pagination, mutations), `AdminDataContext` |
| Data fetching | Raw `fetch` with Firebase ID token as Bearer, in `src/lib/firebase/auth.ts` and `src/lib/firebase/posts.ts`. No cache/query library |
| Maps | maplibre-gl (onboarding location picker) + in-app geocoding proxy routes (`/api/geocode`, `/api/reverse-geocode`, `/api/ip-location`) |
| Toasts | sonner (`<Toaster position="top-right" richColors />` in root layout) |
| Reactions | `@charkour/react-reactions` (Facebook-style selector), `emoji-picker-react` |
| Testing | **None.** No unit, component, or e2e tests and no test runner configured in `apps/web` |
| Dark mode | **None.** 0 `dark:` classes; tokens are light-only |

## Folder structure

```text
apps/web/src/
├── app/
│   ├── (auth)/            login, register, forgot-password, reset-password (+ shared layout)
│   ├── dashboard/         signed-in app: feed (page.tsx), events, marketplace, safety-watch, settings, settings/account
│   ├── admin/             admin panel: overview, neighborhoods, users, queries, notifications
│   ├── onboarding/        3-step location + verification wizard (789 lines, single file)
│   ├── api/               Next route handlers: session cookie, logout, geocoding proxies
│   ├── coming-soon/       generic + [feature] placeholder pages
│   ├── about, how-it-works, guidelines, privacy, page.tsx (landing), not-found
├── components/
│   ├── dashboard/         shell, sidebar, header, nav config, notification bell, verification banner, skeleton, preview header
│   ├── admin/             admin shell/sidebar/header/nav, stat tile
│   ├── home/, about/, legal/, layout/   marketing site sections, public header/footer
│   ├── onboarding/        location-map
│   ├── settings/          profile-hero, settings-list-row
│   └── shared/            gates (OnboardingGatingModal, VerifiedGate), confirm-overlay, emoji picker, image fallback, social auth, back button
├── context/               AuthContext, FeedContext, AdminDataContext
├── hooks/                 use-require-onboarded
├── lib/
│   ├── firebase/          Firebase config + **REST API client for our NestJS API** (auth.ts, posts.ts), error mapping
│   ├── feed/              author resolver, media upload, event-meta encoding, alert-seen (localStorage)
│   ├── geocoding/, validation/, admin/mock-data.ts, coming-soon.ts, safe-redirect.ts, time.ts, site-images.ts
└── proxy.ts               route protection (Next 16 "proxy", formerly middleware)
```

## Current application flow

```text
Landing (/)  ──►  Register / Login (email or Google)
                        │
                        ▼
              /onboarding  (3 steps: address + map pin → confirm → live verification checklist)
                        │   (can be skipped → "Onboarding skipped"; gating modal re-prompts later)
                        ▼
              /dashboard  = Neighbourhood Feed (real data from API)
                 ├─ Composer: General / Event / Alert / Photo post
                 ├─ Post card: react (count only), comment (coming soon), share (link to /dashboard?post=id), delete own
                 ├─ Alerts pinned to top of loaded page
                 └─ Load more (skip/limit)
              Sidebar ─► Safety Watch Group  (mock data, verified-only)
                      ─► Community Events    (mock data, verified-only)
                      ─► Marketplace Listings(mock data, verified-only)
                      ─► Profile card → /dashboard/settings → /dashboard/settings/account
                      ─► Log out
              Header  ─► Bell dropdown: newest unseen alert + "verification pending"
              Banner  ─► "Pending Verification" (Verify location / Contact support)
              /admin  ─► client-side role check; mostly mock data
```

Unverified users can read and post in the feed (soft gate via `runGatedAction` / onboarding modal) but are fully blocked from Safety Watch, Events and Marketplace by `VerifiedGate`.

## Page inventory

| Route | Page | Purpose | Current state | Problems | Proposed direction |
| --- | --- | --- | --- | --- | --- |
| `/` | Landing | Marketing + inline auth card | Built | Separate visual language from app | Restyle with new tokens (later phase) |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth | Account access | Built, zod-validated | Fine functionally | Keep; restyle |
| `/onboarding` | Onboarding wizard | Set location, verify neighbourhood | Built, real API | 789-line file; skip path leaves user half-onboarded | Keep flow; split into step components |
| `/dashboard` | Neighbourhood Feed | Core product | **Real data** | 747-line file; no fetch-error state (errors look like "No posts yet"); every other author shows as "Neighbour"; no comments; header title "Neighbourhood Feed" | Becomes **Home** feed (see IA doc) |
| `/dashboard/safety-watch` | Safety Watch Group | Safety alerts + watch group | Mock data, "Preview" | Mixes two concepts (alert list + joinable group); duplicates the real `alert` posts already in the feed | Split: **Alerts** (real alert posts) + **Groups** (watch group) |
| `/dashboard/events` | Community Events | Local events | Mock data | Real `event` posts exist in the feed but aren't shown here | Show real event posts; keep preview fallback |
| `/dashboard/marketplace` | Marketplace Listings | Buy/sell locally | Mock data | No backend | Rename **For Sale & Free**; stays preview |
| `/dashboard/settings` | Settings hub | Profile, neighbourhood, logout | Partly real | Header title falls back to "Dashboard"; breadcrumb "Dashboard" | Keep; fix titles |
| `/dashboard/settings/account` | Account | Edit display name | Real | Hand-rolled form | Move to react-hook-form + zod |
| `/admin/*` | Admin panel | Ops | Mostly mock | Role check is client-only (see QA risks) | Out of scope for revamp except tokens |
| `/coming-soon/[feature]` | Placeholder | Unbuilt features | Built | — | Keep |
| `/about`, `/how-it-works`, `/guidelines`, `/privacy` | Marketing/legal | Info | Built | — | Restyle only |

## Current navigation

- **Sidebar** (`components/dashboard/navigation.ts`, `dashboard-sidebar.tsx`): 4 items in 3 labelled groups — _Overview_: Neighbourhood Feed · _Community_: Safety Watch Group, Community Events · _Marketplace_: Marketplace Listings. Footer: profile card → settings, Log out. Collapsible on desktop; overlay drawer on mobile. Config is centralised — good.
- **Header**: sidebar trigger, page title (derived from active nav item), notification bell. No search, no avatar menu, no primary "Post" CTA.
- **Breadcrumbs**: only on settings pages.
- **Tabs/filters**: none in the feed.
- **Mobile**: hamburger → drawer. No bottom tab bar. Composer is at the top of the feed only.
- **Deep links**: `/dashboard?post=<id>` highlights and scrolls to a post; `proxy.ts` preserves it through login via `?next=`. Works.
- **Route strings**: hard-coded across ~40 `href="..."` sites; only the sidebar uses a config.
- **Back navigation**: bfcache deliberately preserved; `pageshow` re-validates session. Good.

## Current UX problems

1. **Feed failures are invisible.** `FeedContext` catches fetch errors with `console.error` and the page renders "No posts yet — be the first". Right now the API can't reach MongoDB, so every user would see an empty neighbourhood instead of an error.
2. **Every other neighbour is anonymous** ("Neighbour", initial "N") because there's no user lookup endpoint. This kills trust, which is the core of a Nextdoor-style product.
3. **Two alert systems.** Real `alert` posts in the feed, plus a separate mock "Safety Watch" page. Users can't find "all alerts in my area" in one place.
4. **Events split the same way**: real event posts live only in the feed; the Events page shows mock data.
5. **Nav labels are long and system-ish** ("Neighbourhood Feed", "Safety Watch Group", "Marketplace Listings") vs. the short verbs/nouns people expect (Home, Alerts, Events, For Sale & Free).
6. **No persistent "Post" action** — on mobile you must scroll to the top of the feed to post.
7. **Preview pages look real** but every button toasts "coming soon" — acceptable pre-launch, but they need consistent labelling.
8. **Composer**: post-type chips double as a mode switch (Photo type is required to attach an image); event date/location labels aren't linked to inputs.
9. **Comments** show as an action but always toast "coming soon".
10. **Verification** messaging appears in 3 places (banner, bell, gate) with different wording.

## Current UI problems

- **315** hard-coded palette classes (`slate-*`, `emerald-*`, `rose-*`, `amber-*`, `sky-*`, `violet-*`) vs 378 token classes — two parallel colour systems.
- Micro type sizes (`text-[10px]`, `text-[11px]`, `text-[13px]`) for timestamps and nav — below comfortable reading size on mobile.
- Cards are consistent-ish (`rounded-2xl border-slate-100 shadow-sm`) but repeated inline everywhere instead of using `Card`.
- Raw `<input>`s in the composer instead of `@myhoodora/ui` `Input`.
- Post type badges (rainbow of colours) compete with content; visual noise.
- Content column capped at `max-w-5xl` with no right rail, so desktop space is wasted and feed lines get very long.
- Brand: teal `#147c73` + coral `#ff6b5b` defined in `brand/`, but coral is barely used; no semantic success/warning/info tokens.

## Current technical problems

- **Monolith pages**: `dashboard/page.tsx` (747 lines: ReactionButton, share, PostCard, PostComposer, skeleton, page), `onboarding/page.tsx` (789).
- **Misplaced API client**: our NestJS REST client lives under `lib/firebase/`; `API_BASE_URL` is duplicated in two files.
- **No shared fetch wrapper**: token retrieval, error parsing and status handling repeated in every call.
- **Pagination by `skip`** while mutating the list locally: after a delete, or when neighbours post between pages, the offset drifts → skipped or duplicate posts (duplicate `_id` keys).
- **Feed state in a layout-level context**: `FeedProvider` wraps every dashboard route, so the feed fetches even on Settings (it's also used by the bell).
- **Data encoded in text**: event date/location serialised into `content` as `<!--event:{...}-->` because the schema lacks fields.
- **Reaction type stored in localStorage** per device; backend only stores `likes: string[]`.
- Header title derived from nav config falls back to "Dashboard" for any unlisted route.
- `role="menu"` on the reaction popover without `menuitem` children.

## Current QA risks

| Risk | Where |
| --- | --- |
| No automated tests at all | whole app |
| Feed error indistinguishable from empty feed | `FeedContext` |
| Pagination drift / duplicate keys | `FeedContext.loadMore` |
| Admin authorization only checked client-side (`profile.role === "admin"`); proxy only checks "logged in". Must be enforced by the API for every admin endpoint | `admin-shell.tsx`, `proxy.ts` |
| Deep link `/dashboard?post=id` must survive any route rename | feed, bell, share, proxy |
| Onboarding skip → partially onboarded users in the app | onboarding, gating modal |
| Photo upload times out if Storage isn't provisioned (handled with a 6s timeout + message) | `media-provider.ts` |
| Unlabelled form inputs (event date/location, image URL) | composer |
| Mobile: drawer-only nav, tiny tap targets (`size-7` reaction caret) | shell, post card |
| Security: `serviceAccountKey.json` and `.env` are git-ignored and untracked (verified). Keep it that way; never import them from web code | api |

## Existing backend capabilities (constraint for the revamp)

`POST /posts`, `GET /posts/neighborhood/:id?limit&skip`, `PATCH /posts/:id/like`, `DELETE /posts/:id`, `GET/PATCH /users/me`, `PATCH /users/me/onboarding`, `POST /users/me/verify-location`, `GET /neighborhoods`, `/neighborhoods/nearby`, `/neighborhoods/:id`.

Not available yet: user lookup (author names), comments, reaction types, event fields, marketplace, groups, notifications, search, chat. Per project convention the revamp is **frontend-first with mock data** where the backend is missing; backend gaps are listed as dependencies, not built.
