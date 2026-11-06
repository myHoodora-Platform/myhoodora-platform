# Releasing the Android app on Google Play

_Written 6 November 2026. Sources: Expo's [Submit to the Google Play Store](https://docs.expo.dev/submit/android/), Lines Tech's [How to publish an app on Google Play Store](https://www.linestech.com.ng/blog/how-to-publish-an-app-on-google-play-store/), and a check of `apps/mobile`, `docs/` and the EAS project on the same day._

Tick each box as it is done, and note the date. Items marked **(code)** need a change in this repository. Items marked **(you)** need a console, an account or a decision.

## Where we stand

| Area | State |
| --- | --- |
| App identity | ✅ `com.myhoodora.app`, version `1.0.0`, EAS project owned by `myhoodora-mvp`. The package name can never change after the first upload |
| Build profile | ✅ `production` in `eas.json` builds an `.aab` (no `buildType: apk`), `autoIncrement: true`, `appVersionSource: remote` (EAS keeps the versionCode) |
| Target API level | ✅ targetSdk 36, minSdk 24. Play requires 35 for new apps |
| EAS production env | ✅ checked 6 Nov: all `EXPO_PUBLIC_*` values, `GOOGLE_SERVICES_JSON`, Sentry. `EXPO_PUBLIC_APP_ENV=production`, API `https://myhoodora-mvp-api-n1id.onrender.com/api`, web `https://www.myhoodora.com`. `EXPO_PUBLIC_QA_TOOLS` isn't set, and the code turns QA tools off in production anyway |
| Push (Android) | ✅ FCM V1 key is on the EAS project |
| Signing key | 🟡 EAS made the keystore on 26 October 2026. Not backed up yet |
| `TODO` / `FIXME` comments in `apps/mobile` | ✅ none |
| EAS Submit | 🟡 `submit.production` sends to internal testing as a draft. No Google service account key yet (section 2) |
| Play account | Decided 6 November 2026: an **organisation** account, so no 14-day closed test |
| Store listing, declarations | ❌ not started |

## 1. Before the first production build

### Code and configuration

- [x] **(code) A public account-deletion page** (6 Nov). Play's Data safety form asks for a web link where someone can ask for their account and data to be deleted **without the app**. Now at `https://www.myhoodora.com/delete-account` (`apps/web/src/app/delete-account/page.tsx`): signed-out, with the steps in the app (Menu → Settings & privacy → Account → Delete account) and on the website, the email route (privacy@myhoodora.com, from the account's address), what is deleted and kept, and the 7-day grace. It's in the sitemap and the footer. **This is the link for the Data safety form.** It goes live with the next web deploy.
- [x] **(code) Remove permissions the app doesn't use** (6 Nov). `android.blockedPermissions` in `app.config.ts` removes `SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`, `USE_BIOMETRIC` and `USE_FINGERPRINT` (checked in the generated manifest). The storage permissions stay: on Android 12 and older (many budget phones) the photo picker can need them, and they're only requested up to Android 12. After the first upload, check the list in Play Console → App bundle explorer. The ones the app needs: location (coarse and fine), camera, notifications, internet, network state, vibrate, wake lock, boot completed (scheduled notifications), storage (Android 12 and older).
- [x] **(code) `submit.production` in `eas.json`** (6 Nov): `{ "android": { "track": "internal", "releaseStatus": "draft" } }`. No `serviceAccountKeyPath`: the key will be stored on EAS (section 2).
- [x] **(code) `expo-updates` installed** (6 Nov, `~57.0.27`), with `updates.url` set to the EAS project in `app.config.ts`. With the `appVersion` runtime policy, an update only reaches builds of the same `version`, so raise `version` whenever native code changes. The app checks for an update at launch and applies it on the next launch. **A local development build needs rebuilding** (`pnpm android`, or `expo prebuild --clean` first), because this is a native module.
- [x] **(code) Expo SDK 57 patch updates** (6 Nov): `expo` 57.0.32 and seven `expo-*` packages, plus `@expo/metro-runtime` and `react-dom` 19.2.3 added as direct dependencies. Without them, pnpm resolved `expo-router`'s web-only modules against the web app's React 19.2.0. `expo install --check` is clean and `expo-doctor` passes 21/21. The web app's own React is unchanged.
- [ ] **(you) Build from merged, committed code.** These changes are on the branch `play-store-prep`. Merge it into `main` and build from a clean checkout (`git status` empty). EAS uploads the working tree, so uncommitted files end up in the build.

### Backend and services the app depends on

- [ ] **(you) Turn real deletion on: `DATA_DELETION_MODE=live` on the API host.** In the default `dry-run`, nothing is deleted, so the new page, the privacy policy and the Data safety answer would all be untrue. Read a week of dry-run logs, take a backup, then switch (`docs/compliance/ndpa.md`, section 2).
- [ ] **(you) Deploy the API before the store build goes out.** The app relies on `/api/v1`, the legal-version gate and the deactivate/delete modes. An API older than the app breaks sign-in.
- [ ] **(you) Hosting for real users.** The production API runs on Render's free tier, kept awake by UptimeRobot. If the monitor stops, cold starts of about 50 s return and logins fail (the app times out after 15 s). Move to a paid instance before launch.
- [ ] **(you) Email.** Posting and messaging need a confirmed email. Check that the Resend sending domain is verified and that confirmation emails reach Gmail inboxes (`backlog-status.md`).
- [ ] **(you) Mailboxes.** privacy@myhoodora.com and dpo@myhoodora.com appear in the policy and will appear on the deletion page. Make sure they exist and someone reads them.
- [ ] **(you) Lawyer review** of the privacy policy, terms and guidelines (`backlog-status.md`).

### Quality

- [ ] **(you) Run the WP-1 crash-reporting checks** on a preview build (Settings → Diagnostics), then resolve MYHOODORA-MOBILE-1 in Sentry.
- [ ] **(you) Device pass on the release build**, not the development build: sign up → age check → terms → onboarding → feed → post with photo → comment → For Sale → message → push → delete account. Include at least one budget phone (Tecno, Infinix or itel on Android 10–12) and a slow connection.
- [ ] **(you) Accessibility:** TalkBack, large font, small screen (`docs/mobile/README.md`, "Not verified").

## 2. Google Play Console and EAS set-up

- [ ] **(you) Developer account.** Create it on a Google account the company owns, with a director's recovery details, not a developer's personal Gmail. The one-time fee is USD 25, so the card must allow international payments. Identity verification can take several days.
- [ ] **(you) Organisation account** (decided 6 November 2026). Have ready: the company's D-U-N-S number (free from Dun & Bradstreet; it can take up to 30 days, so apply first; check that its name and address match the CAC registration exactly), the CAC documents, a director's government ID, and a public company website (www.myhoodora.com), email and phone. The company name and address appear on the listing. With an organisation account there's no minimum closed test before production.
- [ ] **(you) Invite teammates** as users with their own permissions instead of sharing the owner login.
- [ ] **(you) Create the app:** Play Console → Create app → name "myHoodora", default language English (United Kingdom) or English (US), App, Free. "Free" can't later be changed to paid.
- [ ] **(you) Google service account key for EAS Submit.** Follow Expo's guide "Creating a Google Service Account key": Google Cloud project → service account → JSON key → invite the service account in Play Console (Users and permissions) with release rights for this app. Store the key on EAS, not in git: `eas credentials --platform android` → production → Google Service Account → Manage your Google Service Account Key for Play Store Submissions. Without it, `eas submit --non-interactive` fails with "Google Service Account Keys cannot be set up in --non-interactive mode".
- [ ] **(you) Back up the upload key:** `eas credentials -p android` → Keystore → download. Keep it in the company password manager, outside git. Under Play App Signing (required for new apps) this is the **upload key**, and Google holds the real signing key.
- [ ] **(you) Add Play's signing fingerprints to Firebase** after the first upload: Play Console → Test and release → App integrity → App signing → copy the app-signing key's SHA-1 and SHA-256 → Firebase → Project settings → Android app `com.myhoodora.app` → Add fingerprint. **Without this, Google sign-in fails for everyone who installs from Play**, even though it works in EAS builds. Then download the new `google-services.json` and update the `GOOGLE_SERVICES_JSON` file variable on EAS (both preview and production).

## 3. Store listing

| Item | Limit | State |
| --- | --- | --- |
| App name | 30 characters | "myHoodora" |
| Short description | 80 characters | ❌ to write |
| Full description | 4,000 characters, no keyword lists or claims you can't back up | ❌ to write |
| App icon | 512 × 512 PNG | 🟡 `apps/mobile/assets/images/icon.png` is 1024 × 1024. Export a 512 × 512 copy |
| Feature graphic | 1024 × 500, required | ❌ to design |
| Phone screenshots | 2 to 8, real screens | ❌ take them from a release build with realistic test data (not real people's names or addresses) |
| Tablet screenshots | Optional | Skip: the app is phone-only |
| Category | One | Social (or Lifestyle) |
| Contact email | Required, public | ❌ use a support address, for example support@myhoodora.com |
| Website | Optional | https://www.myhoodora.com |
| Privacy policy URL | Required | https://www.myhoodora.com/privacy |

## 4. App content (Policy → App content)

Every answer must match what the app and its libraries actually do, and the privacy policy. Suggested answers from the code:

- [ ] **Privacy policy:** https://www.myhoodora.com/privacy
- [ ] **App access:** "All or some functionality is restricted". Give the reviewers a ready account:
  - an email-and-password account (no OTP or SMS step), email already confirmed, age already confirmed, current terms accepted, and **already a member of a Hood**. Reviewers are outside Nigeria, so a new account can't pass onboarding's location check.
  - The Hood needs posts, listings and a conversation, so there's something to review.
  - Keep this account outside the QA clean-up list (`project_qa_test_accounts`) and never delete it while the app is listed.
- [ ] **Ads:** **Yes, the app contains ads** (the sponsored cards in the feed, `features/ads`). The app doesn't read the advertising ID (no `AD_ID` permission), so answer "No" to the advertising ID question.
- [ ] **Content rating (IARC questionnaire):** category Social or communication. Users talk to each other and share content; the app shares the user's approximate location (their neighbourhood) with other users; no gambling, no violence, no purchases. Expect a Teen or 12+ style rating.
- [ ] **Target audience:** 18 and over only, which matches the age check. Don't tick any age group under 18, so the Families policy doesn't apply.
- [ ] **User-generated content:** Play requires terms users accept, a way to report content and users, a way to block users, and moderation. The app has terms acceptance (the gate), report sheets on posts, comments and listings, and block on a neighbour's profile and in conversations, with moderation in the admin app. Be ready to describe this.
- [ ] **Data safety:** see the next section.
- [ ] **Government apps, financial features, health, news:** No to each.

### Data safety form

| Data type (Play's name) | Collected | Why | Shared with a third party? |
| --- | --- | --- | --- |
| Name, email address, user IDs | Yes, required | Account, app functionality | No (processors like Firebase, MongoDB and Resend aren't "sharing" in Play's sense) |
| Approximate location, precise location | Yes, optional (the user can type an address instead) | Find the user's neighbourhood | No |
| Photos | Yes, optional | Posts, listings, profile photo | No |
| Messages (in-app) | Yes | App functionality | No |
| Other user-generated content (posts, comments) | Yes | App functionality | No |
| App interactions (including ad impressions and clicks) | Yes | Analytics, advertising | No |
| Crash logs, diagnostics | Yes (Sentry, with personal data filtered) | App functionality, analytics | No |
| Device or other IDs (push token) | Yes | Notifications | No |

- Encrypted in transit: **Yes**.
- Users can request deletion: **Yes**, with the link https://www.myhoodora.com/delete-account.
- Check this table against `docs/compliance/ndpa.md` (transfer table) before submitting, and update both whenever a new SDK is added.

## 5. Build and submit

```sh
cd apps/mobile
eas build --platform android --profile production      # an .aab; EAS raises the versionCode
eas submit --platform android --profile production     # pick the build; goes to "internal", as a draft
# or both in one step:
eas build --platform android --profile production --auto-submit
```

- [ ] **First upload:** the app stays in "Draft" in Play Console until the listing and app-content tasks are done. A draft release can still be tested on the internal track.
- [ ] **Internal testing** (up to 100 testers, no review): add the team, install from the Play link, and repeat the device pass from section 1. This is also when to add Play's fingerprints to Firebase (section 2) and check Google sign-in.
- [ ] **Pre-launch report:** Play runs the build on its test devices. Read it for crashes and accessibility warnings.
- [ ] **Closed testing** (optional for an organisation account): useful for a wider group of neighbours before launch. Use a Google Group for the testers.
- [ ] **Production release:**
  - Countries: Nigeria (the app's coverage). Add others only if the product supports them.
  - Release notes for 1.0.0.
  - Turn on **managed publishing** so the app goes live when you choose, not as soon as it's approved.
  - Use a **staged rollout** (for example 20% → 50% → 100%), watching Sentry and the Android vitals at each step. Halt the rollout if crashes rise.
  - Review takes up to 7 days, often longer for a new account.

Later releases: build with the same command (the versionCode rises by itself), raise `version` in `app.config.ts` when the release is user-visible, and add `--auto-submit`. With `expo-updates` installed, JavaScript-only fixes can go out as an update instead (`eas update --channel production`).

## 6. After launch

- [ ] Reply to Play reviews, especially early ones. They affect installs.
- [ ] Watch Sentry (`myhoodora-mobile`) and Play's Android vitals (crash and ANR rates) for the first week.
- [ ] Share the Play link, not APK files on WhatsApp: sideloaded APKs don't update and trigger security warnings.
- [ ] Disable the QA staff accounts (`backlog-status.md`). Keep the reviewer account.
- [ ] Optional: automate store builds with an EAS Workflow (`.eas/workflows/submit-android.yml`) or CI with an `EXPO_TOKEN`.

## iOS, for later

Not needed for Play, but these block the App Store: an Apple Developer account (USD 99 a year), the APNs key on EAS, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and a decision on Sign in with Apple (guideline 4.8 requires it alongside Google sign-in). See M1–M6 in [architecture-decisions.md](./architecture-decisions.md).

## Open decisions

1. Release countries: Nigeria only?
2. Paid API hosting before launch?

Decided: an organisation Play account; `expo-updates` installed before 1.0.0 (both 6 November 2026).
