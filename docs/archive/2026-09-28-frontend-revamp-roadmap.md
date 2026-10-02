# Frontend Revamp — Roadmap

Each phase ships on its own PR, keeps the app working, and ends with the checks listed. It's frontend-first: where the API is missing, we use honest preview/mock data with the same shape the API will return. Backend work is listed as a **dependency**, and phases never block on it.

Related docs: `frontend-current-state.md`, `nextdoor-research.md`, `frontend-information-architecture.md`, `frontend-target-architecture.md`.

## Status: 2026-09-28

**Decisions made:**
- Keep the existing brand identity (teal `#147C73`, coral, mascot). Tokens were extended with success/warning/info/canvas.
- Groups ship as a preview for the product owner to review.
- URLs mirror Nextdoor (`/news-feed`, `/p/[id]` …).
- Chat is in-app, not WhatsApp.
- Build contract-first: planned endpoints run on typed mocks. The backend spec is `docs/api-contract.md`.

**Built** (branch `refactoring`):
- Phases 1–5 in first pass: foundations, routes and shell, Home feed + post page, Alerts / Events / For Sale & Free / Groups, notifications, profiles.
- In-app chat flow (listing → "Message seller" → thread).
- Unit tests (Vitest, 19).

**Checks:** type-check, lint, `next build` and the redirect table all pass.

**Second pass (after the review in the browser):**
- Full logo on mobile.
- Toasts: close button, 4 s, placed away from the header.
- Signed-in `/` redirects to the feed.
- Network resilience: cached feed, offline banner, stale notice, typed errors, 15 s timeouts, retry for reads.
- Emoji picker rework, also added to comments and chat.
- Polls.
- Settings rebuilt (Profile, Account, Neighbourhood, Notifications, Privacy & blocking, Feedback, Deactivate).
- Blocking.
- Tests: 26.

**Third pass:**
- Landing page, About, How it works (with a Safety section) and Photo credits rebuilt: a real-proportion iPhone 18 Pro mockup showing the actual app with Lagos content, no photo captions (attribution moved to `/credits`), and content visible without scroll animations.
- Community Guidelines and Privacy Policy rewritten for Nigeria (NDPA 2023, the real services the app uses). A new Terms of Use page. **All legal text needs lawyer review before launch.**
- Onboarding (Phase 6) restructured into components with the verification logic unchanged: split layout with a privacy explainer, "Use my current location" first, a success screen naming the neighbourhood, and an outside-coverage screen listing where we're live.

**Still open:**
- Visual QA pass in the browser (needs a signed-in session).
- Phase 6: onboarding refactor.
- Phases 7–10.
- Playwright e2e.
- Restyling the admin pages and auth screens with the new tokens.

---

## Phase 0 — Audit & research ✅
Current-state audit, Nextdoor research, IA, target architecture, this roadmap.

## Phase 1 — Foundations
- **Objectives**: new design tokens; `lib/api/client.ts` with `ApiError`; `lib/routes.ts` (routes, nav config, `PUBLIC_PATHS`); Vitest + RTL + Playwright; add shadcn `dialog`, `sheet`, `tabs`, `tooltip` to `@myhoodora/ui`.
- **Files**: `globals.css`, `packages/ui/src/*`, `lib/firebase/{auth,posts}.ts` → `lib/api/*`, `package.json`.
- **Risks**: token swap touches every screen. Apply it to the app shell/feed first; marketing pages follow in Phase 8.
- **Tests**: `apiFetch` unit tests; Playwright smoke (login renders).
- **Done when**: no behaviour change; types, lint and tests pass.

## Phase 2 — Routes, shell & navigation (Nextdoor structure)
- **Objectives**:
  - Move `app/dashboard/*` → `app/(app)/*` with flat routes: `/news-feed`, `/alerts`, `/events`, `/for-sale`, `/groups`, `/notifications`, `/settings/*`, `/help`.
  - Redirects from every old `/dashboard/...` URL. `proxy.ts` becomes default-deny with a `PUBLIC_PATHS` allowlist and handles `/dashboard?post=:id` → `/p/:id`.
  - New shell:
    - left nav (Home · For Sale & Free · Alerts · Events · Groups · **Post** · Settings · Help centre)
    - header (search placeholder, bell, avatar menu)
    - right rail (neighbourhood card, upcoming events)
    - mobile bottom tab bar (Home · For Sale · Post · Alerts · More) + More sheet
  - Post-login redirect and `safe-redirect.ts` default → `/news-feed`.
- **Depends on**: Phase 1.
- **Risks**: missed redirect = broken shared links; proxy allowlist mistakes. Mitigated by a redirect test table.
- **Tests**: every old URL → new URL; unauthenticated access to each app route → `/login?next=…`; nav active states; keyboard through nav; tab bar at 375px.
- **Done when**: no user-visible "dashboard" anywhere; all old links resolve.

## Phase 3 — Home feed + single post page
- **Objectives**:
  - Split `dashboard/page.tsx` into `features/feed`.
  - FeedProvider gains `error`, `refetch`, `getPost(id)`; de-dupe on load more; real ErrorState.
  - Composer: "What's happening, neighbour?" → category picker (General · Ask for a recommendation · Sell or give away · Alert · Event · Lost & found · Thank a neighbour) via `categories.ts`. The dialog and mobile sheet share the same form.
  - Filter chips (All · Alerts · Events · For sale · Recommendations · General) on `?filter`.
  - Post card: neighbourhood name, "see more" truncation, `•••` menu (Copy link, Report → coming soon, Delete own).
  - Nextdoor-style reactions: Like · Helpful · Agree · Haha · Wow · Sad (no Angry).
  - **`/p/[id]` post page**: full post, comments placeholder, "More from your neighbourhood". Share now copies `/p/[id]`.
  - Critical-alert banner (red, alert < 2h old) and pinned amber alert card.
  - Kindness reminder before posting.
- **Keep**: alert pinning, optimistic like/delete, gating via `runGatedAction`, event encoding, native share.
- **Remove**: rainbow type badges; `?post=` highlight logic (replaced by the redirect + post page).
- **Backend (parallel)**: `GET /posts/:id`, user lookup for author names, `category` field, cursor pagination, reaction type.
- **Tests**:
  - RTL: PostCard (own vs other, see more), composer validation per category, filter chips, reaction picker keyboard access.
  - Playwright: create → appears → open `/p/id` → delete; API failure → ErrorState.
- **Done when**: every page file is < 100 lines; the regression list passes.

## Phase 4 — Alerts, Events, For Sale & Free, Groups
- **Alerts**: real alert posts; category chips Security · Power · Water · Flooding · Traffic · Fire · Scam (visual until the `category` field exists); **neighbourhood map** with maplibre (already a dependency) centred on the user's neighbourhood; empty state "No alerts in your neighbourhood".
- **Events**: Upcoming / Past from real event posts sorted by decoded date; `/events/[id]` uses post data with a date/location header; RSVP button → coming soon.
- **For Sale & Free**: grid + category chips + Free filter; `/for-sale/[id]` detail with ₦ price / Free / Negotiable, seller, safety tip ("meet at the estate gate"), optional "Chat on WhatsApp"; "Sell or give away" posts from the feed also appear here.
- **Groups**: Your groups / Discover; Join vs Request (open vs private); Safety Watch group moves here; `/g/[id]` preview.
- **Backend**: alert category + coordinates, event fields + RSVP, listings API, groups API.
- **Tests**: filter/sort units; VerifiedGate still blocks unverified users on all four.

## Phase 5 — Notifications & profiles
- `/notifications` with chips All · Alerts · My activity, grouped Today / Last 7 days; bell dropdown shows latest 5 + "See all".
- `/profile/[uid]`: own profile real (name, photo, neighbourhood, neighbour since, posts); other neighbours once the API can look them up.
- `/settings/notifications` (per-category immediate / digest / off, preview), `/settings/privacy` (preview), `/settings/neighbourhood` (real verification status + re-verify).
- **Backend**: notifications API, public profile endpoint, preferences.

## Phase 6 — Forms & onboarding
- react-hook-form + zod everywhere; onboarding split into step components; labelled inputs; inline errors.
- Verification sheet lists the Nigerian options: GPS (real) · phone OTP · estate code · neighbour invite (preview).
- **Risk**: the onboarding verification sequence is timing-sensitive. Refactor structure only, not behaviour.

## Phase 7 — Public surfaces & link previews
- `generateMetadata` for `/p/[id]`, `/for-sale/[id]`, `/events/[id]`; branded `opengraph-image` cards.
- Logged-out `/p/[id]` preview for "Anyone" posts ("Join your neighbours to reply").
- `/neighbourhood/[slug]` public pages: about, recent public posts, safety updates, for sale, events, nearby neighbourhoods, join CTA. These are built from the seeded neighbourhoods.
- **Backend**: public post read honouring visibility, visibility field, neighbourhood slugs.

## Phase 8 — Responsive pass + marketing/auth restyle
Every page at 375 / 768 / 1024 / 1440. New tokens applied to landing, about, auth and legal.

## Phase 9 — Accessibility, dark mode, performance
- axe clean on key pages; focus order; reduced motion; dark tokens.
- Low-data work: client-side image compression, `next/image`, lazy-load maplibre, the emoji picker and the reactions selector. Lighthouse "Slow 4G" target on Home.

## Phase 10 — Final QA
Full regression list; Chrome, Safari iOS, Chrome Android; throttled network run.

## Later (post-launch, once real content exists)
**Faves**: trusted artisans & services, recommended by verified neighbours. **Business/artisan pages** (`/pages/[slug]`). **Agencies** (`/agency/[slug]`: LGA, police division, SEMA, DisCo, estate management). **Local News** (`/local-news`). **Neighbours directory**. **In-app chat** (`/inbox`). **Polls**. **Search**. Feed sort modes (For you / Nearby / Trending).

---

## Regression checklist (must keep working through every phase)
- Login / register / Google sign-in / logout; guest-only redirects; `?next=` return after login (now to new routes)
- Onboarding + skip + gating modal re-prompt
- Create text / event / alert / photo post; photo upload timeout message; image URL paste
- React (optimistic + rollback), delete own post with confirmation, share / copy link
- Old `/dashboard?post=<id>` links → `/p/<id>`; all old `/dashboard/*` URLs redirect
- Alert pinning; bell "new safety alert" and mark-seen
- Verification banner; VerifiedGate on gated pages
- Settings → account display-name update; neighbourhood name
- Admin pages load for admins only

## Open decisions for the product owner
1. **Visual identity**: keep the mascot + coral and move to the deeper green-teal + warm neutral system proposed in the architecture doc? Or do you want a new brand direction?
2. **Groups at launch**: ship as a preview page, or hold until the backend exists?
3. **Home URL**: `/news-feed` (proposed, mirrors Nextdoor) or `/home`?
4. **"Chat on WhatsApp" on listings**: acceptable as an opt-in interim instead of in-app chat?
