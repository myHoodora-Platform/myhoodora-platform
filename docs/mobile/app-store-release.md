# Releasing the iPhone app on the App Store

_Written 16 November 2026. Sources: Apple's [Overview of publishing your app](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/overview-of-publishing-your-app-on-the-app-store/), [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow/), [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/) (checked 16 Nov), [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/), [App Review](https://developer.apple.com/distribute/app-review/), the [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (1.2, 2.1, 4.8, 5.1.1, 5.1.2, 5.1.5 quoted 16 Nov), and Expo's [Submit to the Apple App Store](https://docs.expo.dev/submit/ios/). The Android equivalent is [play-store-release.md](./play-store-release.md)._

Work top to bottom and tick each box as you go, with the date. **(you)** means an Apple, Firebase or EAS console, an Apple sign-in or a decision. **(code)** means a change in this repository. Steps that need your Apple ID and its two-factor code can't be done for you.

## Where we stand

| Area | State |
| --- | --- |
| Apple Developer Program | ✅ Enrolled as an **Organization**, MYHOODORA LIMITED, Team ID `P8TFVK9UYF` (checked 16 Nov) |
| App identity | ✅ Bundle ID `com.myhoodora.app`, version `1.0.0`, iPhone only (`supportsTablet: false`), so no iPad screenshots |
| Build requirements | ✅ Xcode 26 / iOS 26 SDK (required since 28 Apr 2026): EAS picks an Xcode 26 image for SDK 57. ✅ iOS 13+ target (required since 9 Sep 2026): the project targets 16.4. Check the [requirements page](https://developer.apple.com/news/upcoming-requirements/) again on upload day for an iOS 27 SDK date |
| Export compliance | ✅ `ITSAppUsesNonExemptEncryption: false` in `app.config.ts`, so App Store Connect asks no encryption questions |
| iOS builds so far | 🟡 One test build on 26 Oct 2026, before Firebase Analytics added dynamic frameworks. A production iOS build hasn't been tried |
| Sign in with Apple | ❌ Required by guideline 4.8 because the app offers Google sign-in. Not built in the app, and off on the web too |
| Guideline 1.2 (user content) | 🟡 Report ✅, block ✅, published contact ✅ (/contact, hello@). Automatic **filter** for objectionable text ❌ |
| Account deletion in the app (5.1.1(v)) | ✅ Menu → Settings & privacy → Account → Delete account |
| Location (5.1.1(iv), 5.1.2(i)) | ✅ Typing an address works instead of sharing location |
| Update prompts | ✅ Built 16 Nov. The iPhone store page and Latest fill in by themselves once the app is live (Admin → Settings → Platform → App updates) |

## 1. Code that must land first (code)

- [x] **Sign in with Apple in the app** (guideline 4.8), 16 Nov 2026: `expo-apple-authentication` + `expo-crypto`, `ios.usesAppleSignIn` (entitlement `com.apple.developer.applesignin`), Apple's own button above Google's on the login ("Continue with Apple") and sign-up ("Sign up with Apple") screens, iPhone only. A hashed nonce goes to Apple and the raw one to Firebase (`OAuthProvider("apple.com")`); the name Apple sends on the first sign-in is saved to Firebase. After that it's the same path as Google: age check, terms, onboarding. It's native, so it ships in the iOS build, not over the air.
- [ ] **Revoke Apple tokens when an account is deleted** (Apple's account-deletion rules for apps with Sign in with Apple). Needs a "Sign in with Apple" key (.p8) from Certificates, Identifiers & Profiles → Keys, then the API exchanges the authorisation code at sign-in and calls Apple's revoke endpoint on deletion. Planned next; reviewers rarely test it, but it's required.
- [ ] **Sign in with Apple on the website** (`APPLE_SIGN_IN_ENABLED` is off): someone who joins with Apple on an iPhone can't sign in on the web until it's on. Needs a Services ID, the domain and return URL, and the same .p8 key in Firebase.
- [ ] **Text filter for posts, comments, listings and messages** (guideline 1.2: "a method for filtering objectionable material from being posted"). Planned approach: a server-side word list (English, Pidgin, Yoruba, Igbo, Hausa slurs and threats) that blocks or holds a post before it's published, editable by admins. The kindness reminder alone is a nudge, not a filter.
- [x] **`submit.production.ios`** in `eas.json` (16 Nov): `ascAppId` `6835366892`, `appleTeamId` `P8TFVK9UYF`.
- [ ] **First production iOS build checked** (React Native Firebase needs `useFrameworks: "dynamic"`). Fix whatever it raises.
- [ ] **App privacy manifest.** Expo writes `PrivacyInfo.xcprivacy`. Check that the uploaded build raises no "missing API declaration" email from Apple (required-reason APIs, since May 2024).
- [ ] **iPhone screenshots** at 6.9" (1320 × 2868 or 1290 × 2796) from the iOS Simulator with the same demo content as the Play shots (`docs/mobile/store-listing.md`).
- [ ] **App Store listing text** (name, subtitle, keywords, description) checked against the code, in `docs/mobile/store-listing.md`.

## 2. Apple Developer account (you)

At [developer.apple.com/account](https://developer.apple.com/account):

- [x] **Membership details** (16 Nov): Enrolled as Organization, MYHOODORA LIMITED, Team ID P8TFVK9UYF.
- [ ] **Agreements**: in App Store Connect → Business, accept the latest **Apple Developer Program License Agreement**. A free app needs nothing else. The Paid Apps Agreement, tax and banking forms are only needed for paid apps or in-app purchases.
- [ ] **People**: you (Account Holder) can do everything. Anyone else who submits needs the Admin or App Manager role (App Store Connect → Users and Access).
- [ ] **EU Digital Services Act**: only needed if the app is sold in the EU. With availability set to Nigeria (step 9), declare it when App Store Connect asks, but no trader verification is needed until you add EU countries.

## 3. Firebase and EAS (you)

- [x] **Apple's private email relay** (16 Nov 2026): Certificates, Identifiers & Profiles → Services → Sign in with Apple for Email Communication. Registered domains `myhoodora.com` and `send.myhoodora.com` (Resend), and senders `hello@myhoodora.com` (the API's MAIL_FROM) and `noreply@myhoodora.com` (Firebase password reset). All four pass Apple's SPF check, so mail reaches "Hide My Email" addresses. Add any new sender here first.
- [ ] **One SPF record for myhoodora.com** (DNS at QServers): it has two (`+a +mx +ip4:181.215.243.156` and `include:_spf.firebasemail.com`), which the SPF rules treat as an error; Gmail can file mail as spam. Replace both with `v=spf1 +a +mx +ip4:181.215.243.156 include:_spf.firebasemail.com ~all`.
- [ ] **Firebase password-reset email**: sender name `myHoodora`, reply-to `hello@myhoodora.com` (done 16 Nov). Custom action URL `https://www.myhoodora.com/reset-password` failed to save: add `www.myhoodora.com` to Authentication → Settings → Authorised domains and retry. It applies to every Firebase template, but only password reset is sent today (the API confirms emails itself and changes addresses on the server).
- [ ] **Firebase Console → Authentication → Sign-in method → Apple → Enable.** For sign-in from the iPhone app only, no Services ID or key is needed. Those are only for Apple sign-in on the website or Android, which stay off.
- [ ] **Firebase iOS app**: the iOS app `com.myhoodora.app` exists (there's a `GoogleService-Info.plist`). If it was downloaded before Apple was turned on, download it again.
- [ ] **EAS environment variables** ([expo.dev](https://expo.dev) → myhoodora-mvp/myhoodora → Environment variables), for **production** and **preview**:
  - `GOOGLE_SERVICE_INFO_PLIST`: type **file**, the `GoogleService-Info.plist` above.
  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: the `CLIENT_ID` value from that file (ends in `.apps.googleusercontent.com`).
  Without them the iOS build has no Google sign-in and no analytics.

## 4. Create the app in App Store Connect (you)

You must create the app record before any build can be uploaded.

- [x] **App ID registered** (16 Nov) in Certificates, Identifiers & Profiles: Explicit `com.myhoodora.app`, Push Notifications and Sign In with Apple (primary App ID; no server-to-server endpoint yet). No APNs SSL certificates: EAS uses an APNs key.
- [x] [App Store Connect](https://appstoreconnect.apple.com) → **Apps → + → New App** (16 Nov), with Company Name `MYHOODORA LIMITED` (the permanent developer name):
  - Platforms: **iOS**
  - Name: **myHoodora** (30 characters at most, must be unique on the App Store; if it's taken, try "myHoodora: Neighbours")
  - Primary language: **English (U.K.)**
  - Bundle ID: **com.myhoodora.app**. If it isn't listed, run step 5 first (EAS registers it) and come back.
  - SKU: **myhoodora-ios** (private, never shown)
  - User access: Full access
- [x] **Apple ID `6835366892`** (App Information). The store page will be `https://apps.apple.com/app/id6835366892`; the API fills it in once the app is live.

## 5. Signing credentials (you, about 10 minutes, needs your iPhone for the 2FA code)

In a terminal, from `apps/mobile`:

```sh
npx eas-cli@latest credentials -p ios
```

- [x] Done 16 Nov 2026 with Peace's own Apple ID, invited to the MYHOODORA LIMITED team as an Admin (the Account Holder doesn't have to run it). Choose the **production** profile and the team **MYHOODORA LIMITED (P8TFVK9UYF)**.
- [x] **Distribution certificate** `2ABA6877…` and **provisioning profile** `DZ9RH5A958`, both valid until 16 Nov 2027 (EAS offers to renew them).
- [x] **Push Notifications key** `J8M787Q5WV`. Apple allows only two such keys per account, so don't make extras.
- [x] **App Store Connect API key** `UKJ6UYKS2R` ("[Expo] EAS Submit", role APP_MANAGER), so uploads need no password.

## 6. Build and upload to TestFlight (Claude can run this once 1, 3, 4 and 5 are done)

From a clean `main` (`git status` empty: EAS uploads the working tree):

```sh
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --profile production --latest
```

- [ ] Build finished. The build number goes up by itself (`autoIncrement`, `appVersionSource: remote`).
- [ ] Uploaded. It shows in App Store Connect → **TestFlight** after 10 to 15 minutes of processing. Watch your email for Apple warnings about missing privacy declarations.

## 7. Test on your iPhone with TestFlight (you)

- [ ] TestFlight → Internal Testing → add yourself, install the **TestFlight** app on your iPhone and accept.
- [ ] Walk through: **Sign in with Apple** (new account, and with "Hide My Email"), Google sign-in, email sign-up and confirmation, age check, scroll-to-agree terms, onboarding with location **and** with "type my address", feed, posting with a photo, For Sale, messages, a push notification arriving, report a post, block someone, **delete account**, dark mode.
- [ ] Nothing crashes (Sentry shows no new iOS issues).

## 8. Store listing (you, in App Store Connect → the app → iOS App 1.0)

| Field | Value |
| --- | --- |
| Subtitle (30) | e.g. `Your neighbourhood, connected` |
| Promotional text (170, editable any time) | e.g. `Local news, safety alerts, recommendations and things for sale from neighbours who live near you.` |
| Description | Play's description (`store-listing.md`), with nothing about Android or Google Play |
| Keywords (100, commas, no spaces) | e.g. `neighbours,neighbourhood,community,lagos,ibadan,estate,local,alerts,security,marketplace,nigeria` |
| Support URL | `https://www.myhoodora.com/contact` |
| Marketing URL | `https://www.myhoodora.com` |
| Copyright | `2026 MYHOODORA LIMITED` |
| Screenshots | 6.9" iPhone set from section 1 (3 to 10). No iPad set: the app is iPhone only |

App Information:

- [ ] **Category**: Social Networking (primary), Lifestyle (optional secondary).
- [ ] **Age rating**: answer the questionnaire honestly (it uses the updated rating system, required since 31 Jan 2026). Unrestricted messaging between users and user-generated content push the rating up; that's expected for an 18+ app.
- [ ] **Privacy policy URL**: `https://www.myhoodora.com/privacy`.

**App Privacy** (the "nutrition label"; keep it consistent with Play's Data safety form). Tracking: **No** (no advertising ID, no data shared for ads). Collected and **linked to the person**:

| Data type | Why |
| --- | --- |
| Name, email address | App functionality (account) |
| Precise location | App functionality (finding the person's neighbourhood; collected once during sign-up) |
| Photos, other user content (posts, comments, listings) | App functionality |
| Messages (in-app chats) | App functionality |
| User ID | App functionality |
| Product interaction (usage analytics, only after opt-in) | Analytics |
| Crash data, performance data (Sentry) | App functionality |
| Device ID (since 1.0.1: the vendor ID sent with an invite claim, kept only as a salted one-way hash, to spot many sign-ups from one phone) | App functionality (Apple counts fraud prevention and security here) |

## 9. Review information, availability and release (you)

- [ ] **App Review Information** → Sign-in required: **yes**. Username `myhoodora+play-review@gmail.com` and its password (the Play reviewer account; it's linked to the demo Hoods). Make sure it can sign in on the day.
- [ ] **Notes for the reviewer** (paste and adjust):

  ```text
  myHoodora is a private network for neighbourhoods in Lagos and Ibadan, Nigeria. New accounts must confirm they live inside a covered neighbourhood, which a reviewer outside Nigeria can't do, so the demo account above is already a verified member of a demo neighbourhood with sample posts, listings and chats.

  User-generated content (guideline 1.2): posts, comments and listings are checked against a filter before publishing; anyone can report a post, comment, listing, message or person from its "…" menu, reports are reviewed by our team, and anyone can be blocked from their profile. Contact: hello@myhoodora.com, https://www.myhoodora.com/contact.

  Account deletion (5.1.1(v)): Menu → Settings & privacy → Account → Delete account.
  Location is optional: people can type their address instead.
  Sign in with Apple is offered next to Google sign-in.
  ```
- [ ] Contact information for Apple: your name, a phone number Apple can call, and an email.
- [ ] **Pricing and Availability**: Free. Countries: **Nigeria** only, like Play (add more later).
- [ ] **Version Release**: choose **Manually release this version**, so approval doesn't publish it before you're ready (Play's managed publishing). Phased release only applies to updates.
- [ ] **Version number**: the version on the App Store tab must match the build. The app record started as **1.0**, but the first build sent for review is **1.0.1 (5)**. Rename the version to **1.0.1**, or the build won't be offered.
- [ ] **Build**: select the TestFlight build from step 6 (1.0.1, build 5 on 18 Nov 2026).
- [ ] **Add for Review → Submit to App Review.** Most reviews finish within 24 to 48 hours. After approval, click **Release**; it can take up to 24 hours to appear in search.

## 10. After approval (you, then code)

- [ ] **Release** the version.
- [ ] Admin → Settings → Platform → **App updates** → iPhone: the API fills in the store page and Latest by itself within 6 hours of the app appearing in Apple's lookup (or press **Check the stores now**). Check they look right.
- [ ] Add the App Store badge and link to the website (code).
- [ ] Keep the demo Hoods and reviewer account until both stores have approved every pending version; remove them as described in `store-listing.md` only after that.

## Common first-submission rejections

| Guideline | What they check | Where we stand |
| --- | --- | --- |
| 2.1 App completeness | Demo account works, API awake, no crashes | Render free tier sleeps: keep UptimeRobot on or use a paid instance during review |
| 4.8 Login services | Sign in with Apple next to Google | Section 1 |
| 1.2 User content | Filter, report, block, contact | Filter in section 1 |
| 5.1.1(v) Account deletion | Deletion inside the app, not just a link | ✅ |
| 5.1.1(i) / 5.1.2 Privacy | Privacy policy link in the app and listing; label matches behaviour | ✅ in-app legal pages; label in section 8 |
| 5.1.5 Location | Purpose explained, optional | ✅ permission text and address fallback |
| 2.3 Accurate metadata | Screenshots show the real app; no mention of other platforms | Section 1 screenshots |
| 4.2 Minimum functionality | More than a website in a wrapper | ✅ native app |
