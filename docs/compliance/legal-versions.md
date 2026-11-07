# Legal document versions

How the Terms of Use and the Privacy Policy are versioned, kept, and agreed to. Built 3 November 2026, following Nextdoor, which names its documents by version ("Privacy Policy 2026", "Member Agreement 2024"), keeps older versions, and notifies members of material changes.

## The pieces

| What | Where |
| --- | --- |
| Every version, newest first: its date, whether it's **material**, and what changed | `packages/api-contract/src/legal.ts` (`LEGAL_VERSIONS`) |
| The versions members must have agreed to (API copy, checked against the above by a test) | `apps/api/src/users/domain/legal.ts` (`CURRENT_LEGAL`), `legal.spec.ts` |
| The current text | `apps/web/src/components/legal/terms.tsx`, `privacy-policy.tsx` |
| Earlier versions, word for word | `apps/web/src/components/legal/archive/` (`terms-2026-09-28.tsx`, `privacy-2026-09-28.tsx`), served at `/terms/versions/<version>` and `/privacy/versions/<version>` (not indexed) |
| "What changed" and links to earlier versions, on every legal page | `components/legal/version-history.tsx` |
| Each member's agreements | `users.legalAcceptances`: `{ doc, version, at, via: "signup" \| "prompt" }`, the last 20 kept. `GET /users/me` → `legal: { terms, privacy }` (newest of each) |

## Agreeing

- **Email sign-up:** ticking "I agree" on the form is the agreement, recorded straight after the account is made (`via: "signup"`), with the versions on screen.
- **Google, Apple and One Tap sign-ups**, and members after a material change, see a screen they can't skip: web `/accept-terms`, app `needsTerms` phase. It comes after "Welcome back" and the age check, and before onboarding. A new account sees "Before you join". A member sees "We've updated our terms", with each change since the version they agreed to. The only ways out are "I agree", signing out, or deleting the account.
- `POST /users/me/legal { terms, privacy, via }` accepts only the current versions (`409` if either changed while they were reading).
- The API doesn't refuse other requests while someone hasn't agreed: blocking would break app builds from before this. The clients hold the gate. Their agreements are the proof we keep (GAID: records of consent).
- On deletion, the agreement records are removed with the rest of the account.

## Publishing a new version

1. **Copy the current text into `archive/`** as `<doc>-<current version>.tsx`, unchanged except the function name and a "frozen" comment, and add it to `archive/index.ts`.
2. Edit the current text.
3. Add the new version at the **top** of `LEGAL_VERSIONS[doc]`, dated the day it takes effect, with one line per change. Never edit or remove a published version.
4. **Material or not?** Material means a new use of data, a new provider category, a new right or obligation, a change to how leaving works, or anything a member would want to object to. A typo or a clearer sentence isn't. For material: `material: true`, update `CURRENT_LEGAL` in the API (the test fails otherwise), and every member is asked again on their next visit.
5. **If the change touches app usage analytics** (what it collects or why), set `ANALYTICS_POLICY_VERSION` in `packages/api-contract/src/app-config.ts` to the new version, so every phone is asked the analytics question again.
6. For a material change, tell members **before** it takes effect (the policy's §13 promises in-app or email notice). Date the version for when it applies.
7. Deploy the API and the web together, then an app build. Older app builds don't know the new gate. They keep working, and their users are asked on the web or after updating.

Today: Terms `2026-11-03` (material), Privacy Policy `2026-11-07` (material: opt-in app usage analytics, effective the day it was published, as approved). Earlier versions: Terms `2026-09-28`; Privacy Policy `2026-11-03` and `2026-09-28` (the first published).
