# Google Play store listing

_Prepared 6 November 2026 for section 3 of [play-store-release.md](./play-store-release.md). Paste each field into Play Console → Grow users → Store presence → Main store listing._

Every claim below was checked against the app's code on 6 November 2026. If a feature changes, change the text: Google rejects listings that promise what the app doesn't do.

## App details

| Field | Value | Length |
| --- | --- | --- |
| App name | `myHoodora` | 9 / 30 |
| Short description | `Your neighbourhood, connected: local news, alerts, tips and things for sale.` | 76 / 80 |
| Category | Social | |
| Tags | Community, Local news, Social network (choose up to 5 in Play Console from Google's list) | |
| Contact email | hello@myhoodora.com (public on the listing) | |
| Website | https://www.myhoodora.com | |
| Privacy policy | https://www.myhoodora.com/privacy | |

## Full description

2,154 of 4,000 characters. No emoji, no keyword lists, no claims about other apps (Google's metadata policy).

```text
myHoodora is the private network for your neighbourhood. Join the neighbours who actually live around you to share what's happening, look out for each other and get things done locally.

EVERY NEIGHBOUR IS A REAL NEIGHBOUR
Everyone joins a neighbourhood by confirming where they live, so the people you hear from live close by. We never show your address, street, house number or exact location to anyone. Neighbours see your name, your neighbourhood and what you choose to share.

WHAT YOU CAN DO
• Hood feed: news, questions and updates from people near you, with filters for what you care about.
• Safety alerts: warn neighbours quickly about something urgent, and see recent alerts on a map of your area.
• Recommendations: ask for a trusted plumber, tailor, mechanic or doctor, and share the ones you'd vouch for.
• Lost & found: find a missing pet, phone or parcel with help from the street.
• For Sale & Free: sell, give away or pick up things nearby, with photos, prices and a quick "Is this still available?".
• Messages: chat one to one or in groups, with message requests you can accept or decline.
• Events and groups: see what's on locally and join groups for your estate, street or interests.
• Thanks: say thank you publicly to a neighbour who helped.
• Notifications: choose what you hear about. Urgent alerts always reach you.

KIND BY DESIGN
A kindness reminder nudges you before you post something that might come across badly. Anyone can report a post, comment, listing or person, and our team reviews every report. You can block anyone, and choose who can see your profile and who can message you.

YOUR DATA, YOUR CHOICE
We follow the Nigeria Data Protection Act 2023. You can ask for a copy of your data, deactivate your account for a break, or delete it from Settings at any time.

WHERE WE ARE
myHoodora is live in neighbourhoods across Lagos and Ibadan, with more cities on the way. Don't see your area yet? Ask to join and we'll let you know when it opens.

myHoodora is free to use. You must be 18 or over to join.

Questions or ideas? Write to hello@myhoodora.com or visit myhoodora.com.
myHoodora is operated by MYHOODORA LIMITED (RC 9546341), Lagos, Nigeria.
```

## Graphics

All in [`apps/mobile/store/`](../../apps/mobile/store/).

| Asset | File | Requirement | How it's made |
| --- | --- | --- | --- |
| App icon | `icon-512.png` | 512 × 512, 32-bit PNG, up to 1 MB | `sips -z 512 512` from `apps/mobile/assets/images/icon.png`. Play adds the rounded mask and shadow itself |
| Feature graphic | `feature-graphic.png` | 1024 × 500, JPEG or 24-bit PNG, no transparency | `src/feature-graphic.html`, rendered by `src/render.mjs` (from `apps/web`: `node ../mobile/store/src/render.mjs`). Words kept left and away from the edges, because Play crops and may draw a play button in the middle |
| Phone screenshots | `screenshots/final/1-…8-*.png` | 2 to 8, 16:9 or 9:16, each side 320–3840 px | Real screens from a Redmi 14C at 1080 × 2160 (2:1), see below |

## Screenshots

Upload `screenshots/final/` in file order (the first three show in search results, so they carry the story):

1. **Alerts and feed** (`1-alerts`): "2 active alerts in Yaba" (Security, urgent; Power), then the urgent post with its place.
2. **For Sale & Free** (`2-for-sale`): the photo grid.
3. **Messages** (`3-messages`): a chat about the armchair listing, with a price offer.
4. **Group chat** (`4-group-chat`): "Montgomery Road neighbours" with water updates and the gate levy reminder.
5. **Event** (`5-event`): Yaba Clean-Up Saturday with its date card, "Going 17" and Add to calendar.
6. **Groups** (`6-groups`): five local groups.
7. **Notifications** (`7-notifications`): a message, an urgent alert, comments and an event reminder.
8. **Neighbourhoods** (`8-neighbourhoods`): home Yaba, followed Somolu, "Neighbours see your neighbourhood's name, never your address."

Spares in `screenshots/`, to swap in or use elsewhere (website, social posts):

- The welcome screen and three intro slides (`phone-0` to `phone-3`).
- A listing page (`phone-7`), the post composer (`phone-9`) and Settings → Privacy (`phone-11`).
- The inbox (`phone-14`) and the alerts map (`phone-16`).
- The events list (`phone-17`) and Dami's profile (`phone-18`).
- The Somolu feed (`phone-20`) and the poll with results (`phone-21`).

Rules: made-up neighbours only (`example.invalid` addresses, initials instead of faces), never a real member's name, face or address; status bar clean; light theme; no debug overlays; every photo matches its words.

Photos in the shots: the website's own images (`apps/web/public/images`) and Cloudinary's public demo samples (`res.cloudinary.com/demo/.../samples/...`). **Check the licence of the Cloudinary samples before uploading**, especially the bicycle photo in `2-for-sale`, which shows a person. If in doubt, swap them for photos you own and re-run the seed.

### How they were captured

- Local API (`apps/api`, port 3001) against the local Docker database, which is a copy of production. Only made-up neighbours are ever on screen.
- Demo content made by [`apps/mobile/store/src/store-seed.js`](../../apps/mobile/store/src/store-seed.js), **in the local database only**. It adds 25 made-up neighbours in Yaba and Somolu, 16 posts with comments, reactions, a poll and RSVPs, 9 listings, 5 chats, 6 groups and 6 notifications, all tagged `storeShot: true`. It hides Yaba's old test posts, listings and groups (`storeShotHidden: true`) and renames the signed-in account "Dami Okoro". Re-runnable.
- To undo everything: `docker exec myhoodora-mongo mongosh myhoodora --eval 'db.neighborhoods.updateOne({_id: ObjectId("6ae33231dea11b31ddca684e")}, {$set: {name: "QA UX Hood"}}); ["posts","listings","comments","reactions","groups","group_members","group_posts","rsvps","conversations","messages","notifications","poll_votes","users"].forEach(c => db[c].deleteMany({storeShot: true})); db.posts.updateMany({storeShotHidden: true}, {$set: {isActive: true}, $unset: {storeShotHidden: ""}}); db.listings.updateMany({storeShotHidden: true}, {$set: {removedAt: null}, $unset: {storeShotHidden: ""}}); db.groups.updateMany({storeShotHidden: true}, {$set: {archivedAt: null}, $unset: {storeShotHidden: ""}}); db.users.updateOne({email: "myhoodora+qa-store@gmail.com"}, {$set: {displayName: "QA Store"}})'`.
- Signed in as `myhoodora+qa-store@gmail.com`, created by a person on the phone on 6 November 2026 (Claude doesn't type passwords into Firebase sign-in). Home Yaba, following Somolu, verified, all set in the local database. It's a real Firebase account: delete it before launch with the other QA accounts.
- Redmi 14C over wireless adb, development build, `adb reverse` for ports 3001, 8081 and 3000. Its screen is 720 × 1640 (taller than Play's 2:1 limit), so the shots used `adb shell wm size 1080x2160` and `wm density 480`, with demo mode for a clean status bar. Reset afterwards: `wm size reset`, `wm density reset`, `am broadcast -a com.android.systemui.demo -e command exit`.

## Demo content for Google's reviewer

Google's reviewers sign in from outside Nigeria, so the reviewer account lives in a demo Hood instead of a real one. [`apps/mobile/store/src/review-seed.js`](../../apps/mobile/store/src/review-seed.js) adds, to the database the API uses:

- Three demo Hoods, "Agege (Demo)", "Ikorodu (Demo)" and "Yaba (Demo)", placed 35 km out at sea south of Lagos. No real address can be matched into them and they are never "nearby" a real Hood (5 km), so real members never see them, their people or their posts (search is per Hood too).
- 24 demo neighbours (`example.invalid` addresses, all emails and push off), 18 posts based on that week's real local news, 46 comments, a poll, RSVPs, 6 listings, 3 groups.
- With `REVIEWER_EMAIL`: that account is placed in Agege (Demo), following Ikorodu (Demo), with 4 chats (a listing chat, a group chat, a direct chat and a message request) and 5 notifications.

Photos: Pexels (free licence, no attribution needed) and myhoodora.com's own images. Everything is tagged `reviewDemo: true`. Run it from the repo root:

```sh
mongosh "<MONGODB_URI>" --quiet --eval 'var REVIEWER_EMAIL = "<reviewer email>"; load("apps/mobile/store/src/review-seed.js")'
```

Remove it after the app is approved (and before any later review, re-run it so the dates are fresh). The reviewer account itself isn't deleted:

```sh
mongosh "<MONGODB_URI>" --quiet --eval '["posts","listings","comments","reactions","groups","group_members","group_posts","rsvps","conversations","messages","notifications","poll_votes","users","neighborhoods"].forEach(c => db[c].deleteMany({reviewDemo: true}))'
```
