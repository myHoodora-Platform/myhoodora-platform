# Mobile: catching up with the web

_Agreed 28 October 2026 on the `feed-redesign` branch. Ticked when built and checked on a phone._

## Order

1. [ ] **Navigation.** Bottom bar: Home · For Sale · Menu, with Post where it is. One top bar on every tab: Search, Notifications, Messages (with unread counts). Menu holds your profile, Groups, Events, Alerts, Saved, Settings, Help.
2. [ ] **Groups.** Browse, create, join or request, leave, posts inside a group, invite neighbours. Admins: edit, members, requests, roles, delete. API §8 (no backend change).
3. [ ] **Events.** Events list, create an event, RSVP going or interested, reminder. API §7 and §23.
4. [ ] **Polls.** Vote, change or take back a vote, results, create a poll.
5. [ ] **Your listings.** Mark reserved or sold, delete. The "sold" feedback signal and store-review moment fire from here.
6. [ ] **Messages.** New message (find a neighbour), search, filters (All · Unread · Buying & selling · Support), listing link, day separators, and three backend additions: photos in messages, archive or delete a chat for yourself, mute a chat. All additive: the web's current flow keeps working unchanged.
7. [ ] **First-run tour (last, after everything above).** A tour that points at the real controls, like the web's `features/tour`, replacing the intro slides' job of explaining the app.

## Also missing, not scheduled

- Alerts page with map and "mark resolved".
- Hood Leads review queue; your decisions and appeals.
- Business claim and Hoodora AI pilot pages; the public info pages (the app can link to the web for these).
