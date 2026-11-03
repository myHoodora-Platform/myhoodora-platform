# Admin — Changelog

## Phase 0 · Audit & architecture — 29 Sep 2026

- Added `ADMIN_CURRENT_STATE.md`: route map, page-by-page audit, navigation, data flow, permissions, and the data the app already produces for admins.
- Added `ADMIN_TARGET_ARCHITECTURE.md`: research (Nextdoor moderation model plus admin UX patterns), information architecture, page map, flows, data flow, components, UI system, permissions, QA strategy and a 10-phase plan.
- Added **API contract §13 "Admin API"** in `docs/api-contract.md`: every `/admin/*` endpoint and shape, plus a flagged critical fix (unguarded `POST`/`DELETE /neighborhoods`).
- Decisions confirmed: moderators get reduced access, Hood Leads go to the backlog, account status splits into two fields, Hoods are archived instead of deleted.

## Phases 1–10 · Admin operations platform — 29 Sep 2026

### Foundations
- **Services:** `lib/api/admin/*` contains typed services for every endpoint in contract §13 (`session`, `moderation`, `community`, `content`, `businesses`, `support`, `platform`). Each area has its own `admin.*` key in `ENDPOINTS`, so each can go live on its own.
- **Mock database:** `lib/api/admin/mock-db.ts` reads the **same store the app writes to**:
  - reports filed on the feed
  - posts, comments, listings and groups
  - `/contact` messages and feedback
  - business applications, AI-pilot and talent sign-ups
- **Shared removals:** `lib/api/mock/moderation-state.ts`. Removing content in the admin now hides it in the app's feed, comments, For Sale and Groups.
- **Retired:** `AdminDataContext`, the old hard-coded mock users/queries/notifications, `stat-tile`, `verification-breakdown`, and the unused neighbourhood admin helpers in `lib/firebase/auth.ts`.

### Access & layout
- **Session:** `features/admin/session.tsx` loads roles and capabilities from `GET /admin/me`.
  - Moderators can now enter, with reduced capabilities.
  - Admin-only navigation and actions are hidden.
  - A direct link to a forbidden page shows an "Unauthorised" state. The API still enforces every call.
- **Preview mode:** in mock mode, anyone can preview the admin with a clearly labelled "Preview data · viewing as Admin/Moderator" switch.
- **Navigation:** new IA (Overview · Moderation · Community · Content · Businesses · Support · Insights · Settings) with red work-count badges.
- **Shared kit (`components/admin/`):** `AdminPageHeader` (breadcrumbs), `AdminToolbar`/`SearchBox`/`FilterSelect`/`StatusTabs` (state lives in the URL), `DataTable` (cards on phones, row menus, selection, pager), `StatusBadge` (one status → one word → one colour), `DetailLayout`/`Panel`, `Timeline`, `ActionDialog` (consequence + required reason + staff note), `AdminProblem`/`Unauthorized`/`NotFound`.
- **Old routes** redirect permanently:
  - `/admin/users` (incl. `?uid=`) → `/admin/neighbours`
  - `/admin/neighborhoods` → `/admin/hoods`
  - `/admin/queries` → `/admin/inbox`
  - `/admin/notifications` → `/admin/broadcasts`

### Pages
| Area | Routes |
| --- | --- |
| Overview | `/admin`: needs-attention tiles → filtered queues, 7-day pulse, top of queue, recent staff actions |
| Moderation | `/admin/moderation` (severity → age), `/admin/moderation/reports/[id]` (content in context, reasons and reporters, author history, Hood, related reports; claim/release; keep · remove · warn · restrict · suspend · escalate; auto-opens the next report), `/admin/moderation/history` |
| Community | `/admin/hoods`, `/admin/hoods/new` (map + radius + overlap check), `/admin/hoods/[id]` (health, 14-day growth, members/posts/reports, boundary map, edit · pause · archive), `/admin/neighbours` (bulk verify/restrict), `/admin/neighbours/[uid]`, `/admin/verification` (nearest Hoods by distance) |
| Content | `/admin/posts`, `/admin/posts/[id]` (post as the feed shows it; remove/restore post and single comments), `/admin/alerts` (end · downgrade urgent · remove), `/admin/groups`, `/admin/marketplace` |
| Businesses | `/admin/businesses` (Applications · Verified · Reported · Rejected), `/admin/businesses/[id]` (phone/CAC checks; approve · ask for info · reject · suspend) |
| Support | `/admin/inbox`, `/admin/inbox/[id]` (saved replies, reply / reply & resolve, status, priority, assign), `/admin/broadcasts` (Hoods or everyone, live reach, phone preview, confirm) |
| Insights | `/admin/insights` |
| Settings | `/admin/settings/team` (roles, what each role can do, add staff), `/admin/settings/platform` (report reasons: severity + staff-only; alert windows; coverage; website sign-ups) |

### QA
- **Checks:** `pnpm check-types` ✅, `pnpm lint` ✅, `pnpm test` ✅ 54/54 (11 new admin tests: capabilities, report grouping and order, claim conflicts, removal → hidden, suspend is admin-only, verify flow, split account status, Hood overlap and archive, business approval), production build ✅.
- **Browser:** every sidebar page, report → remove → next report, Hood map, moderator preview (admin areas hidden, forbidden page), 400px mobile, old-route redirect, no console errors.

### Still to do
- **Backend:** implement contract §13 with `RolesGuard`. **Fix now:** `POST`/`DELETE /neighborhoods` have no role check.
- **Hood Leads** volunteer voting, **appeals**, and an `owner` role (backlog in the target doc).
- **Detail pages** for groups and listings (they're list plus actions today).
- Editable alert windows, and kindness-reminder telemetry, both marked "planned" in the UI.
