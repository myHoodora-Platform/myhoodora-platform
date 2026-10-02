# Admin — Target Architecture

> **Status: agreed 29 Sep 2026; implementation in progress.** Read with [ADMIN_CURRENT_STATE.md](./ADMIN_CURRENT_STATE.md). API shapes are in [`docs/api-contract.md` §13](../api-contract.md#13-admin-api-).

**Principle:** this is an **operations platform for myHoodora**, not a template dashboard. Every screen answers:
- *Where am I?*
- *What needs my attention?*
- *What can I do?*
- *What happens if I do it?*
- *Where next?*

---

## 1. Research: patterns worth borrowing

In the table below, ✅ marks sources read during this audit; ◻︎ marks well-established industry patterns that weren't re-verified in this session.

| Observed pattern | Why it works | How it applies to myHoodora |
| --- | --- | --- |
| ✅ **Layered moderation at Nextdoor:** neighbour reports + automated detection + volunteer Leads/Community Reviewers who *vote* (Keep / Maybe remove / Remove; no single person removes content) + staff Operations for high-risk categories. | Local people judge local context; staff handle what volunteers shouldn't. | Staff review queue now; model a **volunteer Hood Leads** vote as a later phase. **Route by risk:** misinformation, discrimination, threats and *all account reports* go to staff only (as Nextdoor does). |
| ✅ **Median removal time** reported publicly (Nextdoor: under 7 hours in 2025; under 1% of content reported hurtful). | Time-to-action is the metric that matters for community safety. | Overview shows **oldest open report age** and **median time to resolve**, not vanity totals. |
| ✅ **Kindness Reminders:** intervene *before* posting. | It prevents reports instead of just processing them. | We already have a client-side kindness check. Admin **Insights** shows how often it fires; Platform settings tune it later. |
| ✅ **Appeals**, including reporter appeals. | Fairness and trust; mistakes get corrected. | The report lifecycle includes an `appealed` path (phase 2). Every action records a reason that can be shown to the author. |
| ✅ **Prioritised queues, not FIFO:** order by severity, reach and recency; blur graphic media by default. | A spam comment shouldn't wait ahead of a credible threat. | Queue sort = **severity → age**. Urgent alerts and threats come first. Media is blurred until clicked. |
| ◻︎ **Index table → detail page** (Shopify Polaris, Stripe): a row click opens a full page; bulk actions appear only on selection; secondary actions sit in an overflow menu. | Tables stay scannable and complex work gets room. | Every entity gets `list` + `[id]` routes with deep links. Row = link; the `⋯` menu holds secondary actions. |
| ◻︎ **Detail page with a timeline** (Stripe, Zendesk): the entity summary sits on the left, and a chronological history of events and admin actions sits on the right. | Context in one place; "what already happened?" answered instantly. | User, Hood, Post and Report details all show an **activity & actions timeline**. |
| ◻︎ **Triage inbox** (Linear, Front): one queue, keyboard-friendly, with *claim / assign* so two moderators don't action the same item. | It avoids duplicated effort and makes ownership visible. | Reports have `assignee` + "Claim". An "Under review by Ngozi" chip shows on the card. |
| ◻︎ **Mod log** (Reddit/Discord): an immutable list of who did what, when and why. | Accountability, and easy handover between moderators. | **Moderation history** page plus a per-entity timeline, backed by `audit_events`. |
| ◻︎ **Consistent filter bar:** search + a few typed filters + an active-filter summary, with state in the URL. | Muscle memory across pages; shareable links. | One `AdminToolbar` component with URL query params on every list. |

**Sources:** [Nextdoor: How moderation works](https://blog.nextdoor.com/2021/02/10/how-moderation-works-on-nextdoor) · [Nextdoor 2025 Transparency Report](https://about.nextdoor.com/press-releases/nextdoor-publishes-2025-transparency-report) · [Nextdoor Moderator Academy: Voting & Appeals](https://www.nextdoorneighborhoodteams.com/public/resources/moderator-academy-voting-appeals) · [Codelit: moderation system design](https://codelit.io/blog/content-moderation-system-design) · earlier product research in [`nextdoor-research.md`](../nextdoor-research.md).

---

## 2. The real admin jobs → where they live

| Job | Question | Home |
| --- | --- | --- |
| Moderation | What needs a decision *now*? Who reported it, and what's the context? | Overview → **Moderation queue** → Report detail |
| Community | Which Hoods are growing or struggling? Who is stuck in verification? | **Hoods**, **Verification**, **Neighbours** |
| Content | What's being posted? Which urgent alerts are live? What's flagged? | **Posts**, **Safety alerts**, **Groups**, **Marketplace** |
| Businesses | Who's applying? Who is verified? Any complaints? | **Businesses** (applications → pages) |
| Support | Who is waiting for a reply? | **Inbox** |
| Platform | Is it healthy and growing? | **Insights** |
| Team | Who can do what? | **Settings → Team & roles** |

---

## 3. Information architecture

This is adapted to the actual product. Removed from the brief's starter list: *Media* (there's no media library; media is reviewed in context), *Comments* as a separate page (reviewed inside post detail and reports), *Analytics* as a separate area (renamed **Insights**), and *Categories* (fixed enum, lives in settings).

```text
Admin
├── Overview                        what needs attention + platform pulse
│
├── Moderation
│   ├── Queue                       open & under-review reports, severity-sorted
│   └── History                     every moderation action (audit log)
│
├── Community
│   ├── Hoods                       list · detail
│   ├── Neighbours                  list · detail            (was "Users")
│   └── Verification                people stuck or flagged in address verification
│
├── Content
│   ├── Posts                       all posts incl. events, polls, recommendations
│   ├── Safety alerts               live urgent/active alerts, misuse
│   ├── Groups                      groups, reported groups
│   └── Marketplace                 For Sale & Free listings
│
├── Businesses
│   └── Businesses                  tabs: Applications · Verified · Reported
│
├── Support
│   ├── Inbox                       support queries + /contact + feedback
│   └── Broadcasts                  platform announcements   (was "Notifications")
│
├── Insights                        growth by Hood, activity, moderation SLAs
│
└── Settings                        (admins only)
    ├── Team & roles
    └── Platform                    report reasons, alert windows, coverage, sign-ups (AI pilot, talent)
```

**Sidebar labels are nouns people use:** "Hoods", "Neighbours", "Queue", "Inbox". A red count badge on **Queue**, **Verification**, **Businesses** and **Inbox** shows open work.

---

## 4. Page map

Routes follow the app's Next.js App Router conventions under `app/admin/`. ★ = new.

| Route | Purpose | Key content | Primary actions |
| --- | --- | --- | --- |
| `/admin` | Overview | **Needs attention** (open reports by severity, oldest age; pending verifications; business applications; unanswered inbox; live urgent alerts) · **Pulse** (7-day new neighbours, posts, active Hoods) · **Recent moderation** | Each tile links to its filtered queue |
| ★ `/admin/moderation` | Report queue | Tabs: Open · Under review · Resolved · Dismissed. Filters: type, reason, Hood, severity | Claim, open |
| ★ `/admin/moderation/reports/[id]` | Report detail | Content in context (rendered like the feed), reason(s) + reporter count, author card with prior strikes, Hood, related reports, timeline | Keep · Remove content · Warn author · Restrict author · Escalate · Dismiss (all with a reason) |
| ★ `/admin/moderation/history` | Audit log | Who, what, target, reason, when | Filter by moderator, action, date |
| ★ `/admin/hoods` | Hoods list | Name, city, members, verified %, posts (7d), open reports, status | New Hood, open |
| ★ `/admin/hoods/new` | Create Hood | Map pin + radius preview, overlap check (reuses the existing nearby check) | Create |
| ★ `/admin/hoods/[id]` | Hood detail | Tabs: Overview (health, growth chart) · Members · Posts · Reports · Settings (name, radius, status) | Edit, pause, archive (not hard delete) |
| `/admin/users` → ★ `/admin/neighbours` | Neighbours list | Name, Hood, verification, account status, joined, last active, reports | Open; ⋯ Verify / Restrict |
| ★ `/admin/neighbours/[id]` | Neighbour detail | Tabs: Overview · Activity · Posts · Reports (by and against) · Verification · Admin actions | Verify, change Hood, warn, restrict, suspend, reinstate |
| ★ `/admin/verification` | Verification queue | Failed/outside-coverage checks, pending manual review, flagged duplicates | Approve into Hood, reject with reason |
| ★ `/admin/posts` | Posts | Search, category, Hood, author, date, status, report count | Open |
| ★ `/admin/posts/[id]` | Post detail | Post rendered as in the feed, comments (with per-comment actions), reactions, reports, timeline | Remove / restore post or comment |
| ★ `/admin/alerts` | Safety alerts | Live urgent/active alerts by Hood, resolved/ended history | End alert, downgrade urgent → active, remove |
| ★ `/admin/groups` · `/[id]` | Groups | Members, privacy, admins, reports | Archive, transfer ownership |
| ★ `/admin/marketplace` · `/[id]` | Listings | Tabs: Active · Reported · Removed | Remove, restore |
| ★ `/admin/businesses` · `/[id]` | Businesses | Tabs: Applications · Verified · Reported. Detail: application, CAC, phone check, areas served | Approve, request info, reject, suspend page |
| `/admin/queries` → ★ `/admin/inbox` | Support inbox | Tabs: Open · Waiting · Resolved. Source: in-app, contact form, feedback | Reply, assign, resolve |
| `/admin/notifications` → ★ `/admin/broadcasts` | Broadcasts | History + compose (audience, preview on phone, confirm-to-all) | Send |
| ★ `/admin/insights` | Insights | Growth by Hood, verification funnel, moderation SLAs, kindness-check hits | Date range |
| ★ `/admin/settings/team` | Team & roles | Staff with role, last active; invite | Change role, remove |
| ★ `/admin/settings/platform` | Platform | Report reasons, alert windows, coverage cities, waitlists (AI pilot, talent) | Save |

**Redirects:** the old routes (`/admin/users`, `/admin/neighborhoods`, `/admin/queries`, `/admin/notifications`) redirect permanently, so bookmarks keep working.

---

## 5. Key flows

### Moderation (primary flow)
```text
Overview "3 reports need review"  or  Queue (severity → age)
  ↓ open report (auto-claims; others see "Under review by …")
Report detail
  ├ Reported content, rendered as neighbours saw it (media blurred)
  ├ Why: reasons + number of reporters (reporters stay anonymous to the author)
  ├ Author: role, Hood, joined, prior warnings/removals  → link to Neighbour detail
  ├ Hood + related open reports on the same content/author
  └ Timeline: reported → claimed → …
  ↓ choose action
Confirm dialog: consequence in plain words + reason (required, preset list + note)
  ↓
Result: report → Resolved (action) or Dismissed (no violation); author notified (template);
        audit event written; next report opens (“Next in queue”)
  ↓
Moderation history
```

**Report states:** `open → under_review → resolved | dismissed`, with `escalated` (to admin) and `appealed` (phase 2).

**Actions:** `keep` (dismiss), `remove_content`, `warn_author`, `restrict_author` (read-only for N days), `suspend_author` (admin only), `escalate`.

### Neighbour
```text
Neighbours list (search/filter) → Neighbour detail
  → Activity & posts & reports (by / against) → decide
  → Admin action (verify · change Hood · warn · restrict · suspend · reinstate) with reason
  → Timeline + audit log updated
```

### Verification
```text
Verification queue (failed or outside coverage, sorted by wait time)
  → Detail: submitted address, pin vs nearest Hoods (map), attempts
  → Approve into Hood | Reject (reason → neighbour sees guidance) | Ask for more info
```

### Business application
```text
Businesses → Applications → Application detail (details, CAC, phone OTP status, areas)
  → Approve (creates page, emails claim link) | Request info | Reject (reason)
```

---

## 6. Data flow (target)

This matches the pattern the rest of the web app already uses.

```text
app/admin/<area>/page.tsx            thin: route params → feature component
  ↓
features/admin/<area>/*.tsx          screens: list, detail, dialogs
  ↓
features/admin/<area>/use-*.ts       data hooks: loading / error / refetch, URL-state filters
  ↓
lib/api/admin/<area>.ts              isLive("admin.<area>") ? apiFetch(user, "/admin/…") : mock store
  ↓
apps/api  /admin/*  (RolesGuard)     ← backend is the source of truth for permissions
```

- **No global mega-context:** `AdminDataContext` is retired. Each area loads its own data with proper loading, error and empty states (`ProblemState`, `EmptyState`).
- **Mock mode:** it seeds realistic Nigerian data *derived from the same store the app writes to*. So a report filed on the feed shows up in the admin queue, and removing it in the admin hides it in the feed.
- **Errors:** `403` → "You don't have access to this", `404` → not-found page, network → retry.

## 7. Component architecture

```text
components/admin/
  admin-shell, admin-sidebar, admin-header        (existing, extended: breadcrumbs, badges)
  page-header.tsx        title · description · breadcrumbs · primary action
  admin-toolbar.tsx      search + filters + result count, URL-synced
  data-table.tsx         desktop table ↔ mobile cards, sort, select, pagination, row menu
  bulk-bar.tsx           appears on selection
  status-badge.tsx       one map for every status (below)
  detail-layout.tsx      main column + side column; stacks on mobile
  timeline.tsx           activity & audit events
  action-dialog.tsx      consequence text + reason select + note; destructive styling
  stat-link-tile.tsx     metric that is also a link to the filtered list
features/admin/<area>/   per-area screens and hooks
lib/api/admin/<area>.ts  services + types (contract §13)
```

## 8. UI system

- **Tokens:** use the app's (`bg-canvas`, `bg-card`, `border-border`, `text-muted-foreground`, `primary`), not `slate-*`. The admin feels like myHoodora in "work mode": calm, dense, teal accents.
- **Type scale:** page title `text-2xl font-bold` · section `text-base font-bold` · body `text-sm` · table `text-sm` · meta `text-xs text-muted-foreground`.
- **Spacing:** page padding `p-4 sm:p-6 lg:p-8`, section gap `space-y-6`, card padding `p-5`.
- **Statuses:** each gets one colour and one word everywhere.

| Status | Tone | Used for |
| --- | --- | --- |
| Active / Verified / Approved | green (`success`) | neighbours, Hoods, businesses |
| Pending / Open / Under review | amber (`warning`) | verification, reports, applications |
| Reported | coral | content with open reports |
| Restricted / Suspended / Removed | red (`destructive`) | accounts, content |
| Resolved / Dismissed / Ended / Archived | grey (`secondary`) | closed items |

- **Responsive:** sidebar → sheet under `lg`; tables become cards under `md`; detail side column stacks under the main one; primary action in a sticky bottom bar on mobile.
- **States on every page:** loading skeleton, empty with a next step ("No open reports. Nice work. See resolved →"), error with retry, unauthorised, not found.

## 9. Permissions

These use the roles that **exist** (`member | moderator | admin`). Anything else is **proposed** and marked 🆕.

| Capability | Moderator | Admin |
| --- | --- | --- |
| Enter admin | ✅ (🆕 today only admin) | ✅ |
| Moderation queue: keep / remove / warn / restrict (≤7 days) | ✅ | ✅ |
| Suspend account, restrict > 7 days, reinstate | — | ✅ |
| Verification approve/reject | ✅ | ✅ |
| Hoods create / edit / archive | — | ✅ |
| Business approve/reject | — | ✅ |
| Broadcast to all users | — | ✅ |
| Team & platform settings | — | ✅ |
| 🆕 `owner` (manage admins) | — | proposed later |
| 🆕 Hood Lead (volunteer, votes only in their Hood) | — | proposed later (Nextdoor model) |

- **Backend is the source of truth:** `RolesGuard` + `@Roles()` on every `/admin/*` route, and the API returns the viewer's capabilities (`GET /admin/me → { role, can: string[] }`).
- **Frontend behaviour:** it hides actions not in `can`, and still handles `403` gracefully. It never fakes permission checks.
- **🔴 Immediate backend fix, independent of this redesign:** guard `POST /neighborhoods` and `DELETE /neighborhoods/:id` with `@Roles("admin")`.

## 10. QA strategy

- **Navigation:** every sidebar item, every row → detail, breadcrumbs, back, deep links (paste URL), old-route redirects.
- **Data:** loading, empty, error (force offline via `NEXT_PUBLIC_USE_MOCKS` + DevTools offline), pagination, search, filter, sort, URL state survives reload.
- **Actions:** each action with confirm → toast → timeline + audit entry; the cancel path; double-submit prevention; bulk actions.
- **Roles:** moderator sees no admin-only actions; a forced `403` shows the unauthorised state.
- **Responsive:** 1440 / 1024 / 768 / 390 widths.
- **Technical:** `pnpm check-types`, `pnpm lint`, `pnpm test` (new tests for services and report state transitions), `next build`, no console errors.

## 11. Implementation plan

| Phase | Scope | Notes |
| --- | --- | --- |
| **0** | This audit + target + API contract §13 | ✅ done |
| **1** | Foundations: `lib/api/admin/*` services + mock seeds from the shared store; `ENDPOINTS` keys; retire `AdminDataContext`; admin types | No visible change yet |
| **2** | Layout & navigation: new sidebar groups + count badges, header breadcrumbs, `PageHeader`, `AdminToolbar`, `DataTable`, `StatusBadge`, `ActionDialog`, `Timeline`; moderators allowed in; old-route redirects | |
| **3** | Overview rebuilt around *Needs attention* | |
| **4** | Moderation: queue, report detail, actions, history | Highest value; reads real `reports` from the feed |
| **5** | Community: Hoods (list/detail/new with map), Neighbours (list/detail), Verification | |
| **6** | Content: Posts (+ comments in detail), Safety alerts, Groups, Marketplace | |
| **7** | Businesses (applications from `/business/get-started`) | |
| **8** | Support: Inbox (queries + contact + feedback), Broadcasts with phone preview | |
| **9** | Insights; Settings: Team & roles, Platform | |
| **10** | Responsive pass + full QA + `ADMIN_CHANGELOG.md` | |

### Decisions (confirmed 29 Sep 2026)
1. **Moderators** get into the admin with the reduced permissions in §9. ✅
2. **Hood Leads** (volunteer voting, Nextdoor model) are a **to-do for a later phase**. See the backlog below. 📝
3. **Account state** is split into `verificationStatus` + `accountStatus`. ✅
4. **Hoods** are paused/archived instead of hard-deleted. ✅

### Backlog (after Phase 10)
- **Hood Leads:** volunteer role per Hood; reported content in their Hood goes to a vote (Keep / Maybe remove / Remove); removal needs consensus; staff override; high-risk reasons (threats, discrimination, misinformation) and account reports skip Leads and go to staff.
- **Appeals:** author and reporter appeals on moderation decisions.
- **`owner` role** to manage admins.
