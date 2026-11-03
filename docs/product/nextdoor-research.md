# Nextdoor Research — Product & Frontend Structure

_Research done 2026-09-28 from: user screenshots of nextdoor.co.uk (Home feed, Notifications, Alerts map, Local News), nextdoor.com `robots.txt` and a public neighbourhood page, Nextdoor developer docs, help-centre articles, and 2025 redesign coverage. Sources at the bottom._

The goal is to learn **how Nextdoor is structured and why**, then adapt it for Nigerian neighbourhoods and estates. We are not cloning its look.

---

## 1. Product model in one line

Nextdoor has moved from "social network for neighbours" to a **local utility**. The 2025 redesign reorganised the product around three needs: **Alerts** (what's happening that affects me), **News** (trusted local information) and **Faves** (who can I trust to fix/sell/serve me). The neighbour feed stays at the centre. Their CEO calls it "less a social network, more a utility-centric network".

**Lesson for myHoodora:** in Nigeria the utility need is even stronger (security, power, flooding, road conditions, trusted artisans). We should design around those jobs, not around likes.

---

## 2. Navigation (from screenshots)

**Desktop left nav, in order:** Home · For Sale & Free · Local Faves · Local News · Public Services · Alerts · Groups · Events · **[Post]** button · Settings · Help centre

**Top bar:** logo · "Search Nextdoor" (wide, centred) · Notifications bell · Chats · avatar with a dropdown

**Right rail (on Home and Notifications):** current neighbourhood card (green dot, neighbourhood + area name) with "See all alerts ›", then sponsored cards. A **Chats** dock is pinned bottom-right.

Observations:
- Nav items are **places**, not features. Labels are 1–3 words.
- The **Post** button is the only filled, coloured element in the nav, so the primary action is obvious.
- Settings and Help sit below the Post button in plain text. They're secondary, not mixed into the main nav.
- Active item = bold label + filled icon. No background pill.

---

## 3. URL / route structure

From the screenshots and nextdoor.com `robots.txt` (the paths they allow to be crawled are their **public, shareable** surfaces):

| Path | What it is | Public? |
| --- | --- | --- |
| `/news_feed/` | Home feed | signed-in |
| `/notifications/` | Notifications page | signed-in |
| `/local_news/` | Local News feed | signed-in |
| `/p/{post_share_id}` | **Single post page** — every share link | public preview |
| `/for_sale_and_free/` | Marketplace | public |
| `/events/`, `/events/calendar/{state}/{city}/` | Events + city calendars | public |
| `/faves/` | Recommendations hub | public |
| `/g/{id}` | Group page | public (open groups) |
| `/pages/{slug}` | Business & organisation pages | public |
| `/agency/` | Public agency pages (police, council, fire) | public |
| `/neighborhood/{slug}--{city}--{state}/` | **Public neighbourhood landing page** | public |
| `/neighborhood/{slug}/favorites/` | Neighbourhood Faves | public |
| `/city/feed/`, `/city/post/` | City-level public content | public |
| `/link_preview_image/` | Generated **OG images for shared links** | public |

Key lessons:
1. **Flat, top-level routes.** There's no `/dashboard` prefix; each section owns a noun.
2. **Posts have their own page.** `/p/{id}` is the unit of sharing, and it renders a proper link preview (they even generate the preview image).
3. **Public, SEO-indexed surfaces are a growth engine.** A logged-out visitor landing on `/neighborhood/soma--san-francisco--ca/` sees real local content and a "Sign up" CTA.

### The public neighbourhood page (studied live)

Sections, in order:
1. Neighbourhood name + description
2. "See what neighbors are sharing" / "Conversations happening in {area}"
3. "Discover local groups"
4. "Latest safety updates near {area}"
5. "For sale and free items nearby"
6. "Upcoming events"
7. "Fave Awards winners"
8. "Neighborhood FAQs"
9. "Hear from locals"
10. "Nearby neighborhoods" (links to sibling pages)
11. "Crime and safety for nearby neighborhoods"
12. "Agencies"

It has full OpenGraph metadata (title, description, 900×600 image).

**For myHoodora:** `/neighbourhood/lekki-phase-1--lagos` and similar pages would rank for searches like "Lekki Phase 1 security" or "Yaba neighbourhood", and pull people into signing up. We already have seeded neighbourhoods in the API.

---

## 4. Home feed

- **Composer at top:** avatar · "What's happening, neighbour?" · photo button · **Post**
- **Sort chips:** For you · Recent · Nearby · Trending (help centre: members can sort and customise their feed)
- **Post card:**
  - context line ("From your immediate neighbours")
  - author name + **neighbourhood** · relative time · visibility icon (globe = Anyone)
  - `•••` menu
  - text with "… see more" truncation
  - full-width media
  - actions: Like/react · Comment · Share
- Alerts can **take over** the app. The 2025 redesign added a red state for critical alerts (a full takeover) and a yellow state (pinned to the top).

### Post composer categories
When you post, you choose a category: **general update, recommendation request, sell/give away an item, safety concern, lost & found, event, poll**, and **#ThankANeighbor** (name a person + message of thanks).

### Post visibility (audience)
Chosen at post time and **can't be edited afterwards**:
- **Your neighbourhood**: only immediate neighbours
- **Nearby neighbourhoods**: outsiders see the subject line only
- **Anyone**: full content, shareable off-platform, may be distributed further

### Reactions
**Like, Insightful, Agree, Haha, Wow, Sad, Helpful.** Note there's **no "Angry"**, which is deliberate for a kindness-first product. Desktop: hover on Like. Mobile: long-press.

### Comments
Threaded under the post, with `@mention` to reply to a specific neighbour.

---

## 5. Alerts

- A **map-first page**: an "Alerts in {neighbourhood}" panel floats over a map, with category chips **Safety · Outages · Weather · Fires · Traffic**.
- Map controls: Home, Current location, weather chip, zoom.
- Empty state: a check icon, "No alerts in this area", then **Expand search area**.
- Sources mix neighbour posts with official feeds (outages, weather, wildfire partners).

---

## 6. Notifications

- A full page (not only a dropdown), with chips **All · Neighbourhood · My activity · Alerts**.
- Grouped by time ("Last 7 days"). Each row = avatar · "**Name:** snippet…" · optional thumbnail · relative time.
- Settings let each category go to push / email / **daily digest** / off. Urgent alerts can be set to immediate.

---

## 7. For Sale & Free

Listing fields: **title** (item name only), **description** (size, colour, condition), **price or Free** (can be blank), **category**, **at least one photo (required)**. There's a dedicated composer entry: "Sell or give away an item".

## 8. Groups

- **Open** groups: join instantly, anyone nearby can read, public member list.
- **Private** groups: request to join, the lead approves, content is members-only.
- Create group → pick a **boundary** (which neighbourhoods it covers). Button text changes between **Join** and **Request**.

### How groups are created on Nextdoor (researched 2026-09-28)
1. **Who can create:** any verified neighbour account (not business pages).
2. **Where:** Groups → **Create group** (older versions: "Add new").
3. **Form:** name, description, privacy (public/open or private), **boundary** (immediate neighbourhood, nearby neighbourhoods, or city-wide; controls who can find it), cover photo (optional, or later via "Edit group").
4. **After creating:** you land on the group page and become its **admin**. For private groups the next step is inviting people.
5. **Invite:** copy a join link (text, email, social), invite neighbours by name (suggestions based on location and connections), or upload contacts.
6. **Admin tools:** edit name, description and photo; approve join requests; remove posts; remove members (they're notified, with an optional reason); add admins or moderators.
7. **Delete:** only possible if the group has no posts from other members.
8. **Rules:** Groups and Events Guidelines apply (with specific rules on religious and political content). Admins have broad discretion within the anti-discrimination rules. Neighbourhood Leads moderate the wider neighbourhood by panel vote, separately from group admins.

**myHoodora additions:** a category (for browsing), an "Official" badge for estate and residents' association groups, a limit of 3 groups per person per day, and WhatsApp-first sharing of invite links.

## 9. Events

Date/time and exact location are required. RSVP with notifications to the host. City-level calendars are public.

## 10. Faves (recommendations)

- Recommendations come only from **verified neighbours**: "No stars. No paid reviews. No anonymous voices."
- Businesses get a page (`/pages/…`), and neighbours "Fave" them.
- The 2025 AI layer summarises years of recommendation threads, and you can ask a question like "best place to hike with kids".
- Annual **Fave Awards** voted by neighbours.

## 11. Local News & Public Services

- **Local News:** a publisher feed. Each item has a verified publisher badge, headline, image, "Read article", and like/comment.
- **Public Services / agencies:** police, council and fire have official pages and can post to neighbourhoods.

## 12. Profiles, messaging, trust

- **Profile:** photo, bio, pronouns, **"resident since"**, hometown, occupation, interests. There's a Send message button, and privacy controls decide who can see your profile and who can DM you.
- **Neighbours** directory page.
- **Verification:** address verified by postcard code, phone, or a third-party identity check.
- **Moderation:**
  - Volunteer **Neighbourhood Leads / Community Reviewers** vote on reported content.
  - A **Kindness Reminder** detects harmful language before posting and prompts an edit. 36% of those prompted edited or withheld, and guideline violations fell 15%.

---

## 13. Adapting for Nigeria

| Nextdoor | myHoodora adaptation | Why |
| --- | --- | --- |
| Postcard verification | **GPS check (exists)** + phone OTP + **estate/CDA admin code** + invite from a verified neighbour + utility-bill upload (later) | Postal delivery isn't dependable enough for codes |
| Alert categories: Safety, Outages, Weather, Fires, Traffic | **Security · Power · Water · Flooding · Traffic · Fire · Scam warning** | Daily realities: NEPA/band tariffs, go-slow, flooding season, "one chance" and online scams |
| Local News publishers | Later: local outlets + **estate management / residents' association notices** | Estate announcements are the most-read "news" in gated estates |
| Public agencies | Later: **LGA, police division, LASEMA / SEMA, FRSC, DisCo (power company)** pages | Same model, local bodies |
| Local Faves (businesses) | **Trusted artisans & services**: electrician, plumber, generator repairer, tailor, mechanic, cleaner, caterer | Finding a reliable artisan by word of mouth is a core pain point |
| For Sale & Free, prices in $ | **₦**, "Free", "Negotiable" flag, safety tip "Meet at the estate gate / a public place" | Local norms |
| Chats (in-app DMs) | Interim: optional **"Chat on WhatsApp"** link on listings (the seller chooses to show it). In-app chat later | Everyone already uses WhatsApp; it avoids building chat before launch |
| Link previews | **OG metadata + image on `/p/[id]` and listings** | Sharing happens on WhatsApp; the preview is the ad |
| Heavy media feed | **Data-light**: compressed images, no autoplay, a "Lite" feel on 3G | Mobile data is expensive |
| "Neighbourhood" | Support both **estates** (gated, admin-run) and **open neighbourhoods** (e.g. a Yaba street cluster) | How Nigerian communities actually organise |

---

## 14. What we'll deliberately **not** copy

- Sponsored cards in the right rail. There's no ads business pre-launch, and they make the product feel cheap.
- Nav items for sections we can't back yet (Local News, Public Services, Chats), until each has real content. Dead links erode trust faster than missing ones.
- Nextdoor's green-on-white look. We build our own identity (see target architecture).
- Underscore URLs (`news_feed`). We use hyphens, the web convention.

---

## Sources

- User screenshots, nextdoor.co.uk, 2026-09-26 (`~/Desktop/Screenshot 2026-09-26 at 22.34.08 / 22.34.47 / 22.35.14 / 22.35.25 / 22.39.48`)
- nextdoor.com `robots.txt` and `/neighborhood/soma--san-francisco--ca/` (fetched 2026-09-28)
- [Nextdoor developer docs — Create post (share URL `/p/{post_share_id}`)](https://developer.nextdoor.com/reference/create-post)
- [Nextdoor help — Sort your newsfeed](https://help.nextdoor.com/s/article/How-to-sort-your-newsfeed?language=en_US)
- [Nextdoor help — Who can see what I post?](https://help.nextdoor.com/s/article/Visibility-on-Posts-Made-to-Anyone?language=en_US)
- [Nextdoor help — React to a post](https://help.nextdoor.com/s/article/How-to-react-to-a-post?language=en_US)
- [Nextdoor help — What should I post about?](https://help.nextdoor.com/s/article/What-should-I-post-about-on-Nextdoor?language=en_US)
- [Nextdoor help — For Sale and Free guidelines](https://help.nextdoor.com/s/article/Best-practices-For-Sale-Free?language=en_US)
- [Nextdoor help — Join a group](https://help.nextdoor.com/s/article/join-a-group?language=en_US)
- [Nextdoor help — Notification settings](https://help.nextdoor.com/s/article/Adjust-your-notification-settings-on-Nextdoor?language=en_US)
- [Nextdoor — Meet the new Nextdoor (2025)](https://about.nextdoor.com/press-releases/meet-the-new-nextdoor)
- [TechCrunch — Nextdoor redesigns app with AI recommendations, local news, real-time alerts (2025-07-15)](https://techcrunch.com/2025/07/15/nextdoor-redesigns-app-with-ai-recommendations-local-news-and-real-time-emergency-alerts)
- [TechCrunch — Nextdoor revamps with new profiles, feed (2022)](https://techcrunch.com/2022/02/15/nextdoor-revamps-with-new-profiles-feed-and-more-community-building-features/)
- [Nextdoor — ThankANeighbor feature](https://www.businesswire.com/news/home/20231103980228/en/Celebrate-National-Gratitude-Month-With-New-ThankANeighbor-Feature-from-Nextdoor)
- [Nextdoor Blog — Introducing Local Faves](https://blog.nextdoor.com/small-business-improvements)
- [Nextdoor — Kindness features](https://about.nextdoor.com/press-releases/nextdoor-launches-new-neighbor-features-to-increase-transparency-and-encourage-constructive-conversations)
- [Nextdoor Blog — How moderation works](https://blog.nextdoor.com/2021/02/10/how-moderation-works-on-nextdoor)
- [Nextdoor — Verify your address](https://nextdoor.desk.com/customer/en/portal/articles/805357-verify-your-address)
