# NDPA compliance

How myHoodora meets the Nigeria Data Protection Act 2023 (NDPA) and the GAID 2025, obligation by obligation: what the code does, why it was built that way, and what only a person can finish. Written 2 November 2026 from an audit against the [Nigeria Vibe Compliance](https://github.com/Mikecode2005/Nigeria_vibe_compliance) checklist.

This is an engineering record, not legal advice. Before launch, a DPCO or lawyer should review §1 (age assurance), §3 (transfer bases) and the privacy policy.

| § | Obligation | Status |
| --- | --- | --- |
| 1 | Children's data (s.31) | ✅ Built: age check, close and delete on discovery |
| 2 | Account deletion really deletes | ✅ Built; needs `DATA_DELETION_MODE=live` in production |
| 3 | Cross-border transfers (s.41–43) | ⚠️ Documented below; signed vendor terms to be filed |
| 4 | Cookies and trackers | ✅ Essential only, so no banner is needed |
| 5 | Email | ✅ Service email only, sender identified; marketing rules for later |
| 6 | Privacy notice and rights | ✅ Updated; registered address still to add |
| 7 | Minimisation and retention | ✅ Mostly; see open items |
| 8 | Breach response | 📋 Plan below; contacts to fill in |
| 9 | Security baseline | ✅ Already in place (security.md) |

## 1. Children: the age check

**Decision: myHoodora is for adults only.** We block under-18s rather than run a parental-consent flow. Reasons: the terms and privacy policy already said 18+; Nextdoor, the model for the product, bars anyone "not old enough for Nextdoor to process their personal information without parental or age-specific consent in the place where they live" (Privacy Policy 2026 §8; Member Agreement US 2026 §1a), which under NDPA s.31 means under 18 in Nigeria; and a neighbourhood network exposes real addresses and contact between strangers, so it isn't a product to take children onto with a parent's consent. Not collecting a child's data at all is simpler and safer than verifying parents.

**How it works**

- Everyone says when they were born once, **before onboarding** and before we ask for a name or address. It applies whichever way they signed up (email, Google, Apple, One Tap), and "Skip for now" doesn't get round it.
  - **Email sign-up:** it's a field in the sign-up form. An under-18 answer is caught **before any account is made**, so there's no child's data to delete. Otherwise the answer is sent as soon as the account exists, and the server has the final say.
  - **Google, Apple, One Tap, and accounts from before the check:** its own screen (web `/confirm-age`, app `needsAgeCheck` phase).
- **Year first** (decided 3 November 2026, to keep the flow short): we ask only the year. The day and month appear only for the one year the year alone can't settle (born 18 years ago this year), so most people type four digits. The rule lives in `packages/api-contract/src/age.ts` (`readBirthInput`) and `apps/api/src/users/domain/age.ts` (`ageVerdict`).
- It's a *neutral* age gate: a blank year, no default, and no mention of the minimum age before they answer. The answer is read back under the field ("Born in 1995. You won't be able to change this later") instead of on a separate confirm step. We considered a single "I'm 18 or over" checkbox and rejected it: it tells a child the answer, and it's the weakest form of age assurance.
- The API works out the age (`apps/api/src/users/domain/age.ts`, mirrored for clients in `packages/api-contract/src/age.ts`) and keeps **only** `ageConfirmedAt` and `ageAssurance: "self_declared_dob"`. **Neither the year nor the date is ever stored** (minimisation).
- Server enforcement, so a modified client can't skip it: until it's passed, `PATCH /users/me/onboarding`, the location checks and hood requests answer `403`, and the account has no member capabilities beyond managing itself (`roles.ts`). `AGE_CHECK_REQUIRED=false` lifts this; leave it on.
- **Under 18, delete on discovery:** the account is closed at once (content hidden, Firebase sign-in disabled, every session revoked), `deletionDueAt` is set and a purge is queued straight away, with no 30-day window. The audit log records `account_closed_under_age`, never the date. Signing in again answers `410`.
- The browser or phone that was turned away won't show sign-up or the age check again for 30 days (`age-lock.ts`). It's a speed bump against retrying with an older year, not a wall: clearing site data removes it.

**Accounts that existed before this:** they're asked on their next visit and can't post until they answer. QA seed scripts must set `ageConfirmedAt` on the users they create (the e2e helper does).

**Limits, to put in the DPIA:** a self-declared date of birth is the weakest form of age assurance. The compliance repo recommends "strong age-assurance" for products *likely to attract* children; we judge myHoodora's risk lower because joining also needs a verified home address. Options if the regulator or a DPCO asks for more: ID-based checks through a Nigerian KYC provider (NIN), or checks only when signals suggest a minor.

**Staff path:** a report or email saying a user is a child → staff close the account the same way. *Not built yet:* there's no admin button that calls `UsersService.closeAsUnderAge` (see open items).

## 2. Account deletion

Two choices in Settings → Account (web and app), as on Nextdoor (3 November 2026; Nextdoor's help article "Deactivate or delete your Nextdoor account"):

- **Deactivate account:** a break. Closed until they log in and choose Reactivate; nothing is deleted.
- **Delete account:** closed at once and deleted for good after **7 days**, unless they log in and cancel. Nextdoor deletes at once; we keep a short window as a safety net against a mistake or a stolen login. Older app builds keep the 30 days their copy promised.

Signing in to a closed account doesn't reopen it silently: a "Welcome back" screen asks. The copy says plainly which one is deletion, which the NDPA right to erasure and the App Store and Google Play account-deletion rules both expect. Details: [api-contract.md](../api-contract.md), "Deactivate or delete".

`AccountDeletionService` removes, through each module's `AccountLifecycle.purge`: posts, comments, listings, groups (handed over or deleted), photos and videos in Cloudinary, notifications, push devices, email-verification links, prompt responses, and, added November 2026, **hood requests** (location and message), **support conversations** started signed in, **ad views, clicks and hides**, **email delivery records**, and the link to any **business page** they managed. Then their Firebase sign-in, and finally the user record is emptied of everything personal and marked `purgedAt`.

What stays, deliberately (legitimate interests, stated in the privacy policy): messages they sent remain in the other person's copy, from "Deleted User"; reports and moderation or audit records keep the bare uid so the safety record stays accurate.

**Launch blocker:** production must run `DATA_DELETION_MODE=live`. In `dry-run` (the default) nothing is deleted, and the privacy policy's promise isn't kept. Read a week of dry-run logs, take a backup, then switch.

Not covered by uid: a support message sent while signed out, or a business application, is found by email address. Staff delete those on request.

## 3. Cross-border transfers

Every vendor below receives personal data outside Nigeria. Record the safeguard for each (NDPA s.41–43) and file the signed terms.

The public version is **`/privacy/providers`**, built from `apps/web/src/components/legal/providers.ts`. The privacy policy names only categories and links there, the way Stripe, Slack and GitHub publish sub-processor lists, so a vendor change doesn't change the policy. Change a vendor or region in that file and bump `PROVIDERS_UPDATED`. Redis is **Upstash**.

**Before launch, fill in the regions shown as "being confirmed"** (`where: null`): MongoDB Atlas (cluster region in the Atlas dashboard), Render (the API service's region), Upstash (the database's region), OpenFreeMap, maps.co and ip-api.com. Also confirm the defaults assumed for Cloudinary, Resend and Vercel (US) if anything was set up differently.

| Vendor | Data | Where | Safeguard to file |
| --- | --- | --- | --- |
| Google Firebase | Email, password hash, Google/Apple identity | US/EU | Google Cloud DPA + SCCs |
| MongoDB Atlas | Everything in the database | Cluster region (check) | MongoDB DPA + SCCs |
| Cloudinary | Uploaded photos and videos | US/EU | Cloudinary DPA |
| Render (API), Vercel (web) | All requests, IPs | US/EU | Each provider's DPA |
| Redis host | Short-lived realtime and rate-limit keys (uids, IPs) | Check | Provider DPA |
| Resend | Email addresses, email content | US | Resend DPA |
| Expo / APNs / FCM | Push tokens, notification text | US | Expo terms; Apple and Google terms |
| Sentry (mobile) | Crash reports with uid only; PII scrubbed (`monitoring/scrub.ts`) | US/EU | Sentry DPA |
| Google Analytics for Firebase (mobile, since 7 Nov 2026) | Only after opt-in: screens (route patterns), events, device model, OS, language, country, app instance ID. No uid, email or advertising ID | US | Google Analytics data processing terms + SCCs |
| OpenFreeMap, maps.co, ip-api.com | IP address, typed address or coordinates | EU/US | Check terms; ip-api.com free tier has no DPA, so consider a paid tier or dropping it |

**Already right:** fonts are self-hosted (`next/font` downloads them at build time; the CSP has no `fonts.googleapis.com`). The website loads no analytics, tag manager, pixel or session replay.

Quick re-check before each release: open the site in a private window, open DevTools → Network, click nothing, and list every third-party host. It should match this table.

## 4. Cookies and trackers

Only strictly necessary storage: the session cookie, security, settings, and the offline feed cache. Under GAID these need no consent, so **there is no cookie banner, by design**. The privacy policy says so.

Rule for later: anything non-essential (analytics, ads SDKs, session replay, Firebase Analytics or Crashlytics beyond today's scrubbed Sentry) must default off, load only after opt-in through a banner with "Reject" as prominent as "Accept", allow withdrawal, and store proof of consent (when, where, what). Session replay must never record form fields.

**App usage analytics follows this rule** (Privacy Policy 2026-11-07). Firebase Analytics is off in `firebase.json` and starts only in production builds after a yes on the feed card ("No thanks" and "Yes, I'll help" look the same). Settings → Privacy → "Help improve myHoodora" turns it off again, which also calls `resetAnalyticsData`. After a no, the app asks again once the days set in Admin → Settings → Platform have passed (default 180, the six-month benchmark European regulators use; 0 never), and asks everyone again when a privacy version changes analytics (`ANALYTICS_POLICY_VERSION`). A yes is never re-asked for time alone. Proof of consent (choice, time, privacy-policy version) is kept on the phone (`core/analytics`, `analytics.consent.v1`), because the choice is per install, like the data. No uid is ever sent, so nothing in Google's data links to an account. In the Firebase console (Analytics → Data retention), keep retention at 14 months or less, as the policy says.

## 5. Email

Everything sent today is a service email (confirm email, account actions, notification emails the person switched on, support replies, business-application updates). Every email now ends with the sender's name and contact address, and account emails say where to change which emails you get.

- The business form's "Email me when Local Ads launch" box is **never pre-ticked** (it used to be when arriving from the ads page).
- Before any marketing email, including a "we launched" email: separate opt-in, a one-click unsubscribe (link plus `List-Unsubscribe` and `List-Unsubscribe-Post` headers) honoured at once and permanently, a stored consent record, and the registered address in the footer.

## 6. Privacy notice and rights

`/privacy` (updated 2 November 2026) now covers the age check, the real vendor list, transfers and their basis, what deletion removes and what stays, the cookie position, and how to complain to the NDPC. Requests go to hello@myhoodora.com.

Its structure was checked against NDPA s.27 (what a notice must say), a standard mobile-app privacy policy template, and the policies of Nextdoor, Meta and Eventbrite. It has a "short version" box and a contents list (Meta's layered style), a **Permissions on your phone** section (location while in use, camera and photos, PDFs, notifications, the calendar sheet; no contacts, microphone or cross-app tracking, matching `apps/mobile/app.config.ts`), local ads and how they're chosen, business-page and feedback data, data from others (Google/Apple, other members), **automated decisions** (s.27: neighbourhood placement and rate limits; people review reports and suspensions), retention per kind of data, and a **Contact us** section. Keep it in step with the app: a new permission in `app.config.ts`, a new vendor or a new kind of data means a change here.

Contacts (3 November 2026, following Nextdoor's privacy@ and dpo@): **privacy@myhoodora.com** for privacy and data requests, and **dpo@myhoodora.com** for the Data Protection Officer, **Peace Arakunle** (named 3 November 2026; `DPO_NAME` in `apps/web/src/lib/site.ts`, which must match NDPC Form 2 step 4). They're shown in the privacy policy (§1, §9, §12, §14), on `/contact` (with a "Privacy & data request" form topic, high priority in the staff inbox), on `/privacy/providers` and on the under-18 screen. The addresses live in `apps/web/src/lib/site.ts`. **Both mailboxes must exist before this ships.**

Still missing against s.27: the registered address.

- Access, rectification: Settings, or email.
- Erasure: Settings → Delete account.
- Portability: by email for now. A self-serve "Download my data" export is open work.

## 7. Minimisation and retention

No date of birth, phone or ID is collected from members. Location history is capped at the last 10 checks. Open: put a TTL on email delivery records, ad events and job records, and set a log-retention period with the hosting providers.

## 8. Breach response

1. **Contain:** rotate the exposed keys (Firebase service account, `MONGODB_URI`, Cloudinary, Resend, Redis, Expo token), revoke sessions (`POST /auth/logout-everywhere` per user, or rotate the Firebase project's keys), close public access.
2. **Assess:** what data, how many people, accessed or only exposed, any children's data.
3. **Preserve:** logs and configuration at the time.
4. **Notify:** the NDPC within 72 hours of becoming aware, if it's likely to risk people's rights; the affected people without delay if the risk is high. Keep a record even when no notice is required.
5. **Fix and write up:** root cause, timeline, decisions.

Fill in: the incident owner, the DPCO or lawyer to call, and the NDPC contact route.

## 9. Security baseline (already in place)

Secrets are server-side only. The web bundle holds only Firebase's public config. No browser source maps in production. Every route is protected unless explicitly public (proxy default-deny). Ownership and role checks happen in the API (capabilities, Hood scoping). There's a global rate limiter plus per-route limits, Helmet and a CSP, signed Resend webhooks, escaped email templates, and React-escaped user content. Details: [security.md](../security.md). Still manual: MFA on every staff and vendor-console account.

## Open items

- [ ] `DATA_DELETION_MODE=live` in production (§2).
- [ ] Admin action "Close: under 18" calling `closeAsUnderAge` from a report or user page (§1).
- [ ] DPIA covering the age check's limits, location data and cross-border transfers (§1, §3).
- [ ] File the vendor DPAs and fill in the transfer table's "check" cells (§3).
- [ ] Add the registered company address to the privacy policy and the email footer (§5, §6).
- [ ] Self-serve data export (§6).
- [ ] Create the privacy@ and dpo@ mailboxes (already shown on the site). The DPO is Peace Arakunle; make sure Form 2 step 4 names the same person (§6).
- [ ] Replace or pay for ip-api.com: the free tier is for non-commercial use only and is plain HTTP, so the visitor's IP crosses the internet unencrypted. On Vercel it's only a fallback (Vercel's own geo headers come first) (§3).
- [ ] MFA on staff sign-in in the product (today only vendor consoles), then the policy can say so (§9).
- [ ] TTLs and log retention (§7).
- [ ] Breach contacts (§8). MFA on staff accounts (§9).
- [ ] Register with the NDPC if myHoodora is a controller "of major importance".

## Rules for future changes

These hold for anyone changing the code, people and AI assistants alike:

- No new signup or data-collection path skips the age check; no name, address or content before it.
- Never store a date of birth.
- No analytics, ads or replay SDK without a consent gate that defaults off. No third-party font, script or CDN without adding it to §3 and the privacy policy.
- Every new collection holding a uid registers an `AccountLifecycle.purge`.
- Marketing email needs separate opt-in and one-click unsubscribe. Checkboxes are never pre-ticked.
- Secrets never reach the client. New routes go through the capability and Hood checks.
