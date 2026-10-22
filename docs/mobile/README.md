# Mobile app documentation

How to run the app, and its push set-up, is in [`apps/mobile/README.md`](../../apps/mobile/README.md). This folder records the decisions and the reference material behind it.

| Read this | For |
| --- | --- |
| [architecture-decisions.md](./architecture-decisions.md) | Every decision (SDK, workspace, auth, shared packages, push, onboarding location, CI, icons), its status and outcome, and the manual tasks it creates |
| [repository-audit.md](./repository-audit.md) | The Phase 0 audit (20 October 2026): what the repository held before mobile work began |
| [api-integration-inventory.md](./api-integration-inventory.md) | What the app uses from the API, how errors are classified, realtime, and the gaps |
| [ui-reference-inventory.md](./ui-reference-inventory.md) | Tokens, navigation and the screen-by-screen plan, from the web |
| [dependency-compatibility.md](./dependency-compatibility.md) | SDK 57 versions, what is installed, and the compatibility checks |

## Status (20 October 2026)

| Phase | State |
| --- | --- |
| 0. Audit | Done |
| 1. Workspace and Expo foundation | Done: SDK 57 in the pnpm workspace, CI checks, brand icons |
| 2. Design system | Tokens shared (`@myhoodora/design-tokens`, drift-tested against the web), core components built. **Not yet** compared side by side with the running web on a device |
| 3. Core infrastructure | Done in code: config, Firebase session in secure storage, API client with the web's error rules, query retries, push, location |
| 4. First vertical slice | Built: sign in → onboarding (GPS or typed address, confirm Hood, or ask to join) → Hood feed (read) → post and comments → notifications → push. **Not yet run on a phone** |
| 5. Delivery | EAS profiles, channels and runtime policy set. No build made; credentials pending (M1, M5) |
| 6. Expand | Not started: posting, For Sale & Free, Messages, realtime, Google sign-in |

## Sign-up to feed revamp (22 October 2026)

| Area | What changed |
| --- | --- |
| After sign-in | The profile load after "Create account" or "Log in" shows a branded screen ("Creating your account…" for an account made in the last minute, else "Signing you in…") instead of a blank screen. Sign-up and log-in can't be submitted twice. |
| Onboarding | Three steps, as on the web: details → "Is this your neighbourhood?" → join, with the outcomes joined, nearby (request to join), requested, outside, and failed check (details saved; "try again" only re-checks). Location is asked for only when "Use my current location" is tapped; denied, Location Services off, timeout (15 s) and approximate (over 1 km) each say what to do instead. Without a map, a typed address found only at area level can't be joined: the app asks for the phone's location or a better street (the web makes the neighbour drag the pin). Errors sit beside their fields. A draft (per account, in the Keychain or Keystore, deleted on logout) resumes where they left. "Skip for now" works as on the web. |
| First run | A once-only welcome card on the feed for newcomers (the web's tour rules: per account, never for existing members or staff). One prompt at a time above the feed: welcome, then "Confirm your email" (resend link), then notifications. |
| Feed and navigation | Floating tab bar with labels and an unread badge. Feed header with the Hood's name, filter chips (sent to the API as `category`), skeleton loading, "all caught up", per-filter empty states, and an optimistic like (rolled back with a message if refused). |
| Shared | `COVERAGE` and `isStaff` moved to `@myhoodora/api-contract`; `addressIssue` names the field at fault. New UI pieces: BrandedLoading, Skeleton/FeedSkeleton, InlineAlert, Chip, StepProgress, Toast, FloatingTabBar, useReducedMotion. |

Not yet: posting, photos (needs an image picker and a new native build), a map to place the pin, Sign in with Apple (App Store rule 4.8 requires it alongside Google sign-in on iOS).

## Nextdoor-style app shell (22 October 2026)

Benchmark: Nextdoor's App Store screens. Built on what the API already has; no new packages.

| Area | What it does |
| --- | --- |
| Navigation | Tabs Home · Search · For Sale, with a green "Post" button beside the bar. The feed header carries the neighbourhood, Notifications and Messages (each with its unread count) and your avatar (More). Routes use the web's paths (`/for-sale/<id>`, `/inbox/<id>`, `/search`), so pushes and shared links open in the app. |
| Posting | `/compose` (modal): General, Recommendation, Alert (kind + urgent), Lost & found, Thanks. A `clientId` per draft means a retried request never posts twice; the Kindness Reminder (§22) nudges and fails open after 3 s. Text only for now. |
| Posts | Share (the phone's share sheet, with the web link) and Report (reason sheet, §9). Comments can be written from the post screen. |
| For Sale & Free | Two-column photo grid with Free and category filters; listing page with swipeable photos, seller, details, Share, Report, and "Hi, is this still available?", which starts (or reopens) the conversation and sends it. Selling opens the web until the app can pick photos. |
| Messages | `/inbox` and `/inbox/<id>`, with the listing shown above the thread. Without the web's live connection (SSE), an open thread checks for new messages every 5 s. |
| Search | One box over posts, For Sale & Free and neighbours (§21), with suggestions, debounced at 350 ms. |
| Refresh | TanStack Query now knows when the app returns to the foreground and when the connection comes back. |

Next, in Nextdoor's order: photos (image picker, then posts and listings), events, groups, businesses, the alerts map, profiles, live updates over SSE.

## Glass, photos, live updates (22 October 2026)

Our own take, not a copy: Nextdoor is a benchmark for what neighbours need, not a design to reproduce.

| Area | What it does |
| --- | --- |
| Appearance | Header and tab bar float over the content. **Glass** (default): what scrolls underneath shows through, blurred (`expo-blur` on iOS; Android draws a translucent surface, since its real blur needs every screen wrapped in a blur target). **Plain**: solid. Chosen in More → Appearance, kept per phone; iOS "Reduce Transparency" always gets solid. |
| Neighbourhood badge | A small drawn map (streets, a park, you as the dot), not a map tile: no data, no map service. Tap it for the neighbourhood sheet (privacy, invite neighbours). |
| Photos | `expo-image-picker` (library or camera, camera permission asked only on "Take a photo"), shrunk to 2048 px with `expo-image-manipulator` before upload, `POST /media` with a 2-minute timeout, two at a time. Each photo shows uploading / done / failed (retry) / remove; removed uploads are deleted. Posts take up to 10; listings up to 10. |
| Selling | `/sell` (modal): photos, name, price or free, negotiable, category, condition, description. For Sale's "+" opens it. |
| Live updates | One `GET /realtime/stream` connection while signed in and in the foreground, read with `XMLHttpRequest` (React Native's fetch can't stream; EventSource can't send the token). Events refresh only what they name; every reconnect refreshes what's on screen; backoff 1 → 30 s with jitter; after 3 failures, open threads poll every 15 s; closed in the background. New posts show a "N new posts" pill instead of moving the feed. |
| Opening a post | Shows the feed's copy at once and refreshes it quietly; comments load alongside (and start loading on touch-down). |

These three native modules need a new development build (`expo run:ios` / `expo run:android`, or EAS).

## Shared screen layout, post screen, comments (22 October 2026)

- **`AppScreen`** (`src/shared/ui/app-screen.tsx`) is the one layout for every screen pushed over the tabs: a fixed `HeaderBar` (back, a centred title or left-aligned custom content such as an author, actions on the right) that content scrolls under, in Glass or Plain, and an optional footer docked above the keyboard. Content pads itself with `useScreenInsets()`. The stack draws no native headers, so every screen behaves the same. Used by the post, notifications, messages, a conversation and More.
- **Post parts** (`post-parts.tsx`: `PostAuthor`, `CategoryBadge`, `PostText`, `PostActions`) are shared by the feed card and the post screen; `PhotoPager` by posts and listings.
- **Post screen**: the author in the header, the text, every photo edge to edge (swipe), actions, then comments with a sort (oldest or newest first). Each comment has "…": delete your own (confirmed), report anyone else's.
- **Comment box**: your comment shows at once ("Sending…"); if refused it's withdrawn and the words return to the box with the reason. Grows to about five lines, counts from 800 of 1,000 characters, and the comment icon focuses it. Without a confirmed email it offers "Resend link" instead (the API would refuse the comment).
- Comments have no likes or replies in the API (contract §2), so the app doesn't show them.

## Profile and settings (22 October 2026)

- `/more` is your **profile**: photo (tap to change), name, verified badge, neighbourhood, a line about you, Edit profile; tabs **Listings** (`GET /listings?seller=`) and **About** (neighbourhood, neighbour since, email). The gear opens Settings.
- `/settings`: grouped rows (`shared/ui/settings.tsx`: `SettingsGroup`, `SettingsRow`, `SettingsSwitch`, `Segmented`). Notifications (this phone, and what you're notified about), Appearance (theme System/Light/Dark set on React Native's Appearance, and Glass/Plain), Privacy, Help, Account (log out, sign out everywhere, deactivate with a reason, §10).
- `/settings/profile`: photo (saves at once: `POST /media` purpose `avatar`, then `PATCH /users/me`; remove photo), name (2–60), about you (≤ 160), email, home address (opens onboarding to move or correct it).
- `/settings/notifications` and `/settings/privacy`: the API's preferences, each change saved at once and undone with a message if refused. Urgent alerts' push stays on (the API enforces it).
- Preference types, defaults, category wording and deactivation reasons moved to `@myhoodora/api-contract/settings`; the web re-exports them.
- **API gap:** there's no "posts by this person" query (the web filters its loaded feed), so the profile shows listings, not posts. Adding `author=<uid>` to `GET /posts/neighborhood/:id` would allow a Posts tab.

## Email changes, neighbourhood requests, support in Messages (22 October 2026)

- **Email** (Edit profile): unconfirmed + password sign-in → "Change" (`/settings/email`): new address and the password again (re-authentication), then `POST /users/me/email` (§31). Confirmed (or Google) → locked, with the reason.
- **Home address** (Edit profile) opens **Your neighbourhoods** (`/settings/neighbourhoods`): home (where you post, sell and message), up to two followed neighbourhoods (read and alerts; "Stop following"), and requests with their status, staff's reason, Withdraw, and "Our team has a question" when staff opened a conversation. Neighbours can't move themselves any more: **Ask to move** (`/settings/neighbourhoods/move`: location or typed address + reason).
- **Follow a neighbourhood** (`/settings/neighbourhoods/add`) in two steps: choose (search pinned, city chips with your city first, "Near your home" from `GET /neighborhoods/nearby`, compact rows), then why (one-tap suggestions, the button above the keyboard).
- **Feed:** the neighbourhood sheet switches between home and followed neighbourhoods; a followed one is read-only (likes off, comment box explains, banner back home).
- **Messages:** "myHoodora Support" pinned at the top (`/inbox/support`, threads `/inbox/support/<id>`, "Ask the team something"), live via `support.message`; its unread count joins the header badge.
- **Pull to refresh** spins only when you pull; background refreshes show a small spinner in the header and never move the list (iOS uses a content inset under the fixed header).
- **Admin web:** Community → Neighbourhood requests (approve, decline with a reason, ask for more in a support conversation), and "Also following" with Remove on each neighbour's page.

## Offline, slow and failed loads (22 October 2026)

- **Never a silent wait.** Queries run with `networkMode: "offlineFirst"` and mutations with `"always"` (`core/api/query-client.ts`): with no signal the API client fails at once with "You're offline" instead of TanStack pausing a skeleton or a Send button indefinitely. Queries refetch by themselves when the connection returns.
- **Connection strip** (`shared/ui/connection-strip.tsx`, state in `core/api/connection.ts`): one line at the foot of the shared `FixedHeader` (and at the top of Search and For Sale) — "No internet connection", then "Back online. Refreshing…" for 2.5 s, or "Your connection is slow" once a load or send has run 8 s. Read out by screen readers.
- **Cached content stays.** A failed background refresh never replaces a list with an error: `ErrorState` shows only when there is nothing to show. It names the cause (offline, slow, other) and says an offline screen fills in by itself.
- **Pull-to-refresh that fails says so** with a toast; the account-load error screen retries when the connection returns.
- **Nudges:** toasts confirm actions whose result isn't visible on screen (posted, listed, link sent, saved, unfollowed, reported) and transient failures; errors the person must act on stay on the screen (a field, an inline alert). The connection strip never also toasts.
- **Email change:** an address another account uses (Mongo or Firebase, any case or spacing) is refused with 409, shown on the email field.

### Verified on 20 October 2026 (Node 24.19)

- Root `pnpm lint`, `pnpm check-types` and `pnpm test` pass: web 272 tests, API 133, mobile 23.
- API integration: 25 suites, 294 tests pass (11 of them the new `push` suite). One earlier run timed out in `media-search-realtime` while other processes loaded the machine; it passed alone and in the full rerun.
- `pnpm build` passes.
- `expo install --check`, `expo-doctor` (21/21), and iOS and Android bundles pass (`expo export`). The bundle contains Firebase's React Native build.

### Not verified

- **Nothing has run on a device or simulator.** No development build has been made, so Metro serving to a phone, secure storage, location permission, push delivery and tap routing are unverified.
- Accessibility (VoiceOver and TalkBack), font scaling, small screens and the keyboard need a manual pass on devices.
