# Authentication and sessions

## The pieces

| Piece | Lives in | Says | Lifetime |
| --- | --- | --- | --- |
| Firebase sign-in | The browser (IndexedDB) | Who is signed in. **The source of truth** | Until logout, revocation, or the account is disabled |
| ID token | Sent with every API call | "This request is from user X" | 1 hour; Firebase renews it silently |
| Session cookie | The browser, `HttpOnly` | "Serve this person signed-in pages" | 7 days; renewed past half-life while the app is in use |

The API checks the ID token (and whether it has been revoked) on **every** request. The signature check is local; the revocation check compares the token's sign-in time with two things: our own record of "sign out everywhere" (immediate), and Firebase's record, which is re-read at most once per user every 30 seconds. The session cookie never fetches data: it only tells the web server which page to send.

## Signing in

1. The person signs in with Firebase in the browser: email + password, the "Continue with Google" pop-up, or Google One Tap.
2. `AuthContext` sees the new user (`onIdTokenChanged`) and calls `POST /api/auth/session` (a Next route) with the ID token.
3. That route asks the API (`POST /auth/session`, bearer ID token). The API verifies the token, including revocation, and mints a Firebase session cookie with the Admin SDK.
4. The route sets it as an `HttpOnly` cookie. The value never reaches page script.
5. Only then does the app navigate to a protected page, with a full page load.

There is one implementation of steps 2–4 (`lib/auth/session-sync.ts`); concurrent callers share one request.

### States in `AuthContext`

| State | Means |
| --- | --- |
| `authReady` | Firebase has said who (if anyone) is signed in. Enough to draw signed-in or signed-out UI |
| `sessionReady` | The cookie is in place for this person; protected pages will load |
| `loading` | Still settling (first auth state, session, profile, or a stale cookie being cleared). Don't treat "no user" as signed out until it is false |

Nothing navigates into a protected page on `authReady` alone. Doing so was the original bug: the navigation raced the cookie and the proxy answered with the login page.

## The page gate (`apps/web/src/proxy.ts`)

For each page request:

1. No cookie → signed out.
2. Cookie present → verify signature, issuer, audience and expiry locally with the Admin SDK (project ID only; no secret in the web app).
3. Ask the API whether the session is still **live** (`GET /auth/session`, which checks revocation). The answer "live" is remembered for 60 seconds per server instance; simultaneous requests share one call.
4. A forged, expired or revoked cookie is deleted in the response and treated as signed out.

Then: public pages are served to everyone; `/`, `/login`, `/register` and `/forgot-password` send a signed-in person into the app; everything else sends a signed-out person to `/login?next=…`. `/admin` additionally asks `GET /auth/session/staff`, and non-staff get the ordinary 404.

If the API cannot be reached, a cookie that verified locally is accepted and the page shows its own "can't reach myHoodora" state; an API restart must not sign everyone out.

**Consequence to know:** after a revocation, pages stop being served within 60 seconds at most (immediately for a cookie the server hasn't seen in the last minute).

### How fast each kind of revocation takes effect at the API

| What happened | Data access stops |
| --- | --- |
| "Sign out everywhere" in the app | Immediately, on every API instance (recorded as `sessionsRevokedAt` on the user) |
| Staff suspend the account in the admin | Immediately (`accountStatus`) |
| Password reset, or the user disabled or deleted in the Firebase console | Within 30 seconds (`AUTH_REVOCATION_CACHE_SECONDS`; `0` makes it immediate at the cost of a call to Google on every request) |

## Signing out

- **Log out** signs out of Firebase in this browser and clears this browser's cookie. Other browsers and devices stay signed in. Other tabs of the same browser follow within moments.
- **Sign out everywhere** (Settings → Account) calls `POST /auth/logout-everywhere`, which revokes every refresh token: all ID tokens and session cookies for the account stop working, on every device. Then this browser is signed out normally.
- **Firebase signed out but a cookie remains** (session expired, account disabled): the client clears the cookie itself, but only when it has reason to think one exists. An anonymous visitor on a public page makes no logout request.

## Google sign-in

- **Button:** `signInWithPopup` opens Google's own window. Closing it is not an error.
- **One Tap:** for signed-out visitors on `/`, `/login` and `/register`, the page asks Google Identity Services for its "Continue as …" prompt. Google (or the browser, through FedCM) draws it; we receive a Google ID token and pass it to Firebase (`signInWithCredential`), so it is the same account as the button.
  - Needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and the site's origin under **Authorised JavaScript origins** for that OAuth client in Google Cloud Console.
  - Never shown to signed-in users. Shows nothing when the visitor has no Google session. Closing it is respected: Google backs off for a growing period. No automatic sign-in (`auto_select` is off).
- **New Google user:** the first `GET /users/me` creates their record (email already counted as verified, no confirmation email) and they go to onboarding.
- **Existing account, any sign-in method:** the record is found by Firebase UID and returned as it is. Signing in never recreates or overwrites it: name, photo, bio, Hood, role, onboarding and creation date are untouched, and no welcome email is sent. The single thing a Google sign-in can add is marking the email as confirmed. (Integration-tested: `communications.e2e-spec.ts`, "Google sign-in to an account that already exists…".)
- **Same email already registered with a password:** Firebase's default ("one account per email address") gives Google the **same UID**, so it is the same myHoodora account. If that password account's email was verified, both methods work afterwards. If it was never verified, Firebase makes Google the only sign-in method and removes the password (its protection against someone pre-registering your address); the account and its data are unchanged, and "Forgot my password" sets a password again.
- **Check once in the console:** Firebase → Authentication → Settings → User account linking must be "Link accounts that use the same email" (the default). The other setting would create a second, empty account for the same address.
- **Apple** is off (`APPLE_SIGN_IN_ENABLED` in `components/shared/social-auth-buttons.tsx`). To enable later: configure the Apple provider in Firebase, then flip the flag.

### How this maps to Google's guidance

Google's documentation describes a site that talks to Google itself: get a Google credential, verify it on your server, find or create the user, issue your own session. Here **Firebase Authentication is that layer**, which is what Google means by "use an established library rather than implementing OAuth yourself":

| Google's step | Here |
| --- | --- |
| Show Google's button / One Tap | `signInWithPopup` (Firebase) and Google Identity Services with FedCM |
| Verify the Google credential on a server | Firebase's servers verify it and issue a Firebase ID token. Our API verifies *that* token with the Admin SDK on every request. The browser's claim about an email is never trusted |
| CSRF / `state` protection | Handled inside the Firebase SDK (pop-up flow) and by FedCM (One Tap). We never handle an authorisation code or redirect ourselves |
| Find or create the user | `GET /users/me`, keyed by the Firebase UID (stable across Google and password sign-in for the same address) |
| Your own session | The Firebase ID token for data; the session cookie for page routing |
| Scopes | Default only: name, email, photo. No Drive, Calendar, Gmail or Contacts. No Google access token is stored |
| Account linking | Firebase's "one account per email address": Google and password resolve to the same UID |

The One Tap client ID **must** be the OAuth web client of the Firebase project's Google provider (or one safelisted there); Firebase rejects a Google ID token issued for any other client. The button always shows Google's account chooser (`prompt=select_account`).

### Verified, and not

Verified automatically: the button opens Google's window and cancelling is silent; the One Tap script, style and FedCM endpoints load within the content policy; nothing is requested for signed-in users.

**Not verified:** completing a Google sign-in (new, existing or returning user), because it needs a real Google account. Click it through once on each environment before launch.

## Email verification and password reset

- **Password reset:** Firebase sends the email; the link returns to `/reset-password`.
- **Email verification:** our own single-use, 24-hour tokens (stored hashed), sent in the welcome email. `/verify-email` confirms it and syncs Firebase's `emailVerified`. Google accounts are verified from the start. It is a nudge (a banner), not a gate: posting depends on address verification.

## Mock mode

With `NEXT_PUBLIC_USE_MOCKS=true` there is no API, so there is **no server session and no page gate**: the proxy lets every request through, `/api/auth/session` answers "ok" without a cookie, and the pages turn signed-out visitors away in the browser. Never deploy a mock build as the real site.

## Decisions that differ from Firebase's sample

Firebase's session-cookie sample turns client persistence off and refuses tokens older than five minutes. This app keeps Firebase signed in on the client (the API depends on ID tokens) and re-creates the cookie from a restored session, so it does neither. The cookie is deliberately worth little: page routing only.
