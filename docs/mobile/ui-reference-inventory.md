# Mobile: UI reference inventory

The reference is the running web app (`apps/web`) and its source. The web already has a mobile layout below 1024 px (bottom tab bar, sheets), which is the closest model for the native app. Values below were read from source on 20 October 2026. Screenshots of the running app are **still to be captured** (Phase 2, Step D).

## Tokens (confirmed, from `apps/web/src/app/globals.css` and `brand/…/08_Guidelines/myhoodora_palette.json`)

### Brand

| Token | Value | Note |
| --- | --- | --- |
| `brandTeal` | `#147C73` | Brand; also the splash and app-icon background (ADR-010) |
| `brandCoral` | `#FF6B5B` | Decorative only (2.8:1 on white), never text |
| `brandCoralInk` | `#A62C1D` | Coral used for text |
| `brandGray` | `#F2F2F2` | Off-white |
| `brandInk` | `#1B2B29` | |

### Semantic (light / dark)

| Token | Light | Dark |
| --- | --- | --- |
| `background` | `#ffffff` | `#0f1514` |
| `foreground` | `#171717` | `#e8eeec` |
| `card` / `cardForeground` | `#ffffff` / `#171717` | `#171e1d` / `#e8eeec` |
| `popover` / `popoverForeground` | `#ffffff` / `#171717` | `#1b2322` / `#e8eeec` |
| `primary` / `primaryForeground` | `#11706a` / `#ffffff` | `#3ebdb0` / `#052b27` |
| `secondary`, `muted`, `accent` | `#f2f2f2` | `#222b2a`, `#222b2a`, `#26302e` |
| `mutedForeground` | `#696969` | `#a3b0ad` |
| `destructive` / `destructiveForeground` | `#dc2626` / `#ffffff` | `#ef4444` / `#ffffff` |
| `success` / `successSoft` | `#15803d` / `#dcfce7` | `#4ade80` / `#12301f` |
| `warning` / `warningSoft` | `#b45309` / `#fef3c7` | `#fbbf24` / `#3a2a0b` |
| `info` / `infoSoft` | `#1d4ed8` / `#dbeafe` | `#7fb0ff` / `#16264a` |
| `dangerSoft` | `#fee2e2` | `#3b1717` |
| `canvas` (behind cards) | `#f4f5f4` | `#0b100f` |
| `border`, `input` | `#e5e7eb` | `#2b3533` |
| `ring` (focus) | `#11706a` | `#3ebdb0` |

Theme: the signed-in app follows **System / Light / Dark** (Settings → Account; `lib/theme.ts`). Mobile does the same with `useColorScheme` plus the stored preference. Auth screens are light-only on the web; whether they stay light on mobile is a Phase 2 decision.

### Type

- **Outfit** for everything (`next/font/google`). Weights: display/h1/h2 `700`; h3, buttons and labels `600`; body `400`. JetBrains Mono for monospace (rare).
- Mobile: `@expo-google-fonts/outfit` (400, 600, 700). Size scale to be read from Tailwind classes in use (`text-[11px]` tab labels, `text-sm` 14, `text-base` 16, and so on). To do in Phase 2.

### Shape and spacing (sampled, not exhaustive)

- Buttons (`packages/ui/src/button.tsx`): `rounded-xl` (12) at every size; padding sm `20×8`, default `16×12`, lg `32×16`.
- Cards (`post-card.tsx`): `rounded-2xl` (16), 1 px `border`, `bg-card`, `shadow-xs`, on a `canvas` background.
- Pills and badges: `rounded-full`, `px-2 py-0.5`, 11 px semibold.
- Spacing follows Tailwind's 4 px scale.
- Bottom bar height 64 (`h-16`). Icons are 24 at stroke 1.8, or 2.4 when active.

### Icons and assets

- Icons: **lucide** (`lucide-react` on the web), so use `lucide-react-native` on mobile.
- Logos (SVG): `apps/web/public/logo/` holds `mark`, `logo-horizontal`, `logo-stacked`, `wordmark` and `mascot-*`, each with a `-reversed` variant.
- App icons: there are none for the store yet (ADR-010).

## First launch and sign-in (built 20 October 2026)

```text
splash ─► intro (3 slides, only on a fresh install or after the app's data is cleared; Skip on every slide)
       ─► welcome (photo hero, as the web's landing hero) ─► Get started → register · I already have an account → login
       ─► login / register / reset (photo header, form on a rounded sheet)
```

- **Intro:** copy from the web's landing page. The visuals are the mascot roof, two of the web's own app mockups (captured from `/` and `/business` by `apps/mobile/scripts/capture-web-screens.mjs`), and the web's photography. It is three slides at most, always skippable, and never a tutorial.
- **"Seen" flag:** kept in app storage (`intro.seen.v1`), so uninstalling or clearing data shows the intro again. A first launch also signs out a session left in the iOS Keychain by an earlier install.
- **Continue with Google** is on login and register (Google decides whether the account is new). It uses the same Firebase Google provider as the web, so it is the same account. It needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (the web's client ID) and, on iOS, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` plus a new build. Without them the button says it isn't set up yet. Facebook and Apple are not offered: the backend doesn't support them.
- **Fields** follow common form guidance: the label stays visible above the field, the placeholder is only an example, the error appears below with an icon after a submit and clears as the field is edited, the field has a fixed height of at least 48 pt, and the password field has a show/hide button.
- **Icon and splash:** the mascot lockup on white (`mascot-lockup-1024.webp`, the same art as the web's sign-in pages). The mascot wordmark stays in the feed header, onboarding and the welcome screen.
- **Preview intro** (welcome screen, top left, never in production builds) replays the intro for testers.

## Navigation model (from `components/layout/app-shell/mobile-tab-bar.tsx`)

The web's narrow-screen layout is **Home · For Sale · [＋ Post] · Alerts · More**. The centre button opens the composer. "More" is a sheet with: Events, Groups, Messages, Notifications, Your profile, Settings, Help centre, and Log out.

Mobile proposal: the same five-slot bottom tab bar using Expo Router `Tabs`, with the ＋ opening the composer as a modal route and "More" as a stack screen. The header shows the Hood name, search and notifications. This keeps the same information architecture as the web (and the Nextdoor model it follows, `docs/product/nextdoor-research.md`).

## Screen inventory

Routes from `apps/web/src/app` and `lib/routes.ts`. "Phase" is when mobile builds the screen.

| Web route | Screen | Primary action | Phase | Mobile notes |
| --- | --- | --- | --- | --- |
| `/login` | Log in | Email/password, Google | 4 | Native Google sign-in (ADR-003). No One Tap |
| `/register` | Create account | Sign up | 4 | |
| `/forgot-password` | Reset | Send reset email | 4 | The email link opens the web `/reset-password` (fine for now) |
| `/verify-email` | Confirm email | Token from email | 6 | The email link opens the web. A banner nudge in the app |
| `/onboarding` | Address verification | Confirm Hood | 6 | GPS plus pin (ADR-007). Until then, the slice shows "finish joining your Hood" with a link to the web |
| `/news-feed` | Hood feed | Read, react, post | **4** (read) / 6 (compose) | Infinite list, pull to refresh, "N new posts" pill |
| `/p/[id]` | Post detail + comments | Comment | 4 (read) / 6 | |
| `/alerts` | Alerts | Resolve alert | 6 | |
| `/events` | Events | RSVP | 6 | |
| `/for-sale`, `/for-sale/[id]` | Listings | List an item | 6 | Camera or library picker for photos |
| `/groups`, `/groups/new`, `/g/[id]`, `/g/[id]/manage` | Groups | Join, post | 6 | |
| `/inbox`, `/inbox/[id]` | Messages | Send | 6 | |
| `/inbox/support`, `/inbox/support/[id]` | Support threads | Reply | 6 | |
| `/notifications` | Notifications | Open, mark read | 6 | |
| `/profile/[uid]` | Profile | Message, block | 6 | |
| `/search` | Search | Query | 6 | |
| `/settings/*` (profile, account, neighbourhood, notifications, privacy, moderation) | Settings | Edit | 6 | Includes sign out everywhere and deactivate |
| `/leads` | Hood Lead tools | Moderate | Later | |
| `/help` | Help | Contact support | 6 | |
| `/admin/*` | Staff portal | — | **Never** (web only) | |
| Marketing and legal pages | — | — | Never | Link out to the web for Terms and Privacy |

For each screen, Phase 2/6 records the loading, empty, error, offline and success states seen on the web, plus its fields and validation. Shared states (skeleton, `ErrorState` with retry, `EmptyState`, offline banner) come first.

## Copy

The voice is plain British English (for example "neighbour", "Hood", "Log in again"). Reuse the web's strings, especially `FRIENDLY_MESSAGES` and validation text, so that the same failure reads the same on both platforms.
