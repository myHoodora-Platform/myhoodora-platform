# myHoodora ↔ myHoodoraAI integration contract (v1)

**Status: built on both sides, off by default** (sign-in and account events, 12–13 November 2026). **Billing left the contract on 13 November 2026** (D-105): it runs inside myHoodoraAI, and myHoodora provides sign-in only. It describes the interface both applications build to. Each side's implementation status is in its own repository: myHoodora `docs/roadmap.md`, myHoodoraAI `docs/specs/11-repo-alignment.md`.

**Identical copies** live in both repositories:

- myHoodora: `docs/integrations/myhoodora-ai.md` (`myHoodora-Platform/myhoodora-platform`)
- myHoodoraAI: `docs/specs/12-myhoodora-integration.md` (`myhoodora-hub/my-hoodora-ai`)

A change to the contract lands in **both files, in the same release**, and follows [§11 Versioning](#11-versioning). The decisions behind it are in myHoodoraAI's decision log, `docs/specs/02-decision-log.md`: D-91 to D-102 (round R8), D-105 (round R10).

---

## 1. What each application owns

| Concern                                                                                                                  | Owner                                                                                               | The other side holds                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Credentials, sign-in methods, password reset, MFA                                                                        | **myHoodora** (Firebase Authentication)                                                             | nothing                                                                  |
| A person's account state: active, suspended, closed, deleted; email; email verified; age check                           | **myHoodora** (MongoDB `users`)                                                                     | myHoodoraAI: a **snapshot**, refreshed at sign-in, by events and by pull |
| Who may use myHoodoraAI as an educator, school admin, agent or platform admin                                            | **myHoodora** asserts an adult, active account; **myHoodoraAI** decides the role inside its own app | —                                                                        |
| Organisations (institution or solo educator), roles, agents, courses, generated content, learners, progress, assessments | **myHoodoraAI** (Supabase)                                                                          | nothing                                                                  |
| **Learner accounts** (created by educators, any age)                                                                     | **myHoodoraAI** only. Learners never get a myHoodora account and are never sent to myHoodora        | nothing                                                                  |
| Subscriptions, payments (Paystack), paid seats, agents' commissions                                                      | **myHoodoraAI** (D-105–D-107)                                                                       | nothing                                                                  |

**Never shared:** databases, cookies, sessions, environment variables, secrets. Neither application reads the other's database.

## 2. Hosts and endpoints

| Name                      | URL (production)                                                    | Served by                                      |
| ------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| Issuer                    | `https://api.myhoodora.com`                                         | myHoodora API                                  |
| Discovery                 | `https://api.myhoodora.com/.well-known/openid-configuration`        | myHoodora API                                  |
| myHoodora signing keys    | `https://api.myhoodora.com/.well-known/jwks.json`                   | myHoodora API                                  |
| Authorisation endpoint    | `https://www.myhoodora.com/oauth/authorize`                         | myHoodora web (it holds the signed-in session) |
| Token endpoint            | `https://api.myhoodora.com/api/v1/oauth/token`                      | myHoodora API                                  |
| Integration API           | `https://api.myhoodora.com/api/v1/integrations/ai/…`                | myHoodora API                                  |
| myHoodoraAI sign-in start | `https://studio.myhoodora.com/auth/myhoodora/start`                 | myHoodoraAI                                    |
| Redirect URI (callback)   | `https://studio.myhoodora.com/auth/myhoodora/callback`              | myHoodoraAI                                    |
| myHoodoraAI client keys   | `https://studio.myhoodora.com/.well-known/jwks.json`                | myHoodoraAI                                    |
| Event receiver            | `https://studio.myhoodora.com/api/integrations/myhoodora/v1/events` | myHoodoraAI                                    |

The API moved to `api.myhoodora.com` on 13 November 2026. The issuer is part of every token, so changing it again means a coordinated change on both sides. Every URL above comes from configuration (§12), so staging uses its own hosts.

## 3. Clients

v1 has one client.

| Field              | Value                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| `client_id`        | `myhoodora-ai`                                                                     |
| Type               | Confidential (a server). Authenticates with `private_key_jwt` (§6)                 |
| Redirect URIs      | Exactly the callback above (per environment). **Exact string match**, no wildcards |
| Allowed age bands  | `adult`                                                                            |
| Event subscription | The receiver URL above, with its own signing secret (§8)                           |

A future client (another service, or a native app as a _public_ client using PKCE and a claimed https redirect) is added to myHoodora's client registry, with no change to this contract.

## 4. Signing in (authorisation code with PKCE)

This is the only way **educators and school admins** sign in to myHoodoraAI (D-91). **Learners** sign in to myHoodoraAI directly and are not part of this flow.

### 4.1 Flow

1. The person chooses "Continue with myHoodora" on myHoodoraAI, which goes to `/auth/myhoodora/start`.
2. myHoodoraAI creates `state` (≥ 128 random bits), `nonce` (≥ 128 bits) and a PKCE `code_verifier` (43–128 chars). It stores all three in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie on its own host, valid for 10 minutes. Then it redirects to the authorisation endpoint:

   ```text
   https://www.myhoodora.com/oauth/authorize
     ?response_type=code
     &client_id=myhoodora-ai
     &redirect_uri=https%3A%2F%2Fstudio.myhoodora.com%2Fauth%2Fmyhoodora%2Fcallback
     &scope=openid%20email%20profile
     &state=…
     &nonce=…
     &code_challenge=BASE64URL(SHA256(code_verifier))
     &code_challenge_method=S256
   ```

3. myHoodora web checks `client_id` and `redirect_uri` **before anything else**. If either is wrong it shows an error page and **does not redirect**.
4. If the person isn't signed in to myHoodora, they sign in or sign up there with the usual flows. Before a code is issued, myHoodora takes them through whatever is missing: the age check, the current Terms and Privacy Policy, and confirming their email. It does **not** require address verification or a Hood: those are for the neighbourhood product only.
5. myHoodora issues a **single-use code**, valid for **60 seconds**, bound to the client, the redirect URI, the code challenge and the nonce, and stored hashed. It then redirects to `redirect_uri?code=…&state=…`.
6. myHoodoraAI checks that `state` equals the cookie's, deletes the cookie, and redeems the code at the token endpoint (§4.3).
7. myHoodoraAI verifies the ID token (§5.3) and finds or creates the local user by `sub`. It then starts its **own Supabase session**, and myHoodora is not involved again until the next sign-in.

### 4.2 Who gets a code

A code is issued only when **all** of these hold:

| Rule                                                  | Otherwise                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| The account exists and isn't deleted or being deleted | `access_denied`, `account_closed`                                                               |
| It isn't deactivated by its owner                     | `access_denied`, `account_closed` (myHoodora first offers "Reactivate")                         |
| `accountStatus` isn't `suspended`                     | `access_denied`, `account_suspended`                                                            |
| The age check is passed (18 or over)                  | myHoodora asks first; under 18 is closed exactly as today, and there is no redirect with a code |
| The email address is confirmed                        | myHoodora asks first; `access_denied`, `email_unverified` if they leave                         |
| The current Terms and Privacy Policy are agreed       | myHoodora asks first                                                                            |
| The client allows the person's age band               | `access_denied`, `not_eligible`                                                                 |

`restricted` (a neighbourhood moderation sanction) **doesn't** stop sign-in to myHoodoraAI.

### 4.3 Redeeming the code

`POST https://api.myhoodora.com/api/v1/oauth/token`, `Content-Type: application/x-www-form-urlencoded`:

| Field                   | Value                                                    |
| ----------------------- | -------------------------------------------------------- |
| `grant_type`            | `authorization_code`                                     |
| `code`                  | from the callback                                        |
| `redirect_uri`          | the same as in step 2                                    |
| `code_verifier`         | from the cookie                                          |
| `client_id`             | `myhoodora-ai`                                           |
| `client_assertion_type` | `urn:ietf:params:oauth:client-assertion-type:jwt-bearer` |
| `client_assertion`      | a JWT per §6, with `aud` = the token endpoint URL        |

**200:**

```json
{ "id_token": "eyJ…", "token_type": "Bearer", "expires_in": 300 }
```

v1 issues **only an ID token**. There is no access token, refresh token or userinfo endpoint: myHoodoraAI needs the identity once, at sign-in.

**Errors** (RFC 6749 §5.2, JSON `{ "error", "error_description" }`):

| Status | `error`                   | When                                                                                               |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------- |
| 400    | `invalid_grant`           | Code unknown, expired, already used, or the verifier, redirect URI or client don't match           |
| 400    | `invalid_request`         | A field missing or malformed                                                                       |
| 400    | `unsupported_grant_type`  | Anything but `authorization_code`                                                                  |
| 401    | `invalid_client`          | Client assertion missing, invalid, expired or replayed                                             |
| 503    | `temporarily_unavailable` | Firebase or the database can't be reached. Not retried with the same code; the person starts again |

A code is spent by its first redemption, even one that fails after the code check. **Never retry a code exchange.**

### 4.4 Errors sent back to the callback

`redirect_uri?error=…&error_description=…&state=…`:

| `error`                                   | `error_description` | myHoodoraAI shows                                                |
| ----------------------------------------- | ------------------- | ---------------------------------------------------------------- |
| `access_denied`                           | `cancelled`         | Back to its sign-in page, no message                             |
| `access_denied`                           | `account_suspended` | "Your myHoodora account is suspended."                           |
| `access_denied`                           | `account_closed`    | "Your myHoodora account is closed."                              |
| `access_denied`                           | `email_unverified`  | "Confirm your email address on myHoodora first."                 |
| `access_denied`                           | `not_eligible`      | "This myHoodora account can't be used for myHoodoraAI."          |
| `server_error`, `temporarily_unavailable` | —                   | "myHoodora sign-in is unavailable right now. Try again shortly." |

## 5. The ID token

### 5.1 Format

A JWS, **ES256**, header `{ "alg": "ES256", "kid": "<key id>", "typ": "JWT" }`. No other algorithm is accepted on either side.

### 5.2 Claims

| Claim              | Value                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `iss`              | `https://api.myhoodora.com`                                                                                                                                                                                                                       |
| `aud`              | `myhoodora-ai`                                                                                                                                                                                                                                    |
| `sub`              | **Pairwise subject**: `base64url(HMAC-SHA256(pairwise_secret, "myhoodora-ai:" + firebase_uid))`, unpadded, 43 characters. Stable for this person and this client, and different for every other client. myHoodoraAI never learns the Firebase uid |
| `iat`, `exp`       | `exp = iat + 300`                                                                                                                                                                                                                                 |
| `auth_time`        | When the person last signed in to myHoodora                                                                                                                                                                                                       |
| `nonce`            | As sent in §4.1                                                                                                                                                                                                                                   |
| `email`            | The myHoodora account's email                                                                                                                                                                                                                     |
| `email_verified`   | Always `true` (§4.2)                                                                                                                                                                                                                              |
| `name`             | Display name, when set                                                                                                                                                                                                                            |
| `hm_status`        | `active` or `restricted` (closed and suspended accounts never get a token)                                                                                                                                                                        |
| `hm_age_band`      | `adult` (v1 issues no other value)                                                                                                                                                                                                                |
| `hm_age_assurance` | `self_declared_dob` (stronger methods would add values)                                                                                                                                                                                           |
| `hm_contract`      | `"1"`                                                                                                                                                                                                                                             |

Example payload:

```json
{
  "iss": "https://api.myhoodora.com",
  "aud": "myhoodora-ai",
  "sub": "Qm9vX2V4YW1wbGVfcGFpcndpc2Vfc3ViamVjdF9pZAA",
  "iat": 1794470400,
  "exp": 1794470700,
  "auth_time": 1794470380,
  "nonce": "n-0S6_WzA2Mj",
  "email": "ada@example.com",
  "email_verified": true,
  "name": "Ada Obi",
  "hm_status": "active",
  "hm_age_band": "adult",
  "hm_age_assurance": "self_declared_dob",
  "hm_contract": "1"
}
```

### 5.3 What myHoodoraAI checks

All of these, or the sign-in fails:

- signature against myHoodora's JWKS, `alg` = ES256 only, `kid` known (on an unknown `kid`, re-fetch the JWKS **at most once a minute**);
- `iss`, `aud`, and `exp` with ≤ 60 seconds of clock skew;
- `nonce` equals the cookie's;
- `hm_contract` is a version it supports;
- `hm_age_band` is `adult` for educators and school admins, also **enforced in its database** (D-92);
- `hm_status` is `active` or `restricted`.

A claim is never taken from the browser, a query string or form input. The only source is the verified token (or the events and pull in §§8–9).

## 6. myHoodoraAI authenticating to myHoodora (client assertion)

Used at the token endpoint and on every Integration API call. A JWT signed by myHoodoraAI:

| Claim        | Value                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| header       | `{ "alg": "ES256", "kid": "<myHoodoraAI key id>", "typ": "JWT" }`                                                             |
| `iss`, `sub` | `myhoodora-ai`                                                                                                                |
| `aud`        | The exact URL being called for the token endpoint; `https://api.myhoodora.com/api/v1/integrations/ai` for the Integration API |
| `iat`, `exp` | `exp ≤ iat + 60`                                                                                                              |
| `jti`        | A fresh UUID. myHoodora refuses a `jti` it has seen within 5 minutes (replay)                                                 |

On the Integration API it is sent as `Authorization: Bearer <assertion>`.

myHoodora verifies it with myHoodoraAI's public keys from `https://studio.myhoodora.com/.well-known/jwks.json`, cached for up to an hour. **Key rotation:** myHoodoraAI publishes the new key, waits an hour, signs with it, and removes the old key after another hour. The private key never leaves myHoodoraAI's server environment.

## 7. Integration API (myHoodoraAI → myHoodora)

Base `https://api.myhoodora.com/api/v1/integrations/ai`. JSON. Authenticated per §6. Errors use the platform's shape plus a machine code: `{ "statusCode": 404, "message": "…", "code": "unknown_subject" }`.

### 7.1 `GET /subjects/{sub}`: an account's current state

The safety net for missed events (§9). **200:**

```json
{
  "sub": "Qm9v…",
  "status": "active",
  "email": "ada@example.com",
  "email_verified": true,
  "age_band": "adult",
  "updated_at": "2026-11-12T09:30:00Z"
}
```

`status` is one of `active`, `restricted`, `suspended`, `deactivated`, `deleted`. **404** `unknown_subject`: no person has signed in to this client with that `sub`.

### 7.2–7.4 Removed

Organisation registration, learner counts and subscription state were removed on 13 November 2026, before either side built them: billing runs inside myHoodoraAI (D-105). The numbers are kept so references to §7.5 stay valid.

### 7.5 Limits and retries

|                 | Limit        | myHoodoraAI retries                                                                                     |
| --------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| Token endpoint  | 60 a minute  | Never (codes are single-use)                                                                            |
| Integration API | 600 a minute | Once, after 1 to 2 seconds, on a network error, 429, 502, 503 or 504. Every call has a 5-second timeout |

A 429 carries `Retry-After`.

## 8. Events (myHoodora → myHoodoraAI)

### 8.1 Delivery

`POST https://studio.myhoodora.com/api/integrations/myhoodora/v1/events`, signed with **Standard Webhooks**, as in myHoodora's `communications/webhook-signature.ts`:

| Header              | Value                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `webhook-id`        | The event `id`                                                                                          |
| `webhook-timestamp` | Unix seconds                                                                                            |
| `webhook-signature` | `v1,<base64 HMAC-SHA256(secret, id.timestamp.body)>`; during a rotation, two space-separated signatures |

myHoodoraAI:

- refuses a bad signature, or a timestamp more than 5 minutes off (**401**);
- stores the `id` and answers **200** to a repeat without applying it again;
- answers 2xx within 10 seconds, and does slow work afterwards.

myHoodora delivers from a durable outbox: its `jobs` collection, written as soon as the change that caused the event is saved (not in the same transaction, so an event can very rarely be lost; §9 covers it). An `account.updated` carries the account's state when it's delivered, not when it was queued. Each event is tried within 10 seconds and then after 1 min, 5 min, 30 min, 2 h, 6 h and 12 h (about 20 hours in all), and then logged for staff (dead letter). A 2xx is delivered; 400, 401, 404 and 422 are permanent failures; everything else (including no answer within 10 seconds) is retried. A retry keeps the event's `id` and `occurred_at`.

Events are sent only for people who have signed in to myHoodoraAI.

### 8.2 Envelope

```json
{
  "id": "evt_01JDXQ8N3V7Q4Y2H5K9M0P1R2S",
  "type": "account.updated",
  "version": 1,
  "occurred_at": "2026-11-12T09:30:00.123Z",
  "data": {}
}
```

Events can arrive **out of order**. `account.updated` carries the **whole current state**, so the receiver applies one only if its `occurred_at` is newer than the last applied for that `sub`.

### 8.3 Types

| `type`                     | `data`                              | When                                                                                                             |
| -------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `account.updated`          | The same shape as §7.1              | Suspended or reinstated; deactivated or reactivated; deletion scheduled or cancelled; email changed or confirmed |
| `account.sessions_revoked` | `{ "sub": "…", "revoked_at": "…" }` | "Sign out everywhere"; deactivation. (A password reset happens in Firebase, which myHoodora's API doesn't hear)  |
| `account.deleted`          | `{ "sub": "…", "deleted_at": "…" }` | The account is gone for good. That `sub` is never used again                                                     |

(`subscription.updated` was removed with billing, D-105. A receiver acknowledges any type it doesn't know, §11.)

### 8.4 What myHoodoraAI does with each

| Event or state                                      | myHoodoraAI                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `account.updated` with `active` or `restricted`     | Updates the snapshot; signing in is allowed                                                                                                                                                                        |
| `account.updated` with `suspended` or `deactivated` | Ends every session of that user and refuses sign-in and token refresh until a later `active`                                                                                                                       |
| `account.sessions_revoked`                          | Ends every session of that user; they can sign in again                                                                                                                                                            |
| `account.deleted`                                   | Closes the myHoodoraAI account: sessions end, then its own deletion rules run. Courses are kept 30 days and the organisation's other admins are alerted; learners are never left without an owner silently (D-102) |

Seats, subscriptions and publishing rules (D-98, D-99, D-106) are myHoodoraAI's own and don't depend on myHoodora.

## 9. Keeping in step when something is missed

- **At sign-in**, the ID token refreshes the account snapshot.
- **On each request**, myHoodoraAI refuses a user whose snapshot isn't `active` or `restricted`. When the snapshot is more than 15 minutes old, it refreshes it with §7.1, in the background, without blocking the page.
- **Nightly**, it re-reads every linked account (§7.1).
- **Sessions** in myHoodoraAI: access tokens last 10 minutes, with refresh-token rotation and a 7-day maximum session. A token issue or refresh checks the snapshot in the database. So once the snapshot changes (by event, pull or sign-in), a session that makes no further requests still ends within 10 minutes.

## 10. When one side is down

| Situation                              | Effect                                           | Behaviour                                                                                                                   |
| -------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| myHoodora API down                     | No new sign-ins for educators, admins and agents | Existing myHoodoraAI sessions continue. Learners and billing are unaffected. The sign-in page says myHoodora is unavailable |
| myHoodora web down                     | No new educator sign-ins                         | As above                                                                                                                    |
| myHoodoraAI down                       | myHoodora unaffected                             | Events queue for up to 24 hours, then dead-letter. The nightly reconciliation catches up                                    |
| Google (Firebase) outage               | myHoodora answers 503 at authorise and token     | myHoodoraAI shows "try again"; never treated as a sign-out                                                                  |
| A myHoodora signing key is compromised | Forged ID tokens possible                        | Rotate: new `kid`, remove the old one from the JWKS. myHoodoraAI refuses the removed `kid` after its next JWKS fetch        |

## 11. Versioning

- This is **v1**: paths contain `/v1/`, ID tokens carry `hm_contract: "1"`, events carry `version: 1`.
- **Not breaking** (stays v1): a new optional request field, a new response or event field, a new event type, a new value in a list (`status`, `error_description`) that receivers handle with a fallback. **Receivers ignore fields and event types they don't know.**
- **Breaking** (needs v2): removing or renaming a field, changing a type or meaning, a new required field, a new value that changes what a receiver must do, a different algorithm or signature scheme.
- Shipping v2: the receiving side accepts v1 and v2 first; then the sending side switches; then v1 is removed, by agreement, with both files updated in the same release. There are no installed apps in this contract, so there is no fixed sunset window.

## 12. Configuration

Names only; values live in each host's secret settings.

| Application   | Variable                                                                      | Secret  | Purpose                                                                                |
| ------------- | ----------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| myHoodora API | `OIDC_ISSUER`                                                                 | no      | `https://api.myhoodora.com`                                                            |
| myHoodora API | `OIDC_SIGNING_KEYS`                                                           | **yes** | Private ES256 keys (JWK set, with `kid`s); the first one signs                         |
| myHoodora API | `OIDC_PAIRWISE_SECRET`                                                        | **yes** | For `sub` (§5.2). **Changing it changes every `sub`**: never rotate it casually        |
| myHoodora API | `AI_CLIENT_JWKS_URL`                                                          | no      | `https://studio.myhoodora.com/.well-known/jwks.json`                                   |
| myHoodora API | `AI_CLIENT_REDIRECT_URIS`                                                     | no      | The callback URL(s)                                                                    |
| myHoodora API | `AI_EVENTS_URL`                                                               | no      | The event receiver                                                                     |
| myHoodora API | `AI_EVENTS_SECRET`                                                            | **yes** | `whsec_…` signing secret; two, space-separated, while rotating                         |
| myHoodora API | `AI_INTEGRATION_ENABLED`                                                      | no      | `false` turns sign-in codes and events off (rollback switch)                           |
| myHoodoraAI   | `MYHOODORA_ISSUER`                                                            | no      | Must equal the issuer exactly                                                          |
| myHoodoraAI   | `MYHOODORA_AUTHORIZE_URL`, `MYHOODORA_TOKEN_URL`, `MYHOODORA_INTEGRATION_URL` | no      | Taken from discovery where possible                                                    |
| myHoodoraAI   | `MYHOODORA_CLIENT_ID`                                                         | no      | `myhoodora-ai`                                                                         |
| myHoodoraAI   | `MYHOODORA_CLIENT_KEYS`                                                       | **yes** | Private ES256 keys for client assertions; the public halves are served at its JWKS URL |
| myHoodoraAI   | `MYHOODORA_EVENTS_SECRET`                                                     | **yes** | The same `whsec_…` value(s) as `AI_EVENTS_SECRET`                                      |
| myHoodoraAI   | `MYHOODORA_SSO_ENABLED`                                                       | no      | Shows "Continue with myHoodora"                                                        |

Every secret is server-side only: never `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

## 13. Security requirements (both sides)

- Only TLS. Cookies are **host-only** on both sides (`__Host-session` on myHoodora web; Supabase's cookies on studio). **Never** set `Domain=.myhoodora.com`.
- No browser call crosses between the applications, so myHoodora's `CORS_ORIGIN` doesn't change.
- Exact redirect URIs; `state`, `nonce` and PKCE are required; codes are single-use, last 60 seconds and are stored hashed; client assertions are single-use.
- **Never log** tokens, codes, assertions, secrets, `sub`-to-uid mappings or email addresses. Log error codes, event ids and the client id.
- Claims and events are the **only** sources of a person's age band and account state in myHoodoraAI. They are written by its server into its database, where its access rules read them; no client can write them.
- Learner data never leaves myHoodoraAI: nothing about learners crosses to myHoodora.
- Every endpoint here has tests: the happy path, and each rejection listed in §§4–8 (bad or missing signature, wrong `aud`, expired, replayed, unknown `kid`, wrong redirect URI, reused code, wrong verifier, stale event, unknown subject).

## 14. Not in v1

- Signing in to the myHoodora mobile app and going to myHoodoraAI without signing in on the web: the app opens myHoodoraAI in the browser, and the person signs in there once. A one-time hand-off from app to web is planned separately.
- Learners signing in through myHoodora: learners keep myHoodoraAI accounts (D-91).
- Under-18 myHoodora accounts: myHoodora stays 18 and over (D-92). `hm_age_band` leaves room for more values without a new version of the token.
- Billing: not part of this contract. It runs inside myHoodoraAI (D-105).
