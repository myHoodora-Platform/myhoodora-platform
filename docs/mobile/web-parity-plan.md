# Mobile: catching up with the web

_Agreed 28 October 2026 on the `feed-redesign` branch. Ticked when built and checked on a phone._

## Order

1. [x] **Navigation.** Bottom bar: Home · For Sale · Menu, with Post where it is. One top bar on every tab: Search, Notifications, Messages (with unread counts). Menu holds your profile, Groups, Events, Alerts, Saved, Settings, Help.
2. [x] **Groups.** Browse, create, join or request, leave, posts inside a group, invite neighbours. Admins: edit, members, requests, roles, delete. API §8; members and requests now carry name and photo (additive). Checked on the Xiaomi 28 Oct.
3. [x] **Events.** Events list (Upcoming / Past), create an event with an in-app date and time picker, RSVP Going or Interested from the feed, the post or the list; reminders are the API's (§23). Checked on the Xiaomi 28 Oct. Not done: "Add to calendar" (needs a native calendar module and a rebuild).
4. [x] **Polls.** Vote, change or take back a vote, results with exact percentages, create a poll (2–4 choices, open 1 day, 3 days or a week). Checked on the Xiaomi 28 Oct.
5. [x] **Your listings.** On your own listing: Available, Pending or Sold (Given away when free) in one tap, and Delete. Marking sold sends the "sold" signal (feedback questions, store review). Checked on the Xiaomi 28 Oct.
6. [x] **Messages.** One tap from every tab. Search, filters (All · Unread · Buying & selling · Archived), New message (find a neighbour), hold a chat to archive, mute (8 hours, a week, until turned back on) or delete it for you; inside a chat: day lines, "Seen", the listing it's about, photos (up to 4), and the same options plus Report. Backend additions are additive (API §5). Checked on the Xiaomi 28 Oct, except sending a photo (needs your gallery; try it).
7. [x] **Alerts.** `/alerts` from Menu: a map of your neighbourhood (MapLibre with OpenFreeMap tiles, as on the web; no API key), filters per kind with active counts, Active now (urgent first) and Earlier this week. The feed shows an "N active alerts" card grouped by kind. Your own alert's menu has Mark as resolved / Reopen (`PATCH /posts/:id/alert`). Alerts carry no location yet, so no pins (same as the web).
8. [x] **Hood Leads, decisions and appeals.** `/leads` (Hood Leads only, shown in Menu with the number waiting): vote Keep, Not sure or Remove. `/settings/moderation` (Settings → Decisions & appeals): decisions about you and your reports, and an appeal form. Both paths match the web's, so moderation notifications open them. Types added to `@myhoodora/api-contract` (additive).
9. [x] **Business, AI and public pages.** Menu → "More from myHoodora" opens the web's Business, AI, Safety and About pages in the browser (they're written for the web and change there).
10. [x] **First-run tour (last).** Coach marks over the real controls, like the web's `features/tour`: the feed filters, the top bar, Post, For Sale, Menu. Shown once to a newcomer once they're in their neighbourhood (same "pending / started / completed / skipped" rule as the web), replacing the static welcome card. Settings → Take the tour again.

Also improved on the way: forms keep the field you're typing in above the keyboard (`react-native-keyboard-controller` in the composer, Sell and the group form); the splash follows the phone's light or dark mode; `pnpm --filter @myhoodora/mobile device:link` keeps a phone's `adb reverse` ports in place, so a development build no longer sticks on the splash after the phone reconnects.

## Notes from testing

- Posts made before 2026-10 keep their category inside the text; `pnpm migrate` moves it into its own field. The local copy needed it for old events to show under Events. **Production needs it too** (already on the launch list).
- A development-only warning appears on a cold start ("Can't perform a React state update on a component that hasn't mounted yet", from Expo Router's root). Not from these screens; to look into.

## Also missing, not scheduled

- Business claim and the business sign-up form inside the app (they open on the web).
- ~~Alert pins on the map~~: done 28 Oct (88dac39), in the app and on the web.
- ~~"Add to calendar" for events~~: done 29 Oct. Shown once you're going or interested; opens the phone's own new-event screen (expo-calendar, needs a new build), or Google Calendar's page in an older build.
