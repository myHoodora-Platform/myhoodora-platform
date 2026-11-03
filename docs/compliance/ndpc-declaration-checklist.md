# NDPC registration: declaration checklist

MYHOODORA LIMITED's NDPC registration (Form 2), step 6 "Safety Precautions": **Risk Level = Medium**. Every measure we ticked there must be true, and we must be able to show the evidence in an NDPC audit. This page tracks each one.

Written 2 November 2026 from the repo only. No console (Atlas, Render, Vercel, Firebase, Sentry, GitHub settings) was opened, so anything that lives there is **NEEDS CHECK** at best.

- **VERIFIED**: the evidence is in the repo, cited by file and line.
- **NEEDS CHECK**: the code part is in place; the rest must be confirmed in a console and written down.
- **TO DO**: something must be built, written or decided first.

Section numbers for the privacy policy refer to the current version (`apps/web/src/components/legal/privacy-policy.tsx`): §1 Who we are, §8 How long we keep it, §9 Your rights. Earlier notes called these §7 and §8.

Related: [ndpa.md](./ndpa.md) (obligations and open items), [../security.md](../security.md), [../codebase-audit.md](../codebase-audit.md), [../deployment.md](../deployment.md).

## Summary

| # | Measure | Status | Owner | Target date |
| --- | --- | --- | --- | --- |
| 1 | Network security and firewalls | NEEDS CHECK | [assign] | [date] |
| 2 | Data recovery systems | NEEDS CHECK | [assign] | [date] |
| 3 | Data encryption | NEEDS CHECK | [assign] | [date] |
| 4 | Audit trail and logging | NEEDS CHECK | [assign] | [date] |
| 5 | Data access authorisation and authentication | TO DO | [assign] | [date] |
| 6 | Data minimisation | TO DO | [assign] | [date] |
| 7 | Data retention policies | TO DO | [assign] | [date] |
| 8 | Data protection policies | VERIFIED | [assign] | [date] |
| 9 | Remediation and incident response | TO DO | [assign] | [date] |
| 10 | Specialised trainings | TO DO | [assign] | [date] |
| 11 | Publicity of data subject rights | TO DO | [assign] | [date] |
| 12 | Active grievance redress mechanism | TO DO | [assign] | [date] |
| 13 | DPO designation | NEEDS CHECK | Peace Arakunle | [date] |
| 14 | Regular security audits | TO DO | [assign] | [date] |
| 15 | Vendor and third-party management | TO DO | [assign] | [date] |
| 16 | Data privacy impact assessment (DPIA) | TO DO | [assign] | [date] |

**Count:** 1 VERIFIED · 5 NEEDS CHECK · 10 TO DO.

## Before payment

These must be VERIFIED before we pay the registration fee:

- [ ] **Backups:** Atlas Cloud Backup on, and one test restore done (item 2).
- [ ] **Incident owner** named, with the DPCO or lawyer contact and the NDPC route (item 9).
- [x] **DPO named:** Peace Arakunle (3 November 2026). Check that Form 2 step 4 names the same person (item 13).
- [ ] **Regions confirmed:** Atlas cluster, Render API service and Upstash database, filled in `apps/web/src/components/legal/providers.ts` and [ndpa.md](./ndpa.md) §3 (item 15).
- [ ] **Tier enquiry answered:** the NDPC (or our DPCO) has confirmed which tier (and so which fee) applies to us.

---

## Technical measures

### 1. Network security and firewalls

- **Status:** NEEDS CHECK
- **Evidence required:** rate-limiting and CORS configuration; security headers; the Atlas Network Access list showing no `0.0.0.0/0`.
- **Current evidence:**
  - `apps/api/src/app.module.ts:102-106`: global guards `FloodGuard`, `FirebaseAuthGuard`, `AccountThrottlerGuard`, `AccountGuard`, `CapabilityGuard`.
  - `apps/api/src/main.ts:33` `helmet({`; `apps/api/src/main.ts:57-58` `app.enableCors({ origin: config.get<string>('cors.origin'),`.
  - `apps/web/next.config.js:71` `Content-Security-Policy`; `:73` `Strict-Transport-Security`.
  - `docs/security.md`, "API" table (rate limits: "1,000 per 10 s … 10/s, 60/min, 500/h per person").
  - Atlas Network Access: none (not inspected).
- **Steps to make it true:**
  1. Render → API service → Settings → note its outbound IP addresses. Static egress IPs need a paid Render plan; record the plan.
  2. Atlas → Network Access → add those IPs, then delete `0.0.0.0/0`.
  3. Check that the API still connects (`GET /api/health` returns 200).
  4. Take a screenshot of the access list and add a line to `docs/security.md` (date, IPs allowed).
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** the Atlas access list holds only Render's IPs (plus named admin IPs), and `/api/health` is green.

### 2. Data recovery systems

- **Status:** NEEDS CHECK
- **Evidence required:** the backup policy (frequency, retention) and a dated, successful test restore.
- **Current evidence:** none in the repo. `docs/security.md` ("Turn on permanent deletion") and `docs/codebase-audit.md:500` only say to "take an Atlas backup" before risky changes.
- **Steps to make it true:**
  1. Atlas → Cluster → Backup: confirm Cloud Backup is on. The free M0 tier has none, so check the tier.
  2. Record the snapshot schedule and retention.
  3. Restore the latest snapshot to a scratch cluster, then count documents in `users` and `posts` against production.
  4. Delete the scratch cluster.
  5. Add a "Backups" section to `docs/security.md`: the policy, the test date, the result and who did it.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** `docs/security.md` records the backup policy and a successful test restore with its date.

### 3. Data encryption

- **Status:** NEEDS CHECK
- **Evidence required:** TLS in transit everywhere (API, web, database connection); encryption at rest; HTTP redirected to HTTPS.
- **Current evidence:**
  - `apps/web/next.config.js:73` `{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }`.
  - `apps/web/src/lib/auth/session-cookie.ts:23` `"__Host-session"`; `:28-29` `httpOnly: true, secure: process.env.NODE_ENV === "production"`.
  - `apps/api/src/main.ts:33`: helmet (HSTS on the API).
  - The production `MONGODB_URI`, Atlas encryption at rest, and the domain redirects: not verified.
- **Steps to make it true:**
  1. Render → API → Environment: confirm `MONGODB_URI` starts with `mongodb+srv://` (TLS is on by default for SRV), and doesn't contain `tls=false` or `ssl=false`.
  2. Atlas → Cluster → Security: confirm encryption at rest (Atlas encrypts storage by default; customer-managed keys are optional).
  3. For each custom domain run `curl -sI http://<domain>` and check that it answers 301/308 to `https://`.
  4. Record the results and the date in `docs/security.md`.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** the TLS URI, encryption at rest and the HTTPS redirects are all confirmed and written down.

### 4. Audit trail and logging

- **Status:** NEEDS CHECK
- **Evidence required:** a record of staff and security actions; log retention periods; proof that logs don't hold secrets.
- **Current evidence:**
  - `apps/api/src/audit/audit-event.schema.ts:10` `collection: "audit_events"` (actor, action, target, reason, at).
  - `apps/api/src/audit/audit.service.ts:28` `async record(`.
  - `docs/security.md`, "Logging": "Tokens, cookies and credentials are never logged".
  - Render and Vercel log retention: unknown.
- **Steps to make it true:**
  1. Find the log retention for the current Render and Vercel plans (it depends on the plan).
  2. Decide a retention period for `audit_events`. Today it's kept forever: no TTL.
  3. Write both into `docs/security.md` and into [ndpa.md](./ndpa.md) §7.
  4. If retention is too short for incident investigation, add a log drain (or accept the gap in writing).
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** the retention for application logs and `audit_events` is documented with its source.

### 5. Data access authorisation and authentication

- **Status:** TO DO
- **Evidence required:** authentication on every route; role and capability checks; staff accounts protected by multi-factor sign-in.
- **Current evidence:**
  - `apps/api/src/app.module.ts:103` `{ provide: APP_GUARD, useClass: FirebaseAuthGuard }`.
  - `apps/api/src/shared/authz/can.decorator.ts:13` `export const Can = (...capabilities: Capability[])`.
  - `apps/api/src/shared/authz/roles.ts:98` `export function capabilitiesOf(`.
  - `docs/security.md`, "Who may read a Hood" (Hood centres and addresses shown only to staff and members).
  - Staff MFA: none. `docs/security.md` lists MFA on vendor consoles as manual, and the product has none.
- **Steps to make it true:**
  1. Turn on Firebase multi-factor sign-in (Identity Platform, TOTP or SMS) for staff.
  2. Make the API refuse admin capabilities to staff whose token has no second factor (`firebase.sign_in_second_factor`).
  3. Turn on MFA on every console account: Atlas, Render, Vercel, Firebase/Google Cloud, Cloudinary, Resend, Upstash, Sentry, Expo, GitHub.
  4. Record the date in `docs/security.md`.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** a staff account can't use the admin without a second factor, and every console has MFA on.

### 6. Data minimisation

- **Status:** TO DO
- **Evidence required:** collection limited to what each purpose needs, including location precision, notification content and third-party lookups.
- **Current evidence:**
  - The date of birth is never stored: [ndpa.md](./ndpa.md) §1; `apps/api/src/users/domain/age.ts`.
  - Address-check history capped: `apps/api/src/users/schemas/user.schema.ts:116` `Address-check history for staff review (bounded to the last 10)`.
  - **Gaps:**
    - `apps/mobile/src/core/location/location.ts:41` `Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })`.
    - `apps/api/src/chat/chat.service.ts:578` `body: (text || PHOTO_PREVIEW).slice(0, 140),`: the message text goes into the push body, through Expo, Apple and Google.
    - `apps/web/src/app/api/ip-location/route.ts:57-60`: ip-api.com free tier over plain HTTP.
- **Steps to make it true:**
  1. Mobile: use `Location.Accuracy.Balanced` or `Low` in `location.ts`. Check that neighbourhood placement still works, then drop `ACCESS_FINE_LOCATION` from `apps/mobile/app.config.ts:87`.
  2. API: for `type: "message"` notifications, send a generic push body ("Open myHoodora to read it"), and keep the text in the in-app notification only.
  3. Web: replace ip-api.com (paid HTTPS tier, or drop it and rely on Vercel's geo headers plus typed address).
  4. Update the privacy policy (§3 Permissions, provider list) to match.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** location is approximate, push bodies carry no message text, and no personal data goes over plain HTTP.

## Organisational measures

### 7. Data retention policies

- **Status:** TO DO
- **Evidence required:** the published retention periods match what the system actually deletes, and deletion runs in production.
- **Current evidence:**
  - Policy: `apps/web/src/components/legal/privacy-policy.tsx:302` "You can restore them by logging back in within 30 days. After that, we …".
  - The mode switch: `apps/api/src/config/configuration.ts:141-145` `DATA_DELETION_MODE: "dry-run" (default)`.
  - Notifications already expire after 90 days: `apps/api/src/notifications/notification.schema.ts:67` `expireAfterSeconds: 90 * 24 * 3600`.
  - **Gaps:**
    - Posts are only flagged inactive, and their text stays: `apps/api/src/posts/posts.service.ts:127-130` `$set: { isActive: false }`.
    - Reactions, poll votes, RSVPs and shares aren't purged: `apps/api/src/posts/post-actions.service.ts:35` deletes only saves and follows. The `reactions`, `poll_votes`, `rsvps` and `post_shares` collections are defined in `apps/api/src/posts/schemas/post.schema.ts`.
    - Message text is kept, with the sender replaced: `apps/api/src/chat/chat.service.ts:183-190`.
    - Audit events keep `actor.displayName` and `target.label`: `apps/api/src/audit/audit-event.schema.ts:12-20`.
  - Already purged since 2 November: `hood_requests`, `ad_events`, `ad_hides`, inbound support messages, `communications` (`*.service.ts` `accounts.register`).
- **Steps to make it true:**
  1. Purge reactions, poll votes, RSVPs and post shares by uid (`post-actions.service.ts` or `posts.service.ts`).
  2. On purge, blank the text and media of posts, comments and listings, or delete them outright, not just `isActive: false`.
  3. **Decide DM text:** the privacy policy (§8) says sent messages stay in the other person's copy, as WhatsApp does. If they're to be deleted instead, change the purge and the policy together.
  4. Anonymise `actor.displayName` and `target.label` in `audit_events` for the purged uid, keeping the uid.
  5. Add "Notifications: 90 days" to privacy policy §8.
  6. Production: read a week of `[dry run]` logs, take an Atlas backup (item 2), then set `DATA_DELETION_MODE=live` on Render. Record the date.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** `DATA_DELETION_MODE=live` in production, and an e2e test shows a purged account leaves no personal data beyond what §8 says stays.

### 8. Data protection policies

- **Status:** VERIFIED (lawyer review still pending)
- **Evidence required:** published privacy policy, terms, community guidelines and safety pages that match the system.
- **Current evidence:**
  - `apps/web/src/app/privacy/page.tsx` (updated 2 November 2026); `apps/web/src/components/legal/privacy-policy.tsx:15-30` `SECTIONS` (14 sections, including permissions, transfers, retention, rights, children, contact).
  - The vendor list and storage provider are corrected: `apps/web/src/components/legal/providers.ts` (13 providers, Cloudinary for media), linked from `privacy-policy.tsx` §6 and §7 and published at `/privacy/providers`.
  - Also `apps/web/src/app/terms`, `apps/web/src/app/guidelines` and `apps/web/src/app/safety`.
- **Steps to make it true:**
  1. Lawyer or DPCO review of privacy, terms and guidelines (`docs/security.md`, "Manual actions").
  2. After items 6, 7, 11 and 13, update the policy again and its date.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** a lawyer has signed off the pages, and every later change to them carries a new date.

### 9. Remediation and incident response

- **Status:** TO DO
- **Evidence required:** a written breach-response plan with named people, monitoring that would detect an incident, and the 72-hour NDPC notification rule.
- **Current evidence:**
  - Plan: [ndpa.md](./ndpa.md) §8 (line 103), steps 1 to 5 including "Notify: the NDPC within 72 hours of becoming aware". It ends "Fill in: the incident owner, the DPCO or lawyer to call, and the NDPC contact route".
  - Uptime: `docs/backlog-status.md:78`: UptimeRobot calls `GET /api/health` every 5 minutes.
  - Alerts from Render, Vercel, Atlas and Sentry: not verified.
- **Steps to make it true:**
  1. Fill in the incident owner, the deputy, the DPCO or lawyer, and the NDPC reporting route in [ndpa.md](./ndpa.md) §8.
  2. Point UptimeRobot alerts at a monitored inbox (it's a keep-awake monitor today).
  3. Turn on alert emails: Render (deploy failed, service down), Vercel (deploy failed), Atlas (connections, disk, unusual login), Sentry (new issue, spike).
  4. Add a one-page breach log template (date found, data, people affected, NDPC notified at, decision).
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** §8 names real people and contacts, and the alerts reach an inbox someone reads.

### 10. Specialised trainings

- **Status:** TO DO
- **Evidence required:** dated attendance records of privacy training, repeated on a schedule.
- **Current evidence:** none.
- **Steps to make it true:**
  1. Hold a one-hour briefing covering the NDPA principles, lawful bases, data subject rights, our security measures and the breach plan. Alternatively, use the NDPC Virtual Privacy Academy.
  2. ~~Create `docs/compliance/training-log.md`~~ (done: [training-log.md](./training-log.md) Part 2). Fill in each session.
  3. Repeat at least every 6 months (GAID 2025 Art. 46(3)), and for every new staff member or moderator.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** `training-log.md` has its first dated entry and the next date.

### 11. Publicity of data subject rights

- **Status:** TO DO
- **Evidence required:** published rights, and a working way to use each one.
- **Current evidence:**
  - Rights published: `apps/web/src/components/legal/privacy-policy.tsx:319` (§9), including access, portability, objection, automated decisions, withdrawing consent, and complaining to the NDPC.
  - Erasure is self-serve: Settings → Account → Delete account.
  - **Gaps:**
    - No data export (`docs/codebase-audit.md:444` "Account deletion and data export").
    - Done 3 November 2026: `privacy@myhoodora.com` and `dpo@myhoodora.com` (`apps/web/src/lib/site.ts`), shown in the privacy policy and on `/contact`; a "Privacy & data request" topic (`contact-form.tsx`, `apps/api/src/inbound/inbound.dto.ts` `CONTACT_TOPICS`). The mailboxes still have to be created.
- **Steps to make it true:**
  1. Build "Download my data" (JSON of the profile, posts, comments, listings, messages sent and settings), on web and in the app.
  2. Create the `privacy@myhoodora.com` mailbox and route it to the DPO.
  3. ~~Add a "Privacy & data request" topic~~ (done); make sure the DPO watches that topic in the staff inbox.
  4. Update privacy policy §1, §9 and §14.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** a member can export their data themselves, and privacy requests have their own address and form topic.

### 12. Active grievance redress mechanism

- **Status:** TO DO
- **Evidence required:** working channels for complaints, and published response times.
- **Current evidence:**
  - Contact form: `apps/web/src/app/contact/page.tsx`, `apps/web/src/features/company/contact-form.tsx`.
  - Support threads: `apps/api/src/inbound/inbound.service.ts`; PDFs allowed for support (`apps/api/src/storage/storage.service.ts:84-85`).
  - Reports and appeals: `apps/api/src/moderation/moderation.controller.ts:27` "Neighbour-side moderation: Hood Lead voting, your decisions, appeals".
  - Response times: none documented.
- **Steps to make it true:**
  1. Decide targets, e.g. acknowledge within 2 working days, answer data requests within 30 days, appeals within 7 days.
  2. Publish them on `/contact` and in privacy policy §9.
  3. Keep a simple register of privacy complaints (date received, date answered).
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** the response times are published and the complaint register exists.

### 13. DPO designation

- **Status:** NEEDS CHECK
- **Evidence required:** a named DPO matching NDPC Form 2 step 4, published contact details, and the DPO's qualifications or training.
- **Current evidence:** DPO **Peace Arakunle**, `dpo@myhoodora.com`: `apps/web/src/lib/site.ts` (`DPO_NAME`, `DPO_EMAIL`), shown in the privacy policy §1 and §14 and on `/contact`. The mailbox doesn't exist yet.
- **Steps to make it true:**
  1. ~~Name the DPO~~: Peace Arakunle. Confirm Form 2 step 4 says the same.
  2. Create `dpo@myhoodora.com` for them, and give them `privacy@myhoodora.com` (item 11).
  3. Add the name or role and the contact to privacy policy §1, §9 and §14.
  4. Certify the DPO and keep up yearly CPD (20 of 40 points, at least 10 from structured training), per the NDPC's 26 June 2026 guidance notice. The plan and record are in [training-log.md](./training-log.md) Part 1.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** the policy shows the DPO contact and it matches the registration.

### 14. Regular security audits

- **Status:** TO DO
- **Evidence required:** an audit schedule and a log of completed audits with their findings.
- **Current evidence:**
  - Audit #1: `docs/codebase-audit.md:3` "Audited 5 October 2026 against `development` at commit `c1a1811`", with its status table.
  - Dependency audit: `docs/security.md`, "Dependency audit (29 October 2026)".
  - Secret scanning in CI: `.github/workflows/ci.yml:108-114` (gitleaks).
  - No schedule.
- **Steps to make it true:**
  1. Create `docs/compliance/security-audits.md`: an audit every 6 months, plus after major releases.
  2. Log #1 (5 October 2026, codebase audit) and #2 (29 October 2026, dependency audit) with links and open findings.
  3. Put the next date in the calendar.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** the audit log exists with two entries and the next date.

### 15. Vendor and third-party management

- **Status:** TO DO
- **Evidence required:** a signed or accepted DPA for each processor, and the region and transfer basis of each.
- **Current evidence:**
  - Vendor list: `apps/web/src/components/legal/providers.ts` (13 providers). Regions are `null` for MongoDB Atlas, Render, Upstash, OpenFreeMap, maps.co and ip-api.com.
  - Transfer table: [ndpa.md](./ndpa.md) §3, with "check" cells.
  - DPAs on file: none.
- **Steps to make it true:**
  1. Accept, download and file DPAs for MongoDB Atlas, Cloudinary, Resend, Sentry, Render, Vercel, Google Cloud/Firebase, Upstash and Expo, in a private shared folder (not the repo).
  2. Fill in the regions: Atlas (cluster), Render (API service), Upstash (database). Check the Cloudinary, Resend and Vercel defaults.
  3. Update `providers.ts` (`where`, `PROVIDERS_UPDATED`) and the [ndpa.md](./ndpa.md) §3 table.
  4. ip-api.com has no DPA on the free tier: replace it or pay for it (item 6).
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** every provider has a filed DPA and a confirmed region, and no `where: null` is left.

### 16. Data privacy impact assessment (DPIA)

- **Status:** TO DO
- **Evidence required:** a dated, signed-off DPIA for the high-risk processing.
- **Current evidence:** none. [ndpa.md](./ndpa.md) §1 ("Limits, to put in the DPIA") and the open items mention it.
- **Steps to make it true:**
  1. Write `docs/compliance/dpia.md`. Cover:
     - home address and location data;
     - private messages;
     - cross-border transfers (item 15);
     - the limits of self-declared age checks ([ndpa.md](./ndpa.md) §1);
     - moderation and reports;
     - local ads.
  2. For each: the risk, its likelihood and severity, the measures in place, and the remaining risk.
  3. Have the DPO (item 13) review and sign it off, with a date.
  4. Review it yearly and when processing changes.
- **Owner:** [assign] · **Target date:** [date]
- **Done when:** `dpia.md` exists, dated and signed off by the DPO.

---

## Not declared (intentionally unticked)

| Measure | Why unticked | What would make it tickable |
| --- | --- | --- |
| Data Security Systems | No WAF, bot protection, or automated dependency or code scanning yet (`docs/security.md`, "Not done, on purpose"); only gitleaks in CI | Dependabot alerts and security updates, GitHub secret scanning and push protection, CodeQL, and a WAF (Cloudflare or Vercel Firewall) |
| Data Loss Prevention | DLP tooling isn't expected at our size; we have no staff devices or mail estate to scan | Revisit when there are staff laptops and shared drives |
| Cookie Consent | Only strictly necessary storage, so no consent is needed under GAID ([ndpa.md](./ndpa.md) §4) | Needed only if we add analytics, ads or replay SDKs, which must default off |

## Related open items

- [ ] **Age check and terms acceptance:** the server-side age check is built ([ndpa.md](./ndpa.md) §1; `POST /users/me/age`). We still don't record terms acceptance: no `termsAcceptedAt` or version on the user. Add it at sign-up and when the terms change.
- [ ] **Support attachments:** support PDFs and photos (`storage.service.ts:84-85`) are on public Cloudinary URLs. Use signed or authenticated delivery for the `support` purpose.
- [ ] **Unused app permissions:** check the built iOS `Info.plist` and Android manifest for permissions that libraries add but we don't use. Block them (`android.blockedPermissions`), and drop `ACCESS_FINE_LOCATION` with item 6.
- [ ] **Android auth fallback:** `apps/mobile/src/core/firebase/secure-storage.ts:12-33` falls back to unencrypted AsyncStorage when the keystore fails. Remove the fallback, signing the person out instead, or limit and log it.
- [ ] **QA accounts:** delete the 5 QA accounts from production (`docs/backlog-status.md:21`; staff QA logins are full-access).
