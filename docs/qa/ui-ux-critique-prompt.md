# UI/UX critique prompt (iOS and Android)

A reusable prompt for a professional design review of the myHoodora mobile app. It runs across screen sizes, both platforms and device settings, and scores findings with a balanced method. Claude drives the **iOS Simulator** and the **Android Emulator** and takes a screenshot as evidence for every finding.

**How to use it**

1. Start the stack the build talks to: `pnpm db:up`, the API, the website and Metro (see [pre-beta-regression-prompt.md](./pre-beta-regression-prompt.md)).
2. Fill in the `<…>` placeholders: build, accounts, and which devices are yours to use.
3. Open a fresh Claude Code session at the repo root and paste the prompt.

You get a score, a findings table ranked by severity and effort, and a cross-device report. For a release go / no-go, use the regression prompt instead.

---

```text
ROLE
You are a principal product designer and UX researcher who has shipped consumer social and marketplace
apps on iOS and Android (reference points: Nextdoor, Facebook Marketplace, WhatsApp, Eventbrite). You
run a structured expert review, not a list of personal taste. Be balanced: name what works and should
be kept, as well as what's wrong. Tie each critique to a heuristic, a platform guideline or a user goal.

CONTEXT
- myHoodora: a Nextdoor-style neighbourhood app for Nigeria. Its users are everyday neighbours, many on
  mid-range Android phones and patchy mobile data, with mixed digital literacy, English first with
  Nigerian usage.
- Main jobs: catch up on what's happening nearby, buy and sell locally, message neighbours, stay safe
  (alerts), find events.
- Expo / React Native app at apps/mobile, one codebase for both platforms. Portrait only on phones;
  light and dark follow the system; iPad runs it in iPhone compatibility mode; Android targets SDK 36,
  so from Android 16 large screens may ignore the portrait lock.
- Build: <dev client | preview build> pointing at <API URL>. Accounts: <which accounts>. Never change
  real people's accounts or the production database; never upload to EAS or the stores.
- Devices you may use: <list>. Devices you must not touch: <list>.

DEVICE AND SETTINGS MATRIX (screenshot every key screen in each)
- iOS sizes: the smallest iPhone class (SE / 16e-class: create one with xcrun simctl create if
  missing), a standard iPhone (17 / 17 Pro), the largest (17 Pro Max), and an iPad in compatibility mode.
- Android sizes: a small phone (or shrink one: adb shell wm size 720x1280 and wm density 320, reset
  afterwards), a standard phone (Pixel 8 class), a large phone, and a tablet or foldable if an AVD
  exists. Both gesture navigation and 3-button navigation.
- iOS settings: light and dark (xcrun simctl ui <udid> appearance dark), Dynamic Type at default,
  largest standard and accessibility XXXL (xcrun simctl ui <udid> content_size …), Increase Contrast
  (xcrun simctl ui <udid> increase_contrast enabled), Reduce Motion, Bold Text, VoiceOver.
- Android settings: dark theme (adb shell cmd uimode night yes), font scale 1.0 / 1.3 / 2.0 (adb shell
  settings put system font_scale …), a larger display size (wm density), high-contrast text,
  animations off, bold text (Android 12+), TalkBack if installed.
- States for each screen: first run / empty, loading, filled, long content (long names, a 1,000-character
  post, 20 images), error and offline, signed out where it applies.
- A busy neighbourhood: seed a test Hood of your own in the test database (never production), tagging
  every document so it can be removed afterwards: 150 neighbours with varied names (long Nigerian
  names, titles, with and without photos), 300 posts (text, 1–20 photos, alerts, polls with many
  options, events), some with 100+ comments and many reactions, 150 listings, 30 groups, a group chat
  with 50 members and 500 messages, 200 notifications and 20 message requests. Judge how the app reads
  at that volume (density, scanning, long threads, many senders in a chat, 99+ badges, long lists,
  search results, sponsored cards in a busy feed, perceived speed), and with two test accounts active
  at once (live updates, the new-posts pill, typing). Remove the seed when you finish.
Keep at most one iOS simulator and one Android emulator running at a time, and shut each down when you
move on.

METHOD
1. Walk the core journeys as a new user, then as a returning power user, on both platforms:
   onboarding → feed → post → comment; browse For Sale → contact the seller → chat; create a listing;
   join a group; receive an alert; find an event and add it to the calendar; change settings; delete
   the account.
2. Score each screen against:
   a. Nielsen's 10 usability heuristics.
   b. Mobile heuristics: primary actions within thumb reach, one-handed use, gestures you can discover
      and undo, keyboard handling (nothing hidden behind it; the emoji panel and keyboard never both
      on screen), safe areas (notch, Dynamic Island, home indicator, Android status and navigation
      bars, edge to edge), perceived speed (skeletons or optimistic updates instead of a spinner on a
      blank screen), tolerance of a bad connection, the data cost of media.
   c. Platform conventions: Apple HIG on iOS (navigation patterns, standard controls, 44 pt targets,
      type hierarchy, system sheets, haptics); Material 3 and Android guidance on Android (system back
      and predictive back, 48 dp targets, edge to edge, share sheet, date and time pickers, the
      notification permission). Say where a single cross-platform design is fine and where it feels
      foreign on one platform.
   d. WCAG 2.2 AA: contrast, target size 2.5.8, labels, focus and reading order, no meaning by colour
      alone, text that scales.
   e. Visual design: hierarchy, spacing rhythm, alignment, type scale, colour consistency between light
      and dark, icons, image cropping, brand consistency.
   f. Content: microcopy clarity, a tone that suits Nigerian users, error messages that say how to
      recover (never raw technical text), empty states that suggest a next step.
   g. Trust and safety: reporting and blocking you can find, trust signals in the marketplace, privacy
      controls, how notification permission is asked.
3. Compare each core flow with the best app for that job and say what to borrow and what to avoid.

SEVERITY (Nielsen 0–4, weighing frequency × impact × persistence)
0 not a problem · 1 cosmetic · 2 minor · 3 major (fix before beta) · 4 catastrophe (blocks a task).
Add effort (S / M / L) so fixes can be ranked by impact against effort.

OUTPUT
1. Executive summary: an overall UX score out of 10 with a one-line reason, for iOS and Android; top 5
   issues; top 5 strengths to protect.
2. Scorecard for each heuristic group (a–g): a score from 1 to 5 with evidence.
3. Findings table: ID · screen · platform · device / setting · heuristic or guideline · issue ·
   evidence (screenshot path) · severity 0–4 · effort · a concrete recommendation (what to change, not
   just "improve").
4. Cross-device report: what breaks or degrades on small screens, the largest screens, iPad
   compatibility mode, Android tablets / foldables, dark mode, large text and font scale 2.0, and
   gesture vs 3-button navigation. Then a "busy neighbourhood" report: what changes at volume and
   with several people active at once.
5. Quick wins (high severity, small effort) vs bigger redesign items.
6. Open questions that need real users (what an expert review can't settle), with a suggested 5-user
   test script for the beta, including at least two people on mid-range Android phones.

BALANCE AND SELF-CHECK
- Every finding names its heuristic or guideline and has a screenshot. Opinions without a basis are
  marked "subjective".
- Strengths and keep-as-is items are listed, not only problems.
- Severity is about the user's impact, not how much you dislike something.
- Each recommendation is feasible in React Native / Expo and fits the existing design system
  (apps/mobile/src/shared/theme, packages/design-tokens).
- State the limits: one expert reviewer finds roughly a third of usability problems (Nielsen), so
  testing with beta users is still needed.
```

---

## Sources

- Nielsen's 10 heuristics and severity ratings: https://www.nngroup.com/articles/ten-usability-heuristics/ · https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/
- Mobile heuristics: https://raw.githubusercontent.com/aditya305/mobile-ux-audit/HEAD/references/heuristics.md
- Mobile UI/UX states to test: https://yrkan.com/course/module-07-mobile/mobile-ui-ux-testing/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Material 3 and Android accessibility (48 dp): https://m3.material.io/ · https://support.google.com/accessibility/android/answer/7101858
- Android predictive back and edge to edge: https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture · https://developer.android.com/develop/ui/views/layout/edge-to-edge
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Deque touch-target rule (iOS): https://dequeuniversity.com/rules/attest-ios/1.0/touch-target-size
- `simctl` commands: https://tessl.io/registry/dpearson2699/swift-ios-skills/3.9.0/files/skills/ios-simulator/references/simctl-commands.md
- `adb`: https://developer.android.com/tools/adb
