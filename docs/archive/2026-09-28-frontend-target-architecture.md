# Frontend — Target Architecture

Guiding rule: keep Next.js App Router + Context + `@myhoodora/ui`; move code into feature folders and add only the abstractions that fix a problem named in `frontend-current-state.md`.

## Folder structure

```text
apps/web/src/
├── app/                                  routes only — pages compose features
│   ├── (app)/                            signed-in shell; route group adds no URL segment
│   │   ├── layout.tsx                    AppShell + FeedProvider
│   │   ├── news-feed/page.tsx            <HomeFeed />
│   │   ├── p/[id]/page.tsx               <PostPage /> + generateMetadata (OG preview)
│   │   ├── for-sale/page.tsx, for-sale/[id]/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── events/page.tsx, events/[id]/page.tsx
│   │   ├── groups/page.tsx, g/[id]/page.tsx
│   │   ├── notifications/page.tsx
│   │   ├── profile/[uid]/page.tsx
│   │   ├── settings/{page,account,neighbourhood,notifications,privacy}
│   │   ├── help/page.tsx
│   │   ├── loading.tsx, error.tsx        route-level skeleton + error boundary (new)
│   ├── (public)/neighbourhood/[slug]/page.tsx   public neighbourhood page (later phase)
│   ├── (auth)/…, onboarding/, admin/, marketing pages   unchanged
├── components/
│   ├── layout/app-shell/                 AppShell, AppSidebar, AppHeader, MobileTabBar, MoreSheet, RightRail, UserMenu, CriticalAlertBanner
│   └── shared/                           PageHeader, EmptyState, ErrorState, FilterChips, VerifiedGate, ConfirmDialog, ComingSoonBadge
├── features/
│   ├── feed/
│   │   ├── components/                   PostCard, PostHeader, PostBody (see more), PostMedia, PostActions, ReactionButton, PostMenu,
│   │   │                                 PostComposer, ComposerDialog, CategoryPicker, FeedList, FeedSkeleton
│   │   ├── feed-context.tsx              (moved from context/FeedContext.tsx) + error, refetch, getPost(id)
│   │   ├── use-feed-filter.ts            ?filter= ↔ post category
│   │   ├── categories.ts                 composer categories → PostType mapping (single source)
│   │   └── lib/                          event-meta, author-provider, media-provider, share, kindness-check
│   ├── post/                             PostPage, CommentsSection (placeholder until API), MoreFromNeighbourhood
│   ├── alerts/                           AlertCategoryChips, AlertList, AlertsMap (maplibre), alert-categories.ts
│   ├── events/                           EventList (upcoming/past from event posts), EventDateBadge
│   ├── for-sale/                         ListingGrid, ListingCard, ListingDetail, mock-listings.ts
│   ├── groups/                           GroupList, GroupCard (Join/Request), GroupPage, mock-groups.ts
│   ├── notifications/                    NotificationBell, NotificationList, derive-notifications.ts
│   ├── profile/                          ProfileHeader, ProfilePosts
│   ├── onboarding/                       one component per step + useOnboardingDraft
│   └── settings/
├── lib/
│   ├── api/
│   │   ├── client.ts                     apiFetch(user, path, init): base URL, token, JSON, ApiError
│   │   ├── posts.ts, users.ts, neighborhoods.ts
│   ├── firebase/                         Firebase SDK only (config, auth helpers, errors)
│   └── routes.ts                         ROUTES constants, nav config, PUBLIC_PATHS
└── context/AuthContext.tsx               unchanged API
```

## Decisions

| Decision | Why |
| --- | --- |
| **Flat top-level routes via `app/(app)/` route group** | Matches Nextdoor (`/news_feed/`, `/p/`, `/events/`, `/g/`); URLs read as places; no "dashboard" wording anywhere a user sees |
| **`/p/[id]` is a real page** with `generateMetadata` | Share links need OG title/description/image — this is how posts spread on WhatsApp. Nextdoor even serves `/link_preview_image/`. Until `GET /posts/:id` exists, the page reads the post from FeedProvider (signed-in only) and uses generic OG metadata |
| **`proxy.ts` protects everything except an allowlist** (`PUBLIC_PATHS` in `routes.ts`) | With ~12 top-level app routes, listing protected paths is fragile — one missed route becomes publicly reachable. Default-deny is safer |
| **Feature folders**, not a full rewrite | `dashboard/page.tsx` and `onboarding/page.tsx` are the two monoliths; splitting by feature makes them testable |
| **Keep Context, no React Query/Zustand (yet)** | Only one real data stream (feed). Revisit when comments/notifications/listings add more server state — that is the trigger to adopt TanStack Query |
| **`lib/api/client.ts`** | One place for base URL/token/error parsing; typed `ApiError` lets the UI show real error states |
| **Feed state stays layout-level** | Home, Post page, Alerts, Events, bell and right rail read the same posts; one fetch serves all |
| **Composer categories map onto existing `PostType`s** (`categories.ts`) | Backend enum is `text/image/event/alert`. Recommendation, Lost & found, Thank a neighbour, Sell → stored as `text` with a category tag until the API adds a `category` field; the mapping lives in one file so the migration is one change |
| **Cursor pagination** requested from API (`?before=<createdAt>`) | Fixes skip drift. Until then, de-dupe by `_id` on merge |
| **Filters in the URL** (`?filter=alerts`) | Deep-linkable, back/forward works, no extra state |
| **Mock data lives in the feature** (`mock-listings.ts`, `mock-groups.ts`) behind the same shape the API will return | Preview pages swap to real data by replacing one import |
| **Redirects**: path renames in `next.config.js`; `/dashboard?post=` → `/p/:id` in `proxy.ts` | Old links and shared URLs keep working |

## Route architecture

| Route | Access | Gate |
| --- | --- | --- |
| `/`, `/about`, `/how-it-works`, `/guidelines`, `/privacy`, `/coming-soon/*` | public | — |
| `/neighbourhood/[slug]` (later) | public | — |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | guest-only | proxy |
| `/onboarding` | signed in | proxy |
| `/news-feed`, `/p/[id]`, `/notifications`, `/profile/*`, `/settings/*`, `/help` | signed in | proxy → onboarding modal if not onboarded |
| `/alerts`, `/events/*`, `/for-sale/*`, `/groups`, `/g/*` | signed in + verified | proxy → `VerifiedGate` (same rule as today) |
| `/admin/**` | signed in + admin | proxy + client role check; **API must enforce admin role** |

## Authentication / authorization boundaries

- Client never decides authorization; it only hides UI. Every mutation relies on the API validating the Firebase token and ownership (e.g. delete own post).
- Feed `neighborhoodId` always comes from the signed-in profile (existing invariant — keep).
- No secrets in `NEXT_PUBLIC_*` beyond Firebase web config (public by design).

## Component architecture

- **Primitives** (`@myhoodora/ui`): add shadcn `dialog`, `sheet`, `tabs`, `tooltip`, `sonner` wrapper, `alert`, `separator`, `scroll-area` — each replaces a hand-rolled or missing pattern (ConfirmOverlay → Dialog, mobile composer → Sheet, chips → Tabs/ToggleGroup).
- **Shared**: `PageHeader`, `EmptyState`, `ErrorState` (message + Retry), `FilterChips`, `ConfirmDialog`.
- **Feature**: as above. Pages contain no fetch calls.

## Design system

New UI language built on the existing brand anchors (mascot + wordmark stay). Proposed tokens (light; dark mode added in Phase 8):

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#F7F6F2` warm off-white | app canvas (cards sit on it) |
| `--card` | `#FFFFFF` | |
| `--foreground` | `#14201E` | text |
| `--muted-foreground` | `#5B6663` | meta text (passes AA on both backgrounds) |
| `--primary` | `#0F6B5F` deep green-teal | Post button, active nav, links |
| `--primary-foreground` | `#FFFFFF` | |
| `--accent` | `#FF6B5B` coral (brand) | highlights, unread dots, "new" |
| `--secondary` | `#E8F1EE` | chip backgrounds, hover |
| `--border` | `#E4E2DC` | |
| `--destructive` | `#C8372D` | |
| `--success` / `--warning` / `--info` | `#1F8A4C` / `#B7791F` / `#2563A8` | alert categories, status |
| Radius | `--radius: 0.875rem`; chips/buttons full | |
| Type | Outfit; scale 12 / 14 / 16 / 18 / 22 / 28; body 15–16px; min meta 12px | removes 10–11px text |
| Spacing | 4px base; card padding 16 (mobile) / 20 (desktop) | |
| Shadow | one level: `0 1px 2px rgb(20 32 30 / .06)` | |
| Layout | left nav 248px, feed max 640px, rail 320px | |

Alert category colours map to semantic tokens (Security → destructive, Power → warning, Flooding → info, Traffic → warning, Fire → destructive).

Rule: no raw palette classes (`slate-*`, `rose-*` …) in app code; lint for it in Phase 1.

## News feed architecture

```text
FeedProvider (layout) ── posts, loading, error, hasMore, loadMore, refetch, create/toggleLike/delete
   │
   ├─ HomeFeed page (/news-feed)
   │    (no PageHeader — the composer is the top of the page)
   │    PostComposer (inline) ── ComposerDialog shares the same form component
   │    FilterChips  (?filter)
   │    FeedList ── PostCard ── PostHeader · PostBody · PostMedia · PostActions(ReactionButton, Comment, Share, More▾ Delete)
   │    states: FeedSkeleton | ErrorState(retry) | EmptyState(per filter) | Load more
   ├─ PostPage (/p/[id])  getPost(id) from context → full post, comments placeholder, "More from your neighbourhood"
   ├─ Alerts page  (posts.filter(type=alert) + category chips — categories need backend field; Phase 4 uses "All" only)
   ├─ Events page  (posts.filter(type=event), sorted by decoded date)
   └─ NotificationBell / RightRail
```

## Testing architecture

- **Vitest + React Testing Library** for components/hooks (nothing exists today; Vitest is fast and needs little config for a Next.js app).
- **Playwright** for critical journeys: login → news feed, create post, react, delete own post, open `/p/[id]` through login, old `/dashboard?post=` link redirects to `/p/[id]`.
- **axe** (`@axe-core/playwright`) on Home, Alerts, Settings, Onboarding.
- API mocked at the `lib/api` boundary (MSW) so tests don't need Mongo.

## Accessibility strategy

Radix-based primitives for dialog/sheet/menus (focus trap, Esc, labelled). Every icon-only button gets `aria-label`. Labels bound with `htmlFor`. 44×44px touch targets. `prefers-reduced-motion` respected for framer-motion. AA contrast checked for every token pair.

## Responsive strategy

| Width | Layout |
| --- | --- |
| < 640 | single column, bottom tab bar, composer as Sheet, full-bleed post media |
| 640–1023 | single column, centred 640px, bottom tab bar |
| 1024–1279 | left nav + feed |
| ≥ 1280 | left nav + feed + right rail |

## Low-data strategy (Nigeria)

Mobile data is expensive and 3G/4G is patchy, so:
- Post images go through `next/image` with responsive sizes. Uploads are compressed client-side (max ~1600px, WebP/JPEG ~0.8) before sending.
- No autoplay video. Media loads lazily below the fold.
- Heavy libraries (maplibre, emoji picker, reactions selector) are loaded only when opened.
- Feed pages stay at 10 posts. Skeletons show instead of spinners.
- Targets are measured in Phase 9: Home is usable in under 4s on "Slow 4G" in Lighthouse.

## Link previews

`generateMetadata` on `/p/[id]`, `/for-sale/[id]`, `/events/[id]` and `/neighbourhood/[slug]` returns title, description and an image. Later, an `opengraph-image.tsx` route renders a branded card (post snippet + neighbourhood + logo), the equivalent of Nextdoor's `/link_preview_image/`. This needs the post fetched on the server, so it depends on a public `GET /posts/:id` that honours visibility.
