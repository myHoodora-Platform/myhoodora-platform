# Roadmap

What comes next, in order. For what already exists see [`current-state.md`](./current-state.md); for the itemised status of the last backlog see [`backlog-status.md`](./backlog-status.md).

## Before launch

Mostly not code.

1. **Manual security and operations tasks**: rotate the Cloudinary key and MongoDB password, verify the Resend domain, set production environment, run migrations, authorise production domains in Firebase and Google, disable QA accounts ([`security.md`](./security.md), [`deployment.md`](./deployment.md)).
2. **Legal review** of Privacy Policy, Terms of Use and Community Guidelines.
3. **Click-test Google sign-in** (button and One Tap) with real accounts on the production domain.
4. **A verified test resident account**, and browser tests for the core resident flows (post, comment, upload, search, message). Today these are tested at the API only.
5. **Cross-browser pass**: Safari (iOS), Chrome (Android), Firefox, at phone and desktop widths.
6. **Choose hosting settings**: instance count (Redis is needed above one), log retention, backups for MongoDB.

## Next, in the product

- Stricter content policy (per-request nonces instead of `'unsafe-inline'`).
- A shared cache for the page gate's "session is live" memory, if the web runs on many short-lived instances.
- Dark mode for the public pages, if wanted; today they are light by design.
- Queue-backed delivery for broadcasts and email if volumes outgrow in-process batches.

## Post-MVP

Deliberately not being built now. Nothing in the app depends on these.

| Item | Notes |
| --- | --- |
| Mobile app | `apps/mobile` is an Expo starter, outside the workspace and CI |
| Apple sign-in | Code path kept behind `APPLE_SIGN_IN_ENABLED`; needs an Apple Developer setup and the Firebase provider |
| SMS: phone numbers on accounts, OTP | The API has an `SmsProvider` port with no adapter |
| Alternative address verification (phone OTP, estate code, neighbour invite) | |
| Public neighbourhood pages and logged-out post previews | Posts are private to a Hood today |
| Marketplace (as a marketing-site product) | Shown as "Soon". For Sale & Free inside the app is live |
| Business Page tools: business posts, recommendations, Local Ads | Applying for and claiming a page is live |
| Hood Lead self-nomination and voting by neighbours | Staff appoint Leads today |
| Direct browser-to-storage video uploads by default | Built and off (`STORAGE_DIRECT_UPLOADS`); each one costs a storage Admin API call |
| Automated CAC (company register) check for businesses | Recorded manually by staff |
