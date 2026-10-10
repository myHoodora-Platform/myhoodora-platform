# Frontend — Information Architecture

_Based on `nextdoor-research.md` (Nextdoor screenshots, public URL structure, help centre, 2025 redesign), adapted for Nigerian neighbourhoods and estates._

## Principles taken from Nextdoor

1. **Sections are places, named with nouns.** Home, For Sale & Free, Alerts, Events, Groups. No "Dashboard".
2. **Flat top-level URLs.** Each section owns its path. There's no `/dashboard/…` prefix.
3. **Every post has its own page** (`/p/[id]`). It's what gets shared, and it renders a proper link preview. This matters most on WhatsApp.
4. **One obvious primary action: Post.** It's always visible.
5. **Utility first.** Alerts (security, power, flooding) and trusted recommendations are why people open the app daily. The social feed ties it together.
6. **Public surfaces grow the product.** Logged-out visitors can see a neighbourhood's public page and single public posts, with a sign-up CTA.
7. **Only link to what's real.** Sections without content stay out of the nav until they exist.

## Current IA (for reference)

```text
/dashboard                  Neighbourhood Feed (real)
/dashboard/safety-watch     Safety Watch Group (mock)
/dashboard/events           Community Events (mock)
/dashboard/marketplace      Marketplace Listings (mock)
/dashboard/settings(/account)
/dashboard?post=<id>        shared-post highlight in feed
Header: title · bell dropdown   Sidebar footer: profile card · Log out
```

## Proposed route map

`app/(app)/` is a route group, so it adds no URL segment. It holds the signed-in shell, and every URL below is top-level.

### Signed-in app

| Route | Screen | Nextdoor equivalent | Status for launch | Backend dependency |
| --- | --- | --- | --- | --- |
| `/news-feed` | **Home**: composer, sort/filter chips, posts | `/news_feed/` | **Real** | cursor pagination (nice-to-have) |
| `/p/[id]` | **Single post**: full post, reactions, comments area, "More from your neighbourhood" | `/p/{id}` | **Real** (finds post in loaded feed until endpoint exists) | `GET /posts/:id`; comments |
| `/for-sale` | **For Sale & Free**: grid, category chips, Free filter | `/for_sale_and_free/` | Preview (mock) | listings API |
| `/for-sale/[id]` | Listing detail: photos, ₦ price / Free / Negotiable, seller, "Chat on WhatsApp" (optional) | listing page | Preview | listings API |
| `/alerts` | **Alerts**: list + neighbourhood map (maplibre, already in the project); chips Security · Power · Water · Flooding · Traffic · Fire · Scam | `/alerts` map | **Real** (alert posts), chips visual until category field exists | alert `category`, optional coordinates |
| `/events` | **Events**: Upcoming / Past, from real event posts | `/events/` | **Real** (event posts) | event `date`/`location` fields, RSVP |
| `/events/[id]` | Event detail (= post page variant with date/location header, RSVP later) | event page | Real via `/p/[id]` data | RSVP |
| `/groups` | **Groups**: Your groups · Discover; Join vs Request; Safety Watch group lives here | Groups | Preview | groups API |
| `/groups/new` | **Create a group**: name, description, category, cover, open/private, boundary (my neighbourhood / nearby / city), guidelines agreement. Then lands on the group with Invite open. | Create group | Preview | groups API |
| `/g/[id]` | Group page: cover, Official badge, boundary, join/request, invite-link join, Invite (link + by name), group feed (authors/admins can remove posts) | `/g/{id}` | Preview | groups API |
| `/g/[id]/manage` | **Admin tools**: Requests (approve/decline), Members (make/remove admin, remove with reason), Edit details, Leave, Delete (only if nobody else posted) | group admin tools | Preview | groups API |
| `/notifications` | **Notifications**: chips All · Alerts · My activity; grouped "Today / Last 7 days" | `/notifications/` | Real-derived (alerts from feed + verification) | notifications API |
| `/profile/[uid]` | Neighbour profile: photo, name, neighbourhood, "Neighbour since", bio, their posts | profile | Own profile real; others need endpoint | `GET /users/:uid` public profile |
| `/settings` | Phones: list of sections. Desktop: section nav + Profile. | Settings | Real | — |
| `/settings/profile` | Photo, name, bio | Profile | Name real; photo/bio preview | `PATCH /users/me` bio/photoURL |
| `/settings/account` | Email, sign-in method, change password (reset email), phone (soon), deactivate | Account | Real (password reset) + preview | deactivate |
| `/settings/neighbourhood` | Neighbourhood, verification status, private address, moving | — | Real | — |
| `/settings/notifications` | Push/email per category + digest frequency | Notification settings | Preview | preferences API |
| `/settings/privacy` | Profile visibility, who can message you, "neighbour since", blocked list | Privacy settings | Preview | preferences + blocks API |
| `/help` | Help centre: FAQs, community guidelines, contact | Help centre | Static | — |

### Later (post-launch, not in nav until real)

| Route | Screen | Nextdoor equivalent |
| --- | --- | --- |
| `/faves` | **Trusted artisans & services**: electricians, plumbers, generator repair, tailors, mechanics; recommendations from verified neighbours only | `/faves/` |
| `/pages/[slug]` | Business / artisan page with neighbour Faves | `/pages/` |
| `/agency/[slug]` | LGA, police division, SEMA, DisCo, estate management pages | `/agency/` |
| `/local-news` | Local publishers + estate notices | `/local_news/` |
| `/neighbours` | Neighbours directory | Neighbors |
| `/inbox` | In-app chats | Chats |

### Public (logged-out)

| Route | Screen | Nextdoor equivalent |
| --- | --- | --- |
| `/` | Landing. **Signed-in visitors are redirected to `/news-feed`**, like Nextdoor. `/about`, `/privacy` and `/guidelines` stay readable. | nextdoor.com |
| `/neighbourhood/[slug]` e.g. `/neighbourhood/lekki-phase-1--lagos` | **Public neighbourhood page**: about, recent public conversations, safety updates, for sale, events, nearby neighbourhoods, **Join your neighbours** CTA | `/neighborhood/{slug}--{city}--{state}/` |
| `/p/[id]` (logged-out view) | Public preview of an "Anyone" post: text + image + "Join to reply" | `/p/{id}` public |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/onboarding` | unchanged | — |
| `/about`, `/how-it-works`, `/guidelines`, `/privacy`, `/coming-soon/[feature]` | unchanged | — |

### Redirects (old links keep working)

| From | To |
| --- | --- |
| `/dashboard` | `/news-feed` |
| `/dashboard?post=:id` | `/p/:id` |
| `/dashboard/safety-watch` | `/alerts` |
| `/dashboard/marketplace` | `/for-sale` |
| `/dashboard/events` | `/events` |
| `/dashboard/settings/:path*` | `/settings/:path*` |

The query-param redirect (`?post=`) can't be expressed as a plain `next.config.js` redirect, so it's handled in `proxy.ts`.

## Navigation

### Desktop (≥1024px)

```text
┌──────────────┬──────────────────────────────────┬───────────────────┐
│ myHoodora    │  [ Search myHoodora (soon) ]  🔔 👤│                   │
├──────────────┼──────────────────────────────────┼───────────────────┤
│ ⌂ Home       │ (avatar) What's happening,       │ ● Lekki Phase 1   │
│ 🛍 For Sale & │          neighbour?    📷 [Post] │   Verified ✓      │
│    Free      │                                  │   See all alerts ›│
│ ⚠ Alerts     │ [All][Alerts][Events][For sale]  │───────────────────│
│ 📅 Events    │ [Recommendations][General]       │ Upcoming events   │
│ 👥 Groups    │                                  │  Sat · Estate     │
│              │ ┌ post card ───────────────────┐ │  cleanup          │
│ [  + Post  ] │ │ Ada O. · Lekki Ph 1 · 2h ···  │ │───────────────────│
│              │ │ text… see more                │ │ Guidelines · Help │
│ Settings     │ │ [image]                       │ │                   │
│ Help centre  │ │ 👍 React   💬 Comment  ↗ Share │ │                   │
└──────────────┴──────────────────────────────────┴───────────────────┘
```

- Left nav: 5 items, no group labels, active = bold + filled icon + subtle indicator.
- **Post** button: the single filled primary button in the nav. It opens the composer dialog with a category picker.
- Header: search (disabled, "coming soon" tooltip, until search exists) · bell (badge; click → dropdown of latest 5 + "See all" → `/notifications`) · avatar menu (View profile, Settings, Help, Log out).
- Right rail (≥1280px): neighbourhood card with verification state and "See all alerts", upcoming events, footer links. **No ads.**

### Mobile (<1024px)

```text
┌──────────────────────────────┐
│ myHoodora            🔔  👤 │   top bar
├──────────────────────────────┤
│ [chips scroll horizontally]  │
│ post cards (full-bleed media)│
│                              │
├──────────────────────────────┤
│ ⌂      🛍      ⊕      ⚠   ☰ │   bottom tab bar
│ Home  For Sale Post Alerts More│
└──────────────────────────────┘
```

- **More** opens a sheet: Events, Groups, Profile, Settings, Help, Log out.
- **Post** opens the composer as a full-height sheet.
- Critical-alert banner (see below) sits under the top bar.

## Home feed

| Element | Decision | Source |
| --- | --- | --- |
| Composer | "What's happening, neighbour?" + photo button + Post; expands to a **category picker** | Nextdoor composer |
| Composer categories | **General · Ask for a recommendation · Sell or give away · Alert · Event · Lost & found · Poll · Thank a neighbour** | Nextdoor categories, adapted |
| Polls | One question, 2–4 options, closes after 1 / 3 / 7 days, one anonymous vote each, result bars after voting | Nextdoor polls |
| Emoji | Emoji button in the composer, comments and chat. Desktop: a popover that repositions itself to stay on screen. Phones: a bottom sheet. Quick row of common emoji; inserts at the cursor. | WhatsApp / Facebook pattern |
| Filter chips | **All · Alerts · Events · For sale · Recommendations · General**, synced to `?filter=` | Their chips are sort modes (For you/Recent/Nearby/Trending), which need server ranking. We ship honest type filters now and add sort once the API supports it |
| Post card | author + **neighbourhood name** + time · `•••` menu (Copy link, Report, Delete if own) · text with "see more" after ~5 lines · media · actions | Nextdoor card |
| Reactions | **Like · Helpful · Agree · Haha · Wow · Sad.** Drop "Angry" (kindness-first) | Nextdoor reaction set |
| Comments | Comment button → `/p/[id]#comments` | Nextdoor |
| Alert takeover | **Red strip** app-wide for urgent alerts under 2 h old. Multiple urgent alerts share one strip. **One amber "Active alerts" card** at the top of "All", grouped by type. In "All", active alerts appear **only** in that card (no duplicate full cards). They rejoin the feed as normal posts once ended or resolved. The "Alerts" chip and Alerts page show them in full. Full lifecycle in `api-contract.md` → "Alert lifecycle". | 2025 red/yellow alert states, Citizen incident resolution |
| Kindness prompt | Before posting, a gentle "Keep it kind" reminder if text matches a small word list | Kindness Reminder |
| Empty state | Per filter, with a next action ("No events yet. Post one?") | — |
| Error state | "Couldn't load your neighbourhood feed" + Retry | fixes current bug |

## Post visibility (needs backend, designed now)

Composer audience picker: **My neighbourhood** (default) · **Nearby neighbourhoods** · **Anyone**. It can't be changed after posting, which is the same rule as Nextdoor. Only "Anyone" posts get a public `/p/[id]` preview. Until the API supports it, the picker is hidden.

## Verification (Nigeria)

Keep the current GPS verification. Add these to the verification sheet as options (preview until backend):
- phone OTP
- estate / residents' association code
- invite from a verified neighbour

There's no postcard option, because postal delivery isn't dependable enough for codes.

## Significant changes vs. today

| # | Current | Problem | Proposed | Preserves |
| --- | --- | --- | --- | --- |
| 1 | `/dashboard` "Neighbourhood Feed" | "Dashboard" is admin language; nested URLs | `/news-feed` "Home" | feed behaviour, alert pinning, gating |
| 2 | `/dashboard?post=id` highlight | Can't render a link preview; not a real page; no home for comments | `/p/[id]` page + redirect | old share links |
| 3 | Safety Watch (mock list + join) | Duplicates real alert posts | `/alerts` (real alerts + map) and Safety Watch group → `/groups` | verified-only gate |
| 4 | Events (mock) | Real event posts hidden | `/events` from real event posts | event composer |
| 5 | Marketplace Listings | Label | `/for-sale` "For Sale & Free", ₦ / Free / Negotiable | preview content |
| 6 | Bell dropdown only | No history | `/notifications` page + dropdown | unseen-alert logic |
| 7 | No global Post | Hidden on mobile | Nav button + mobile centre tab | composer + gating |
| 8 | Facebook reaction set incl. Angry | Wrong tone for neighbours | Nextdoor-style set, no Angry | reaction count, optimistic toggle |
| 9 | Profile card + Log out in sidebar | Clutters nav | Avatar menu / More sheet | same destinations |
| 10 | No public pages beyond marketing | No organic growth | `/neighbourhood/[slug]` public pages | — |

## Feedback & connection states (app-wide)

| Situation | Pattern |
| --- | --- |
| Success confirmations | Toast slides down from the **top-centre, just below the header** (never covers header icons), then slides back up. Close button, swipe to dismiss, ~4 s, pauses on hover, max 3 stacked. |
| Device offline | Dark strip under the header. The feed keeps showing loaded posts. The composer keeps the draft and disables Post. A "You're back online" toast appears and the feed refreshes itself on reconnect. |
| Refresh failed but posts are shown | Inline amber notice: "Couldn't refresh. Showing posts from 5m ago · Retry". Loaded content is never replaced by a spinner. |
| First load failed | Full-area state specific to the cause (offline / slow / server / session expired), each with the right action (Try again / Log in again). |
| "Load more" failed | Inline retry row at the bottom of the list. |
| Returning to the tab after 2+ min | Quiet background refresh ("Checking for new posts…"). |
