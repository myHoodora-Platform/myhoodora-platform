# Admin — Current State Audit

> Audited 29 Sep 2026 on branch `refactoring`. This file describes only what exists in the code today. Proposals live in [ADMIN_TARGET_ARCHITECTURE.md](./ADMIN_TARGET_ARCHITECTURE.md).

## Summary

The admin is a **five-page prototype**. It looks tidy, but it isn't an operations tool yet:

| Area | Finding | Severity |
| --- | --- | --- |
| **Authorisation** | The API has **no role checks**. `POST /neighborhoods` and `DELETE /neighborhoods/:id` work for *any* signed-in user. The only admin gate is a client-side `profile.role === "admin"` redirect. | 🔴 Critical |
| **Data** | Users, support queries, notifications and activity are hard-coded mocks in React state. Every action is lost on reload, and nothing reaches a backend. | 🔴 High |
| **Mock mode** | Neighbourhoods call the real API even when `NEXT_PUBLIC_USE_MOCKS=true` (`fetchNeighborhoods` has no mock branch), so the page errors in the demo build. The error only goes to the console. | 🟠 High |
| **Moderation** | None. Neighbours can already report posts, comments, listings, messages and people (`lib/api/reports.ts` → mock store key `reports`), but no admin screen reads them. | 🔴 High |
| **Coverage** | There's no admin for posts, alerts, listings, groups, business applications, contact messages, AI-pilot or talent sign-ups, even though the web app creates all of these. | 🟠 High |
| **Roles** | The DB has `member \| admin \| moderator`, but moderators can't enter the admin, and admins have no permission tiers. | 🟠 Medium |
| **UX** | Details open in side panels or inline expanders with no deep links (except `?uid=`). There's no pagination, no sorting, and inconsistent filters. Styling uses hard-coded `slate-*` colours instead of the app's design tokens. | 🟡 Medium |

## A. Route map

| Route | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `/admin` | Overview: 5 stat tiles, verification breakdown, "recent activity", neighbourhood chips | Existing | Metrics mix mock (users, queries) with real (neighbourhoods). No "needs attention". |
| `/admin/users` | User list with search and status chips; checkbox bulk verify/restrict; side panel detail (verify-into-neighbourhood, restrict/unrestrict) | Existing | Mock data (`MOCK_USERS`, 16 rows). Deep link via `?uid=`. No pagination or sort. No detail page. |
| `/admin/neighborhoods` | Create neighbourhood (name, city, country, lat/lng, radius, "check nearby" overlap); list with search and delete | Existing | **Only page on real APIs**. The delete confirm has no impact information (members, posts). |
| `/admin/queries` | Support queries: search, grouped by status, expandable card, canned replies, move open → in progress → resolved | Existing | Mock (`MOCK_QUERIES`). There's no endpoint for users to submit these; the new `/contact` form writes to a separate store. |
| `/admin/notifications` | Compose a broadcast to all users, one user or one neighbourhood, with a reach estimate and sent history | Existing | Mock. The label "Notifications" is confused with the admin's own notifications. |

The web proxy (`src/proxy.ts`) is default-deny, so `/admin/*` requires a session cookie, but it doesn't check the role. The app's user menu shows an **Admin** link when `profile.role === "admin"` (`components/layout/app-shell/user-menu.tsx:75`).

## B. Pages in detail

### `/admin` Overview (`app/admin/page.tsx`)
- **Components:** `StatTile` ×5, `VerificationBreakdown`, activity list, neighbourhood chip grid.
- **Data:** `useAdminData()`: `users`, `queries`, `notifications` and `activity` are mocks; `neighborhoods` is real.
- **Actions:** none. The tiles aren't links.
- **Problems:**
  - It's a page of counts, and nothing tells the admin *what needs doing*.
  - "Notifications sent" isn't a useful operational metric.
  - The activity list only records this browser session's own actions.
  - "Showing 9 of N seeded neighbourhoods" leaks dev wording.
- **Missing states:** errors (a failed neighbourhood fetch shows an empty grid) and an empty activity list.

### `/admin/users` (`app/admin/users/page.tsx`, 422 lines)
- **Components:** search input, status chips (All / Verified / Unverified / Restricted), checkbox list, detail side panel, `ConfirmOverlay`, `Select` for neighbourhood.
- **Data:** `MOCK_USERS` via context. Verifying assigns `neighborhoodName`; restrict sets `verificationStatus: "banned"`.
- **Problems:**
  - "Restricted" is stored as verification status `banned`, which mixes two concepts: *is this person really local?* and *are they allowed to post?*.
  - Unrestricting sets the user back to `unverified`, silently losing their verified status.
  - There's no reason field on restrict and no audit trail.
  - There's no activity, posts or reports context for a user.
  - A list plus side panel doesn't work on mobile (the panel stacks under a long list).
- **Missing states:** a load error. Empty is handled ("No users match your search.").

### `/admin/neighborhoods` (`app/admin/neighborhoods/page.tsx`, 385 lines)
- **Components:** create form (left), searchable list with delete (right), `ConfirmOverlay`.
- **Data:** `fetchNeighborhoods`, `createNeighborhood`, `deleteNeighborhood` and `fetchNearbyNeighborhoods` in `lib/firebase/auth.ts`, which is the wrong layer (these aren't auth).
- **Problems:**
  - Neighbourhoods have no detail view, members, activity or health.
  - Delete is permanent and doesn't say what happens to members and posts.
  - The create form expects raw lat/lng with no map.
  - The product calls these **Hoods**, but the admin says "Neighbourhoods".

### `/admin/queries` (`app/admin/queries/page.tsx`)
- **Components:** search, status groups, `QueryCard` (expand, canned replies, respond, move status).
- **Problems:**
  - Replies go nowhere; there's no channel back to the user.
  - It isn't connected to `/contact` messages (store key `contact-messages`) or in-app feedback (`feedback`).

### `/admin/notifications` (`app/admin/notifications/page.tsx`)
- **Components:** audience chips, target selects, reach estimate, compose form, history list.
- **Problems:**
  - Sending to "All users" has no confirmation.
  - The reach estimate is based on 16 mock users.
  - There's no scheduling and no preview of how it appears on a phone.

## C. Navigation

`components/admin/admin-navigation.ts`:

```text
Overview
  └ Overview           /admin
Management
  ├ Users              /admin/users
  ├ Neighbourhoods     /admin/neighborhoods
  ├ Queries            /admin/queries
  └ Notifications      /admin/notifications
Footer: Back to myHoodora · Log out
```

- **Confusing labels:** "Queries" reads like database queries (they're support tickets). "Notifications" reads like the admin's own alerts (they're broadcasts). "Neighbourhoods" should be **Hoods**.
- **Poor grouping:** "Management" is a catch-all.
- **Missing sections:** moderation / reports (the most important job), content, marketplace, businesses, settings / team.
- **Header:** page title only. There are no breadcrumbs, and there's no global search.

## D. Data flow

```text
app/admin/*/page.tsx ("use client")
   ↓ useAdminData()
context/AdminDataContext.tsx      ← one context for every entity
   ├─ useState(MOCK_USERS | MOCK_QUERIES | MOCK_NOTIFICATIONS | MOCK_ACTIVITY)   (in-memory, lost on reload)
   └─ lib/firebase/auth.ts → fetch(API_BASE_URL/neighborhoods…)                  (real API, no mock branch)
         ↓
      apps/api  NeighborhoodsController  (no role guard)
```

**Inconsistencies against the rest of the app:**
- **Different data pattern:** the rest of the app uses `lib/api/*` services with `isLive(key)` switching plus the persistent mock store (`lib/api/mock/store.ts`), `ApiError` kinds and retry. The admin uses none of it.
- **No real loading or errors:** one context loads everything up front, and there are no per-page loading/error states or `ProblemState` usage.
- **No shared admin types:** the admin types (`MockUser`, …) are separate from `lib/api/types.ts`.

## E. Permissions

| Layer | What exists |
| --- | --- |
| DB (`users.schema.ts`) | `role: "member" \| "admin" \| "moderator"` (default `member`); `verificationStatus: "verified" \| "unverified" \| "banned"`; `isActive: boolean` |
| API | Global Firebase auth guard only. **No role guard or `@Roles()` decorator.** `users.service.ts` strips `role` / `verificationStatus` from self-updates, which is good. |
| Web | `AdminShell` redirects unless `role === "admin"`. Moderators are redirected out. |

There's no super-admin concept, no per-permission model and no audit log.

## F. Components

| Component | Notes |
| --- | --- |
| `admin-shell.tsx` | Guard + layout. Works; keep it and extend it to moderators. |
| `admin-sidebar.tsx` | Collapsible (shared `@myhoodora/ui/sidebar`). Keep; reorganise groups. |
| `admin-header.tsx` | Title + mobile menu trigger. Add breadcrumbs. |
| `stat-tile.tsx` | Simple metric tile. Keep it for insights; the Overview needs actionable tiles. |
| `verification-breakdown.tsx` | Bar breakdown. Moves to Insights. |
| `shared/confirm-overlay.tsx` | Reused. Needs a *reason* field and consequence text for moderation actions. |

## G. Data the web app already produces that the admin should operate on

| Source (mock store key / endpoint) | Created by |
| --- | --- |
| `reports` | Report menu on posts, comments, listings, messages, profiles |
| posts (`GET /posts/neighborhood/:id` live), incl. alerts, events, polls | Composer |
| `comments` | Post detail |
| listings | For Sale & Free |
| `groups`, `group-members`, `group-requests` | Groups |
| `business-applications` | `/business/get-started` |
| `contact-messages` | `/contact` |
| `feedback` | Settings → Feedback |
| `ai-pilot-requests` | `/ai` |
| `talent-network` | `/careers` |
