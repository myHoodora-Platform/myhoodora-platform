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
| EAS Submit | ✅ `submit.production` sends to internal testing as a draft. The Play service-account key (`myhoodora-play-api`, key `33ab5964…`) is on EAS since 7 November 2026 |
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

- [x] **(code) Privacy policy update for app analytics** (7 Nov). Privacy Policy `2026-11-07`, material, effective on publication (approved by the user on 7 November 2026). App usage analytics is **opt-in**: off until the person says yes on a one-time feed card ("No thanks" as prominent as yes, shown after the first-run tour), with a switch in Settings → Privacy that also clears the phone's analytics data. Google Analytics for Firebase is on `/privacy/providers`. Members are asked to agree again on their next visit. **Deploy the API and the web together** (the API's `CURRENT_LEGAL` and the web's text must go live at the same time), before the store build.
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

Do these in order. Steps 2.1 to 2.4 happen in Google's consoles, signed in with the company's Google account. Step 2.5 is a terminal command. Step 2.6 waits for the first upload (section 5).

### 2.1 The company's Google account and D-U-N-S number

- [ ] **(you) A Google account the company owns**, for example a Google Workspace address on myhoodora.com, or a new Gmail used only for this. Its recovery phone and email should be a director's, not a developer's. It becomes the Play account's owner and can't be swapped out later without a transfer.
- [ ] **(you) D-U-N-S number.** Check whether the company already has one at Dun & Bradstreet's lookup (dnb.com → "D-U-N-S Number" → "Look up"). If not, request one there (free; up to 30 days). The legal name and address must match the CAC registration **exactly**, because Google compares them. **Start this first**: nothing else in section 2 can finish without it.

### 2.2 Create the developer account

- [ ] **(you)** Go to play.google.com/console/signup with the company account → **An organisation** → enter the D-U-N-S number, legal name and address (as on D-U-N-S), the organisation's phone and website (https://www.myhoodora.com), the developer name shown on the store ("myHoodora", or the company's name), and a public contact email and phone.
- [ ] **(you)** Pay the one-time USD 25 fee with a card that allows international payments (a dollar card, or a naira card with its international limit raised).
- [ ] **(you)** Complete identity verification: a director's government ID, and the verification codes sent to the contact email and phone. Google may ask for CAC documents. Allow several days.
- [ ] **(you)** Note that the developer name, email, address and phone appear on the store listing.

### 2.3 Create the app and invite the team

- [ ] **(you)** Play Console → **Create app**: app name `myHoodora`, package name **`com.myhoodora.app`** (exactly as in `app.config.ts`; it can never be changed, and a build with any other package name is refused), default language English (United Kingdom), **App**, **Free**, then tick the three declarations (Developer Programme Policies, Play app signing Terms of Service, US export laws). "Free" can't be changed to paid after publishing. Play adds "automatic protection" (an installer check) to Play installs; it doesn't affect EAS preview builds, and it can be turned off under App integrity if it ever causes trouble.
- [ ] **(you)** Play Console → **Users and permissions** → **Invite new users**: each teammate with their own Google account, and only the permissions they need (for developers: "Release apps to testing tracks" and "View app information"). Never share the owner login.

### 2.4 A Google service account for EAS Submit

EAS uploads builds to Play with this account's key. Use the Google Cloud project that already belongs to Firebase (`myhoodora-e9ba5`), so there's one project to look after.

- [x] **(you)** console.cloud.google.com → choose project `myhoodora-e9ba5` → **APIs & Services → Library** → search "Google Play Android Developer API" → **Enable**.
- [x] **(you)** **IAM & Admin → Service accounts → Create service account**: name `eas-play-submit`, no project roles (leave the role step empty) → **Done**.
- [x] **(you)** Open the new account → **Keys → Add key → Create new key → JSON**. A `.json` file downloads. **It's a password**: never put it in the repository, chat, email or WhatsApp.
- [x] **(you)** Copy the service account's email (`eas-play-submit@myhoodora-e9ba5.iam.gserviceaccount.com`). Play Console → **Users and permissions → Invite new users** → paste it → **App permissions** → add myHoodora → tick **View app information (read-only)**, **Edit and delete draft apps**, **Release to production, exclude devices, and use Play App Signing**, **Release apps to testing tracks**, **Manage testing tracks and edit tester lists** and **Manage store presence** (Play adds a few read-only ones itself) → **Invite user**. These are the permissions in Expo's guide (expo.fyi/creating-google-service-account). It can take up to a day before Google accepts the key.
- [x] **(you, or Claude with the file's path)** Store the key on EAS, not in git (done 7 Nov through EAS; the account used is `myhoodora-play-api`, not `eas-play-submit`):
  ```sh
  cd apps/mobile
  eas credentials --platform android
  # → production → Google Service Account
  # → Manage your Google Service Account Key for Play Store Submissions → Upload a new key → path to the .json
  ```
  Or skip this: the first `eas submit` asks for the key's path and stores it on EAS itself. Then delete the downloaded `.json` from Downloads, after saving a copy in the company password manager.

### 2.5 Back up the upload key

- [ ] **(you)** EAS made the Android keystore on 26 October 2026. Under Play App Signing it becomes the **upload key**: Google keeps the real signing key, and a lost upload key can be reset through Google support, but with a wait of days. Download a copy:
  ```sh
  cd apps/mobile
  eas credentials --platform android
  # → production → Keystore: Manage everything needed to build your project → Download existing keystore
  ```
  The command saves a `.jks` file and prints its passwords and alias. Put the file and the three values in the company password manager, then delete the local `.jks`. It must never be committed (`*.jks` is already in `apps/mobile/.gitignore`).

### 2.6 After the first upload: Play's signing fingerprints in Firebase

The first upload is in section 5 (`eas submit` to the internal track). Then:

- [ ] **(you)** Play Console → myHoodora → **Test and release → App integrity → Play app signing** (older consoles: **Setup → App signing**) → copy the **App signing key certificate** SHA-1 and SHA-256 (not the upload key's: that one is already in Firebase).
- [ ] **(you)** Firebase console → project `myhoodora-e9ba5` → Project settings → **Your apps** → Android `com.myhoodora.app` → **Add fingerprint**, once for each.
- [ ] **(you)** Download the new `google-services.json` from the same page and replace the `GOOGLE_SERVICES_JSON` file variable on EAS (expo.dev → myhoodora-mvp/myhoodora → Environment variables), for **preview** and **production**.
- [ ] **(you)** Install the internal-testing build from Play and sign in with Google. **Without these fingerprints, Google sign-in fails for every Play install**, even though it works in EAS builds.

## 3. Store listing

Everything to paste, and how each graphic is made, is in [store-listing.md](./store-listing.md). Files are in `apps/mobile/store/`.

| Item | Limit | State |
| --- | --- | --- |
| App name | 30 characters | ✅ "myHoodora" |
| Short description | 80 characters | ✅ written (76) |
| Full description | 4,000 characters, no keyword lists or claims you can't back up | ✅ written (about 2,150), each claim checked against the code |
| App icon | 512 × 512 PNG | ✅ `store/icon-512.png` |
| Feature graphic | 1024 × 500, required | ✅ `store/feature-graphic.png` (source `store/src/feature-graphic.html`) |
| Phone screenshots | 2 to 8, real screens | ✅ 8 shots in `apps/mobile/store/screenshots/final/` (Redmi 14C, 1080 × 2160). Check the Cloudinary demo photos' licence before upload (store-listing.md) |
| Tablet screenshots | Optional | Skip: the app is phone-only |
| Category | One | Social |
| Contact email | Required, public | hello@myhoodora.com (make sure someone reads it) |
| Website | Optional | https://www.myhoodora.com |
| Privacy policy URL | Required | https://www.myhoodora.com/privacy |

## 4. App content (Policy → App content)

Every answer must match what the app and its libraries actually do, and the privacy policy. Suggested answers from the code:

- [ ] **Privacy policy:** https://www.myhoodora.com/privacy
- [ ] **App access:** "All or some functionality is restricted". Give the reviewers a ready account:
  - an email-and-password account (no OTP or SMS step), email already confirmed, age already confirmed, current terms accepted, and **already a member of a Hood**. Reviewers are outside Nigeria, so a new account can't pass onboarding's location check.
  - The Hood needs posts, listings and a conversation, so there's something to review.
  - Keep this account outside the QA clean-up list (`project_qa_test_accounts`) and never delete it while the app is listed.
- [ ] **Ads:** **Yes, the app contains ads** (the sponsored cards in the feed, `features/ads`). The app doesn't read the advertising ID: Firebase Analytics' `AD_ID` permission is removed (`blockedPermissions`) and its collection turned off (`apps/mobile/firebase.json`), so answer "No" to the advertising ID question.
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
| App interactions (screens viewed, ad impressions and clicks) | Yes. Ad views and clicks: our API, required. Screens and features: Firebase Analytics, production builds, **optional** (only after the person opts in) | Analytics, advertising | No |
| Crash logs, diagnostics | Yes (Sentry, with personal data filtered) | App functionality, analytics | No |
| Device or other IDs (push token; Firebase Analytics' app instance ID) | Yes | Notifications, analytics | No |

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

Decided: an organisation Play account; `expo-updates` installed before 1.0.0 (both 6 November 2026). Firebase Analytics in the app only, Sentry kept as the only crash reporter, no analytics on the website; store screenshots from a local demo neighbourhood (6 November 2026).

## Next steps (6 November 2026)

1. **Play service-account key:** rotated and on EAS (7 November 2026, key `33ab5964…`). Check that the old key `11e8baf7…` is deleted in Google Cloud, and move the downloaded `.json` out of the repository folder into the company password manager (`.gitignore` covers `myhoodora-e9ba5-*.json` meanwhile).
2. **Screenshots:** done 6 November 2026 (`apps/mobile/store/screenshots/final/`). Before uploading, confirm the Cloudinary demo photos may be used, or swap them. Then undo the local demo data (command in store-listing.md) and delete the `myhoodora+qa-store` Firebase account before launch.
3. **iOS:** set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` on EAS (preview and production) to the iOS client ID in `GoogleService-Info.plist` (`CLIENT_ID`), and run an iOS build to check the new dynamic frameworks (React Native Firebase v27 needs them) before any iOS release.
4. **Privacy policy version** for analytics: done 7 November 2026 (`2026-11-07`, opt-in analytics). Deploy the API and web together, then `DATA_DELETION_MODE=live`, then the store build.
5. **Website seal (optional):** if you want D&B's "D-U-N-S Registered" seal on the site, ask Dun & Bradstreet Nigeria to enable the *website* seal for www.myhoodora.com. It's a third-party script, so it also needs a content-security-policy change and a line in the privacy policy. Until then the footer shows the company name, RC number and D-U-N-S number as text.
