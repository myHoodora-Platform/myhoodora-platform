# myHoodora — Mobile Home Feed Redesign Spec

**Status:** Draft. Research done 2026-10-27. Not yet checked against the codebase.
**Scope:** Mobile app first (web later). Full ads scope: backend + admin UI + feed injection + tracking.
**Rule:** Everything here must be checked against the existing mobile components, API contracts, design tokens and backend modules before coding. Where the code disagrees with this spec, follow the code's conventions and note the difference.

> Product note (2026-10-27): Facebook is a reference for the flow, not a design to copy. myHoodora keeps its own look, and the floating bottom tab bar stays as it is.

---

## 0. Goals

1. A home feed that feels like Facebook mobile: clean post cards, a clear author header, counts row, action bar.
2. Comments open in a **bottom sheet that slides up**, not as a separate page.
3. Tapping an author shows **who posted** (profile screen + optional quick preview).
4. Long text is **truncated with "See more"** and expands in place.
5. **Admin-created ads** appear among posts in several formats, are clearly labelled, follow placement rules, and are tracked.

Non-goals for this pass: web feed redesign, paid self-serve ads for users, ad billing.

---

## 1. Feed post card

### Layout (top to bottom)
| Part | Details |
|---|---|
| Header | Avatar (40px, circular) · author name (bold) · meta line: relative time (`2h`, `Yesterday`, `Mar 4`) · neighbourhood/audience icon · `⋯` overflow on the right |
| Body text | Clamped to **5 lines** with "… See more" (see §4) |
| Media | Full-bleed (edge to edge). Single image keeps aspect ratio, bounded to **1.91:1 (wide) – 4:5 (tall)**, cropped centre beyond that. Multi-image grid: 2 = side by side, 3 = 1 large + 2 small, 4 = 2×2, 5+ = 2×2 with "+N" overlay. Tap → full-screen viewer with swipe and pinch-zoom |
| Counts row | Left: reaction icons + total. Right: `N comments · N shares`. Hide a count when it's 0. Tapping the comment count opens the comments sheet |
| Action bar | `Like` · `Comment` · `Share`, equal width, icon + label, divider line above |
| Separator | 8px neutral grey gap between cards (Facebook pattern), not borders |

### Overflow menu (`⋯`)
- Everyone: Save post, Copy link, Hide post, Report post.
- Owner only: Edit, Delete (with a confirmation prompt). **Ownership is enforced on the server**, not just by hiding the menu item.

### Interactions
- **Like:** optimistic toggle with rollback and an error toast on failure. Ignore taps while a request for that post is in flight. If the backend supports reactions, long-press opens a reactions picker. Otherwise, plain like only (don't invent a reactions API without agreement).
- **Share:** native share sheet with the post's link (only if a public post URL exists).
- **Double-tap media:** optional like. Leave it out if it conflicts with the media viewer.

### Feed states
- Loading: skeleton cards (avatar circle + 3 text bars + media block).
- Empty: friendly message + "Create a post" call to action.
- Error: inline message + Retry. Keep posts already loaded.
- Pull-to-refresh at the top. Infinite scroll with a bottom spinner. No duplicate fetches.
- New posts while scrolled down: optional "New posts ↑" pill.

### Performance
- Use a virtualized list (e.g. FlashList / FlatList with `keyExtractor`, `getItemType` for post vs ad). Memoize cards.
- Use thumbnails or resized images in the feed, with lazy loading. Video autoplays muted only when ≥50% visible, and pauses when it leaves the screen.

---

## 2. Comments bottom sheet

### Opening and sizes
- Opened by: the Comment button, the comment count, or "View all N comments".
- **Modal bottom sheet** sliding up from the bottom with a dimmed backdrop.
- Two stop points (detents): **~60%** (opens here) and **~95%** (drag up). On iOS these match the native medium/large sheet sizes.
- Drag handle at the top.

### Closing
- Swipe down, tap the backdrop, the close button, or Android back (closes the sheet before leaving the screen).
- If there's an unsent draft, keep it (per post, in memory) so reopening the sheet restores it.

### Content
- Header: reaction summary + title "Comments" + close (X).
- List (virtualized): avatar, name, comment bubble (light grey, rounded), time · Like · Reply under the bubble.
- Replies: one indent level. Collapsed behind "View N replies".
- Sorting: follow what the backend supports (e.g. "Most relevant" / "Newest"). Don't add sorting the API lacks.
- Paging: load more on scroll if the API pages comments.

### Composer
- Pinned to the bottom of the sheet and stays above the keyboard.
- When replying: shows "Replying to *Name* ✕".
- Send button disabled while empty or while sending (no duplicate comments). Show the comment as "Sending…", then confirmed, or failed with "Tap to retry".
- After sending, update the post's comment count in the feed.

### Accessibility
- Focus moves into the sheet on open and returns to the triggering button on close.
- Labels for the handle, close button and composer. Respect the reduce-motion setting (shorter or no slide animation).
- Touch targets ≥ 44×44pt.

---

## 3. Author profile / "who posted this"

- **Tap avatar or name** → existing profile screen (reuse the route if one exists).
- **Optional long-press** → quick preview sheet: avatar, name, neighbourhood, member since, mutual connections (only if the API has it), buttons "View profile" + "Message"/"Follow" (only if those features exist).
- Show only fields the backend already exposes for **public** profiles. Privacy settings are enforced server-side. Don't add new personal data to API responses without an explicit decision.
- The owner's own posts → own profile.
- Deleted or deactivated author → show "myHoodora user" with no link.

---

## 4. "See more" text truncation

- Clamp body text to **5 lines** in the feed (3 lines for ads, see §5).
- Show `… See more` at the end of the last visible line, in muted bold. Tapping it expands the text **in place**. Expanded text stays expanded while scrolling (store the expanded state per post ID).
- **Decide based on rendered lines, not character count.** Measure with the text layout callback (e.g. `onTextLayout` line count in React Native). Show the toggle only when the text truly overflows.
- Very long posts (over ~2,000 characters): "See more" opens the post detail screen instead of expanding inline.
- Links, mentions and hashtags stay tappable in both states.
- Optional: "See less" at the end of expanded text.

---

## 5. Admin ads ("Sponsored")

### 5.1 Ad formats
| Format | Content | Notes |
|---|---|---|
| Single image | Image + primary text + headline + CTA button | Image 1:1 or 4:5, min 600px wide |
| Video | Video + poster image + text + CTA | Autoplays muted when ≥50% visible, captions recommended |
| Carousel | 2–10 cards, each: image, headline, own link/CTA | Horizontal swipe, cards 1:1 |
| Announcement | Text-only card with a coloured background + optional CTA | For community notices from admins |
| Local business promo | Logo, business name, image, short text, CTA (Call / Visit / Directions / Learn more / Shop) | Good fit for a neighbourhood app |

Copy guidance (Meta Feed norms, from a third-party summary): primary text **~125 characters** before "See more", headline **~27–40 characters**.

### 5.2 How an ad looks in the feed
- Same card shape as a post, so it fits the feed, but **clearly marked**:
  - Advertiser name + **"Sponsored"** label right under it (always visible, readable size, not colour alone).
  - CTA bar under the media: headline/domain on the left, button on the right.
- Overflow `⋯`: "Hide ad", "Why am I seeing this?", "Report ad".
- Industry guidance (IAB): a reasonable person must be able to tell ads from normal posts.

### 5.3 Placement rules (server-side, configurable)
| Rule | Default |
|---|---|
| First ad position | Not before the **4th** item |
| Gap between ads | Every **6–8** organic posts (configurable) |
| Adjacent ads | Never two in a row |
| Frequency cap | Same ad max **N times per user per day** (configurable, e.g. 3) |
| Format rotation | Avoid the same format twice in a row when possible |
| Targeting | All users, or chosen neighbourhoods / regions |
| Schedule | Start date/time, end date/time, status: draft / active / paused / ended |
| Weighting | Priority/weight to choose between eligible ads |
| Hidden ads | Never show an ad again to a user who hid it |
| Not enough posts | No ads if the page has too few organic posts |

**The backend inserts ads into the feed response** as typed items:
```json
{ "items": [ { "type": "post", "data": {...} }, { "type": "ad", "data": {...}, "slotId": "..." } ], "nextCursor": "..." }
```
This keeps paging consistent, makes the limits hard to bypass, and keeps the app simple. Ad slots must stay stable across pages (no shifting or duplicates when the next page loads). Check whether the feed uses cursor or offset paging first. **This is an API contract change:** version it or keep it backward-compatible for older app builds (e.g. new endpoint or query flag), because the mobile app is about to be published.

### 5.4 Tracking
- **Impression:** client sends it when an ad is ≥50% visible for ≥1 second, once per feed session.
- **Click:** sent when the CTA, media or advertiser name is tapped.
- **Server dedupes** with an idempotency key (`userId + adId + feedSessionId + eventType`) and a unique constraint.
- Events are sent in batches or fire-and-forget, never blocking the UI. Retry safely.
- Admin dashboard per ad: impressions, unique reach, clicks, CTR, hides, reports, date range filter.

### 5.5 Admin panel
- Ads list: status, format, schedule, targeting, quick stats, pause/resume.
- Create/edit form per format with a **live preview** of how the ad will look in the feed.
- Media upload: validate type, size and dimensions on the server. Reuse the existing upload pipeline.
- **All ad admin endpoints require the admin role, checked on the server.** Audit log for create/edit/delete/pause.
- Delete = soft delete (keep stats).

### 5.6 Data model (proposal — adapt to the existing ORM and conventions)
- `ads`: id, title (internal), advertiser_name, advertiser_logo_url, format, primary_text, headline, cta_type, cta_url / phone, status, starts_at, ends_at, priority, daily_cap_per_user, targeting (neighbourhood ids / region), created_by, timestamps, deleted_at.
- `ad_media` / `ad_cards`: ad_id, position, media_url, media_type, headline, link (carousel cards).
- `ad_events`: id, ad_id, user_id, event_type (impression/click/hide/report), feed_session_id, idempotency_key (UNIQUE), created_at. Index on (ad_id, event_type, created_at).
- `ad_hides`: ad_id, user_id (UNIQUE pair).
- Migrations must be additive and safe for existing data.

---

## 6. Acceptance checklist
- [ ] Feed cards match §1 with loading, empty and error states.
- [ ] "See more" only appears when text truly overflows, and expands in place.
- [ ] Comments sheet slides up, has 2 sizes, closes by swipe/back/backdrop, keeps drafts, no duplicate sends.
- [ ] Tapping author opens their profile. Only public fields are shown.
- [ ] Ads appear per §5.3 rules, always labelled "Sponsored", never adjacent.
- [ ] Hide/report ad work and persist.
- [ ] Impressions and clicks are deduped server-side. Dashboard shows stats.
- [ ] Only admins can manage ads (tested with a non-admin = 403).
- [ ] Older app builds still work with the feed API.
- [ ] Tests added: feed ad insertion logic, frequency caps, admin authorization, event dedupe, see-more logic, comment send.
- [ ] Lint, typecheck and tests run and reported honestly.

## 7. Open questions (answer from the code)
1. Mobile stack: React Native / Expo, Flutter, or native? Which list, sheet, navigation and state libraries are already used?
2. Backend stack and ORM. Do reactions, replies, shares, saved posts, reports, admin role and media upload already exist?
3. Feed paging: cursor or offset? Is there ranking or is it chronological?
4. Is there an existing admin panel (in the web app?) to extend?
5. Existing design tokens (colours, spacing, typography) and dark mode?

---

## Sources
- IAB — How leading web properties disclose in-feed ads: https://www.iab.com/news/disclosure-disclosed-how-leading-web-properties-disclose-in-feed-ads
- IAB Native Advertising Playbook 2: https://www.iab.com/wp-content/uploads/2015/06/IAB-Native-Advertising-Playbook2.pdf
- Android — Bottom sheets (Compose): https://developer.android.com/develop/ui/compose/components/bottom-sheets
- Apple WWDC21 — Customize and resize sheets in UIKit (detents): https://developer.apple.com/videos/play/wwdc2021/10063/
- Sprout Social — Facebook ad sizes & specs (third-party, updated 2025-08-22): https://sproutsocial.com/insights/facebook-ad-sizes/

Note: Facebook's mobile site wasn't browsed live (it needs a login). The feed pattern follows Facebook's well-known public mobile design.
