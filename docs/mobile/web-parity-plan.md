# Mobile: catching up with the web

_Agreed 28 October 2026 on the `feed-redesign` branch. Ticked when built and checked on a phone._

## Order

1. [x] **Navigation.** Bottom bar: Home · For Sale · Menu, with Post where it is. One top bar on every tab: Search, Notifications, Messages (with unread counts). Menu holds your profile, Groups, Events, Alerts, Saved, Settings, Help.
2. [x] **Groups.** Browse, create, join or request, leave, posts inside a group, invite neighbours. Admins: edit, members, requests, roles, delete. API §8; members and requests now carry name and photo (additive). Checked on the Xiaomi 28 Oct.
3. [x] **Events.** Events list (Upcoming / Past), create an event with an in-app date and time picker, RSVP Going or Interested from the feed, the post or the list; reminders are the API's (§23). Checked on the Xiaomi 28 Oct. Not done: "Add to calendar" (needs a native calendar module and a rebuild).
4. [x] **Polls.** Vote, change or take back a vote, results with exact percentages, create a poll (2–4 choices, open 1 day, 3 days or a week). Checked on the Xiaomi 28 Oct.
5. [x] **Your listings.** On your own listing: Available, Pending or Sold (Given away when free) in one tap, and Delete. Marking sold sends the "sold" signal (feedback questions, store review). Checked on the Xiaomi 28 Oct.
6. [x] **Messages.** One tap from every tab. Search, filters (All · Unread · Buying & selling · Archived), New message (find a neighbour), hold a chat to archive, mute (8 hours, a week, until turned back on) or delete it for you; inside a chat: day lines, "Seen", the listing it's about, photos (up to 4), and the same options plus Report. Backend additions are additive (API §5). Checked on the Xiaomi 28 Oct, except sending a photo (needs your gallery; try it).
7. [ ] **First-run tour (last, after everything above).** A tour that points at the real controls, like the web's `features/tour`, replacing the intro slides' job of explaining the app.

## Notes from testing

- Posts made before 2026-10 keep their category inside the text; `pnpm migrate` moves it into its own field. The local copy needed it for old events to show under Events. **Production needs it too** (already on the launch list).
- A development-only warning appears on a cold start ("Can't perform a React state update on a component that hasn't mounted yet", from Expo Router's root). Not from these screens; to look into.

## Also missing, not scheduled

- Alerts page with map and "mark resolved".
- Hood Leads review queue; your decisions and appeals.
- Business claim and Hoodora AI pilot pages; the public info pages (the app can link to the web for these).
