# API Contract: What the Frontend Expects

The frontend is built **contract-first**. Every screen already works against the shapes below. Where an endpoint doesn't exist yet, `apps/web` serves it from an in-browser mock store with the same shape, and the UI labels that area "Preview".

**How to ship an endpoint**
1. Implement it to match this doc.
2. Flip its key from `"planned"` to `"live"` in `apps/web/src/lib/api/config.ts` (`ENDPOINTS`).

No UI changes are needed.

**Sources of truth**
- Types: `apps/web/src/lib/api/types.ts`
- Calls: `apps/web/src/lib/api/*.ts`
- Mock behaviour (a working reference implementation): the non-live branch in each service

**Conventions**
- Auth: `Authorization: Bearer <Firebase ID token>`.
- IDs are strings. Dates are ISO 8601 strings.
- Errors return `{ message: string | string[] }` with a proper status. See §0 for how each status is shown.
- Everything is scoped to the caller's **own** `neighborhoodId`, from their profile, never from the client. The API must enforce this.
- "Viewer-relative" fields (`myReaction`, `membership`, `myStatus`, `unreadCount`) are computed for the calling user.

Run the whole app without a backend: `NEXT_PUBLIC_USE_MOCKS=true pnpm --filter web dev`.

---

## 0. Errors, timeouts and bad networks

The client (`apps/web/src/lib/api/client.ts`) classifies every failure. The backend only needs to return **correct status codes**:

| Situation | Status | What the neighbour sees |
| --- | --- | --- |
| Validation problem | 400 / 422 with `message` | Your `message`, shown verbatim next to the form. Keep it human, e.g. "Price must be more than ₦0". |
| Token missing or expired | 401 | "Your session has expired" + **Log in again** button |
| Not allowed (not your post, private group) | 403 | "You don't have access to this." |
| Doesn't exist, or outside the caller's neighbourhood | 404 | Screen-specific "isn't available" state |
| Already done (e.g. voted twice) | 409 | Treated as success where idempotent |
| Poll closed, listing sold | 410 | Screen-specific message |
| Too many requests (the rate limiter; always has a `Retry-After` header, in seconds) | 429 + `Retry-After` | "You're doing that a lot. Give it a moment and try again." Reads wait that long and retry once, unless it is more than 10 s |
| One of our own daily or hourly rules (urgent alerts, new conversations, uploads…) | 429, no `Retry-After`, with `message` | Your `message`, shown verbatim. Not retried |
| Server error | 5xx | "Something went wrong on our side", with **one automatic retry** for reads |
| The API can't reach Firebase to check a sign-in | 503 | Same as any 5xx. **Never 401**: the web signs the person out on a 401 (§26) |
| No response within **15 s** | — | "Your connection is slow" |
| Device offline | — | Offline banner. The last loaded feed stays on screen with "Showing posts from 5m ago · Retry". The composer keeps the draft. |

Only 400/422 `message` strings (and a 429 without `Retry-After`) are shown verbatim. For 401, 403 and 5xx the client uses its own wording, so never put stack traces or internals in those messages.

**Performance:** keep feed responses small. Page size is 10, and author and neighbourhood fields should be embedded (see §3) to avoid N+1 requests. This matters a lot on Nigerian mobile data.

---

## Status overview

| Key (`config.ts`) | Status | Endpoints |
| --- | --- | --- |
| `posts.list` | ✅ live | `GET /posts/neighborhood/:id?limit&before&category&since` (legacy `skip` still accepted) |
| `posts.create` | ✅ live | `POST /posts` |
| `posts.like` | ✅ live | `PATCH /posts/:id/like` (alias for the `like` reaction) |
| `posts.delete` | ✅ live | `DELETE /posts/:id` |
| `posts.get` | ✅ live | `GET /posts/:id` |
| `posts.reaction` | ✅ live | `PUT/DELETE /posts/:id/reaction` |
| `polls` | ✅ live | `GET /posts/:id/poll`, `PUT /posts/:id/poll/vote`, `DELETE /posts/:id/poll/vote` |
| `alerts` | ✅ live | `PATCH /posts/:id/alert` (resolve); `activeUntil` + `resolvedAt` on alert posts |
| `comments` | ✅ live | `GET/POST /posts/:id/comments`, `DELETE /comments/:id` |
| `users.publicProfile` | ✅ live | `GET /users/:uid/public` |
| `listings` | ✅ live | `GET/POST /listings`, `GET/PATCH/DELETE /listings/:id` |
| `groups` | ✅ live | All of §8, plus `GET /users/search` and `GET /groups/:id?invite=` |
| `events.rsvp` | ✅ live | `GET/PUT/DELETE /posts/:id/rsvp` |
| `chat` | ✅ live | `GET/POST /conversations`, `GET /conversations/unread-count`, `GET /conversations/:id`, `GET/POST /conversations/:id/messages` |
| `notifications` | ✅ live | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id`, `POST /notifications/read-all` |
| `reports` | ✅ live | `POST /reports` |
| `settings` | ✅ live | `GET/PATCH /users/me/preferences`, `PATCH /users/me` (displayName, bio, photoURL), `GET/POST /users/me/blocks`, `DELETE /users/me/blocks/:uid`, `POST /users/me/deactivate` |
| `support.threads` | ✅ live | `GET /support/threads`, `GET /support/threads/:id`, `POST /support/threads/:id/messages`, `GET /support/threads/unread-count`; staff `POST /admin/inbox` (§18) |
| realtime | ✅ live | `GET /realtime/stream` (SSE, §19) |
| `users.hoodRequest` | ✅ live | `verify-location` adds `nearbyHoods`; `POST/DELETE /users/me/hood-request`; `Me.requestedHood`; `VerificationCase.requestedHood` (§16) |
| `media` | ✅ live | `POST /media` (multipart), `DELETE /media/:id` (§20) |
| `search` | ✅ live | `GET /search?q&type&limit`; `q` on `GET /posts/neighborhood/:id` and `GET /listings` (§21) |
| `moderation.check` | ✅ live | `POST /moderation/check` (§22) |
| `feedback` | ✅ live | `POST /feedback` |
| `auth.emailVerification` | ✅ live | `POST /auth/email-verification/confirm` (public), `POST /auth/email-verification/resend` — see §14 |
| `business` · `business.claim` | ✅ live | `POST /business-pages/applications` (public), `POST /business-pages/claim`, `GET /business-pages/mine` |
| `ai.pilot` · `contact` · `careers` | ✅ live | §11b, §11c (public) |
| `support` | ✅ live | `POST /support` (in-app help → team inbox) |
| `telemetry` | ✅ live | `POST /telemetry/kindness` |
| `moderation.leads` · `moderation.appeals` | ✅ live | §15 |
| `admin.session` · `admin.overview` · `admin.moderation` · `admin.neighbours` · `admin.verification` · `admin.hoods` · `admin.content` · `admin.broadcasts` · `admin.insights` · `admin.team` · `admin.settings` | ✅ live | §13 (content = posts, comments, alerts) |
| `admin.businesses` · `admin.marketplace` · `admin.groups` · `admin.inbox` · `admin.signups` | ✅ live | §13.6–13.9, plus Hood Leads and appeals (§15) |

Every live row is covered by the API's integration tests (`apps/api/test/*.e2e-spec.ts`). `admin-contract.e2e-spec.ts` parses `apps/web/src/lib/api/admin/*.ts` and fails if an admin response is missing a field the web type requires.

Everything in this contract is now live. Interactive docs for every route: `/api/docs` (Swagger; on in development, and in production when `SWAGGER_ENABLED=true`).

---

## 1. Posts

### Post fields migration (important)

The `Post` schema only has `type: text | image | event | alert` and one `content` string. The frontend needs more fields, so today it stores them **inside `content`** behind a JSON prefix. This data is real and already in the database:

```
<!--mh:{"category":"alert","alertCategory":"power","urgent":true}-->
Light has been out on Admiralty Way since 6am…
```

Older event posts use `<!--event:{"date":"…","location":"…"}-->`. Both are decoded in `apps/web/src/lib/api/post-meta.ts`.

✅ **Done (pass 1).** These are first-class fields on `Post`, returned on every read. Migration `003-posts-first-class-fields` parsed existing prefixes (`pnpm --filter @myhoodora/api migrate`). `POST /posts` accepts either the fields below or the legacy encoded `content`. `content` is still returned (with the prefix) for older clients. `message` is limited to 8,192 characters and `mediaUrls` to 10 https URLs (Nextdoor's limits).

| Field | Type | Notes |
| --- | --- | --- |
| `category` | `"general" \| "recommendation" \| "for_sale" \| "alert" \| "event" \| "lost_found" \| "thanks" \| "poll"` | What the neighbour picked in the composer. Filterable. |
| `alertCategory` | `"security" \| "power" \| "water" \| "flooding" \| "traffic" \| "fire" \| "scam" \| "other"` | Required when `category = alert`. |
| `urgent` | `boolean` | Urgent alerts show an app-wide red banner for 2 h. Consider rate-limiting per user. |
| `eventDate` | ISO datetime | Required when `category = event`. |
| `eventLocation` | `string` | Required when `category = event`. |
| `thankedName` | `string` | Required when `category = thanks`. |
| `priceNaira` | `number \| null` | `for_sale` posts; `null` = free. |
| `poll` | `{ options: { id, text }[]; closesAt: ISO }` | Required when `category = poll`. 2–4 options, each 1–60 chars and unique. Durations offered: 1, 3 or 7 days. The question is the post `message`. |
| `visibility` | `"neighbourhood" \| "nearby" \| "anyone"` | Default `neighbourhood`. **Immutable after create.** Only `anyone` posts may be publicly previewable. |
| `location` | GeoJSON Point (optional) | For alert pins on the Alerts map. |
| `commentCount` | `number` | Denormalised, returned on list/get. |
| `myReaction` | `ReactionType \| null` | Viewer-relative. |
| `reactionCounts` | `Partial<Record<ReactionType, number>>` | For showing the top reactions. |
| `reactionTotal` | `number` | Sum of `reactionCounts`. |
| `author` | `{ uid, displayName, photoURL?, neighborhoodName? }` | Embedded (no N+1). |
| `activeUntil` · `resolvedAt` | ISO · ISO \| null | Alerts only. See Alert lifecycle. |
| `likes` | `string[]` | **Deprecated**, always `[]`. Use `reactionTotal` / `myReaction`. |

`lib/api/posts.ts` (`hydratePost`) reads the fields directly when present.

Feed query (all optional): `limit` 1–50 (default 10; larger values get a 400), `before=<ISO createdAt>` cursor, `category`, and `since=<ISO>`. `skip` still works (≤ 1000) but is deprecated. Asking for another Hood's feed returns 404.

### `GET /posts/:id` ✅
Returns a `Post` (same shape as the list). 404 if deleted, removed by staff, from someone you blocked, or outside the caller's neighbourhood. Malformed ids return 400.

**Later, for link previews:** a public variant that returns `{ message snippet, first image, neighbourhood name }` only for `visibility = anyone`. The page uses it in `generateMetadata` so links shared on WhatsApp show the real post.

### `PUT /posts/:id/reaction` · `DELETE /posts/:id/reaction` ✅
Body `{ type: "like" | "helpful" | "agree" | "haha" | "wow" | "sad" }`, returns the updated `Post`.

There's deliberately **no "angry"**, matching Nextdoor. A user has at most one reaction per post, and PUT replaces it.

Today the frontend toggles `PATCH /posts/:id/like` and remembers the type locally.

### Polls ✅

One question, 2–4 options, **one anonymous vote per neighbour**. Results show after you vote or when the poll closes. **While the poll is open a neighbour can change their vote (tap another option) or remove it (tap their choice again).** This is a product decision, 2026-09-28; Nextdoor votes are final.

```ts
interface PollResults {
  postId;
  counts: Record<optionId, number>;
  total: number;
  myVote: optionId | null;   // viewer-relative
  closed: boolean;           // now >= closesAt
}
```

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/posts/:id/poll` | — | `PollResults` |
| PUT | `/posts/:id/poll/vote` | `{ optionId }` | `PollResults`. Casts **or changes** the caller's vote (upsert) · **410** if closed · **400** for an unknown option |
| DELETE | `/posts/:id/poll/vote` | — | `PollResults` with `myVote: null` · **410** if closed · idempotent |

**Anonymity:**
- Store votes as `(postId, uid, optionId)` with a unique `(postId, uid)` constraint. Changing a vote updates that row; removing deletes it.
- **Never** expose who voted for what, not even to the post author.
- Consider embedding `pollResults` on the post in feed responses to avoid one request per poll card.

Mock reference: `apps/web/src/lib/api/polls.ts`.

### Alert lifecycle ✅

Alerts must not pile up into a wall. The model follows Nextdoor's green/yellow/red levels, Citizen's incident resolution, and the usual alert-fatigue rules (group, merge duplicates, expire). The frontend implements it in `apps/web/src/features/alerts/lifecycle.ts`. Move these rules server-side:

| State | Rule | UI |
| --- | --- | --- |
| **urgent** (red) | `urgent: true` and under 2 h old and not resolved | One red strip across the app. Several urgent alerts share **one** strip ("2 urgent alerts · Fire · Security"). Dismissible per session; a new urgent alert shows it again. |
| **active** (yellow) | Within its type's active window and not resolved | Summarised in one "N active alerts" card at the top of the feed, **grouped by type** ("Power · 3 reports"). In "All" they appear only in that card, not also as full posts. Shown in full under the "Alerts" chip and on the Alerts page. Counted in badges. |
| **resolved** | Author (or a lead) marked it over | Green "Resolved" tag. Moves to "Earlier this week". |
| **ended** | Active window passed | Grey "Ended" tag. Moves to "Earlier this week". |
| history | Older than 7 days | Leaves the Alerts page (still in the feed history), matching Nextdoor's 7-day map. |

**Active windows:** traffic 3 h · fire 6 h · security 12 h · power 12 h · flooding 24 h · water 24 h · other 24 h · scam 7 days.

**API asks:**
- Return `activeUntil` (ISO) and `resolvedAt` (ISO or null) on alert posts, computed with the windows above, so web and mobile agree.
- `PATCH /posts/:id/alert { resolved: true }` → `{ resolvedAt }`. Author, neighbourhood lead or admin only; 403 otherwise.
- `GET /posts/neighborhood/:id?category=alert&since=<7 days ago>` for the Alerts page. Today it only sees loaded feed pages.
- **Rate-limit urgent alerts**, e.g. 1 per user per 6 h, to protect the red state. Consider requiring verification for urgent alerts.
- **Notifications:** bundle alerts of the same type within 30 minutes into one notification ("3 power updates"). Push urgent alerts immediately. Put everything else into the bundle or digest per the user's preferences. Preview implementation: `lib/api/notifications.ts`.
- **Later:** merge reports of the same incident (same type, within ~500 m and ~30 min) into one incident with updates, as Citizen does.

---

## 2. Comments ✅

```ts
interface Comment { _id; postId; authorUid; content; createdAt; likes: string[] }
```

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/posts/:id/comments?before&limit` | — | `Comment[]`: the newest page (up to 500), oldest first. `before=<comment id>` gives the page before it (§26) |
| POST | `/posts/:id/comments` | `{ content }` (1–1000 chars) | `Comment` |
| DELETE | `/comments/:id` | — | 204 (author, or neighbourhood lead/admin) |

Increment and decrement `post.commentCount`, and create a `comment` notification for the post author.

---

## 3. Public profiles ✅

`GET /users/:uid/public` returns:

```ts
interface PublicProfile {
  uid; displayName; photoURL?;
  neighborhoodName?;      // name only, never the address
  neighbourSince?;        // ISO date verified in this neighbourhood
  bio?;
  verified: boolean;
  kind?: "neighbour" | "organisation";  // e.g. residents' association, gets a badge
}
```

**Privacy:**
- Never return email, phone, exact address or coordinates.
- Return 404 for users outside the caller's neighbourhood and nearby ones.

Also consider embedding a small `author: { uid, displayName, photoURL, neighborhoodName }` object on posts and comments, to avoid N+1 lookups in the feed.

Profile editing needs `bio` (≤ 160 chars) and `photoURL` on `PATCH /users/me`. See §10.

---

## 4. For Sale & Free ✅

```ts
interface Listing {
  _id; sellerUid; neighborhoodId;
  title;                    // 3–80 chars
  description;              // ≤1500
  priceNaira: number | null;  // null = free
  negotiable: boolean;      // false when free
  category: "furniture" | "electronics" | "home_appliances" | "fashion" | "kids" | "books" | "vehicles" | "other";
  condition: "new" | "like_new" | "good" | "fair";
  photos: string[];         // URLs (Firebase Storage today)
  status: "available" | "pending" | "sold";
  createdAt;
}
```

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/listings?neighborhoodId&category&free=true&seller=<uid>` | Newest first. Exclude `sold`, except the caller's own. |
| GET | `/listings/:id` | |
| POST | `/listings` | Body = `Listing` minus server fields, plus `neighborhoodId`. Seller from token. |
| PATCH | `/listings/:id` | `{ status }` (seller only). |
| DELETE | `/listings/:id` | Seller only. |

---

## 5. Chat (in-app messaging) ✅

```ts
interface Conversation {
  _id; participantUids: string[];
  context?: { type: "listing"; id; title; photo?; priceNaira: number | null };
  lastMessage?: { body; senderUid; createdAt };
  unreadCount: number;      // viewer-relative
  updatedAt;
}
interface Message { _id; conversationId; senderUid; body; createdAt }
```

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/conversations` | Caller's threads, newest activity first. |
| POST | `/conversations` | `{ recipientUid, context? }`. **Idempotent**: return the existing thread for the same pair + `context.id`. |
| GET | `/conversations/:id` | Participant only. |
| GET | `/conversations/:id/messages?before&limit` | The newest page (up to 500), oldest first. **Marks the thread as read for the caller.** `before=<message id>` gives the page before it and marks nothing read (§26) |
| POST | `/conversations/:id/messages` | `{ body }` (1–2000 chars). Creates a `message` notification. |
| GET | `/conversations/unread-count` (nice-to-have) | For the header badge. |

**Flows the UI already implements:**
- "Message seller" on a listing creates or reuses a thread with listing context, pre-filling "Hi Ada, is the “…” still available?".
- "Message" on a profile creates or reuses a direct thread.

**Real-time:** live over SSE (§19). New messages and read receipts arrive as `chat.message` / `chat.read`; `ConversationView.readBy[]` carries each member's `lastReadAt` for "Seen".

**Safety:** block and report (`POST /reports` with `targetType: "message"`, `targetId: conversationId`), and rate-limit new threads per user per day. Only the two people in a conversation can report it, and the report is about the other one (§26).

---

## 6. Notifications ✅

```ts
interface AppNotification {
  _id;
  type: "alert" | "comment" | "reaction" | "message" | "event" | "group" | "verification";
  actorUid?; title; body?;
  href: string;             // in-app route, e.g. /p/<id>, /inbox/<id>
  createdAt; read: boolean;
}
```

| Method | Path |
| --- | --- |
| GET | `/notifications` (newest first; paginate later) |
| PATCH | `/notifications/:id` `{ read: true }` |
| POST | `/notifications/read-all` |

**Generate on:**
- alert posted in my neighbourhood (not by me)
- comment on my post
- reaction on my post (batch these)
- new message
- RSVP to my event
- group request approved
- verification status change

Preview behaviour (derived client-side) is in `lib/api/notifications.ts`.

**Later:**
- `GET/PUT /users/me/notification-preferences`: per category, one of `push | email | digest | off`. Urgent alerts default to push.
- Push via FCM.

---

## 7. Events RSVP ✅

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/posts/:id/rsvp` | — | `{ postId, goingCount, interestedCount, myStatus: "going" \| "interested" \| null }` |
| PUT | `/posts/:id/rsvp` | `{ status }` | same |
| DELETE | `/posts/:id/rsvp` | — | same |

Only for `category = event` posts. Notify the host on "going".

---

## 8. Groups ✅

Modelled on Nextdoor's groups: see "How groups are created on Nextdoor" in `product/nextdoor-research.md`. Mock reference with every rule enforced: `apps/web/src/lib/api/groups.ts`. Tests: `groups.test.ts`.

```ts
interface Group {
  _id; name; description;
  privacy: "open" | "private";
  category: "safety" | "estate" | "parents" | "hobbies" | "business" | "other";
  boundary: "neighbourhood" | "nearby" | "city";   // who can FIND it in their Groups list
  coverPhoto?: string;
  memberCount; neighborhoodId; createdBy; createdAt;
  official: boolean;                                 // created by an organisation account (estate/RA)
  membership: "member" | "requested" | "none";       // viewer-relative
  isAdmin: boolean;                                  // viewer-relative
}
interface GroupMember { uid; role: "admin" | "member"; joinedAt }
interface GroupJoinRequest { uid; requestedAt }
interface GroupPost { _id; groupId; authorUid; content; createdAt }
```

### Create & edit
| Method | Path | Body | Rules |
| --- | --- | --- | --- |
| POST | `/groups` | `{ name (3–60), description (10–500), category, privacy, boundary, coverPhoto?, neighborhoodId }` | **Verified neighbours only** (not business pages). The creator becomes the first **admin**. 409 if the name already exists in the neighbourhood (case-insensitive). **429 past 3 groups per user per 24 h.** |
| PATCH | `/groups/:id` | any create field | Admins only. Switching private → open **approves all pending requests**. |
| DELETE | `/groups/:id` | — | Admins only. **409 if any other member has posted** (Nextdoor rule). Otherwise deletes the group and its posts. |

### Browse & join
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/groups?neighborhoodId` | Groups whose **boundary** includes the caller: `neighbourhood` = same neighbourhood; `nearby` = same + adjacent; `city` = same city. Official groups first, then by size. |
| GET | `/groups/:id` | |
| POST | `/groups/:id/join` | `{ inviteToken? }` → `{ membership }`. Open group or valid invite: `member`. Private without invite: `requested` (notify admins). |
| DELETE | `/groups/:id/membership` | Leave, or cancel a request. **409 for the last admin while other members remain** ("make someone else admin first"). |

### Invites
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/groups/:id/invite-link` | `{ url }` = `/g/:id?invite=<token>`. Signed and revocable. Any member for open groups; **admins only for private**. A valid token joins private groups without approval. |
| POST | `/groups/:id/invites` | `{ uids: string[] }`. Sends an in-app and push invite to each neighbour. |
| GET | `/users/search?q&neighborhoodId` | Neighbours the caller can invite (name search). Respects blocks and privacy. |

### Admin tools
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/groups/:id/members` | Members; admins first. Private groups: members only. |
| GET | `/groups/:id/requests` | Admins only. |
| POST | `/groups/:id/requests/:uid/approve` | Admins. Adds member and notifies them. |
| POST | `/groups/:id/requests/:uid/decline` | Admins. **Not** notified with a reason. |
| DELETE | `/groups/:id/members/:uid` | `{ reason? }`. Admins. The removed neighbour is notified, including the reason. |
| PATCH | `/groups/:id/members/:uid` | `{ role }`. Admins. **409 if it would leave zero admins.** |
| GET/POST | `/groups/:id/posts` | Members only for private groups. |
| DELETE | `/groups/:id/posts/:postId` | Author or any group admin. |

**Moderation:** community guidelines apply inside groups. Group admins moderate their own group. Reports from inside groups still go to `POST /reports` for neighbourhood leads and admins.

---

## 9. Reports ✅

`POST /reports` with this body:

```ts
{
  targetType: "post" | "comment" | "listing" | "message",
  targetId,
  reason: "spam" | "harassment" | "misinformation" | "scam" | "not_local" | "other",
  details?
}
```

Returns 204. Reports are private and never reveal the reporter. They feed the admin/lead review queue (Nextdoor model: volunteer Neighbourhood Leads vote on reported content).

---

## 10. Settings ✅

Built at `/settings/*` (Profile, Account, Neighbourhood, Notifications, Privacy & blocking, Feedback, Deactivate). Nextdoor was the reference: see `product/nextdoor-research.md`. Mock reference: `apps/web/src/lib/api/settings.ts`.

### Profile: `PATCH /users/me`
Add `bio?: string` (≤ 160) and `photoURL?: string` alongside the existing `displayName`. Return the updated profile.

### Preferences: `GET /users/me/preferences` · `PATCH /users/me/preferences`
PATCH deep-merges and returns the full object. Defaults are in `DEFAULT_PREFERENCES`.

```ts
interface Preferences {
  notifications: Record<
    "urgent_alerts" | "alerts" | "comments" | "messages" | "events" | "for_sale" | "groups",
    { push: boolean; email: boolean }
  >;
  digest: "daily" | "weekly" | "off";
  privacy: {
    profileVisibility: "neighbourhood" | "nearby";          // who sees full profile
    messaging: "neighbourhood" | "contacts" | "nobody";      // who can start a DM
    showNeighbourSince: boolean;
  };
}
```

**Enforce server-side:**
- `messaging`: `POST /conversations` returns 403 when the recipient doesn't allow the caller. "contacts" means the recipient has messaged them before.
- `profileVisibility`: `GET /users/:uid/public` omits `bio` and `neighbourSince` for callers outside the allowed scope.
- The notification sender checks these preferences before sending push or email.

### Blocking
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/users/me/blocks` | `string[]` of blocked uids |
| POST | `/users/me/blocks` | `{ uid }`; idempotent |
| DELETE | `/users/me/blocks/:uid` | |

**Effects, enforced both ways:**
- Neither party sees the other's posts or comments in lists.
- Neither can start a conversation (403).
- The blocked person is never notified.

The frontend already hides blocked authors client-side as a fallback.

### Deactivate: `POST /users/me/deactivate`
Body `{ reason, details? }`, where `reason` is one of `moved | not_useful | privacy | too_many_notifications | negative | few_neighbours | duplicate | other` (Nextdoor's list).

- Hide the profile, posts and listings. ✅ Posts and listings disappear for neighbours (staff still see them); what the person wrote in other people's threads, groups and conversations stays, under "Former neighbour" with no photo.
- Revoke sessions. ✅
- Restore everything if the user logs in. ✅ `reason` and `details` are kept on the account until then.
- Purge after 30 days. ✅ Built (§27). It runs only with `DATA_DELETION_MODE=live`; the default, `dry-run`, deletes nothing. Once live, signing in after 30 days answers `410` and no longer restores the account.

### Feedback: `POST /feedback`
Body `{ kind: "idea" | "problem" | "praise" | "other", message (5–2000), path? }`. Goes to the team's inbox or admin queue.

### Reports (addition)
`targetType` now also accepts `"user"`, from the profile page's "Report" option.

---

## 11. Business Pages ✅

Public sign-up at `/business/get-started` (no personal account needed yet), modelled on Nextdoor's "Claim your free Business Page". Mock reference: `apps/web/src/lib/api/business.ts`.

`POST /business-pages/applications` → `{ id, status: "pending_review" }`

```ts
interface BusinessApplication {
  businessName: string;          // 2–80
  category: "home_services" | "food" | "retail" | "beauty" | "education" | "property" | "health" | "other";
  description: string;           // 20–300, shown on the page
  areasServed: string[];         // ≥1 neighbourhood names from coverage
  address?: string;              // only if customers visit
  contactName: string;
  phone: string;                 // normalised E.164 Nigerian mobile, e.g. +2348031234567
  email: string;
  cacNumber?: string;            // RC… or BN…, optional (sole traders welcome)
  wantsAdsUpdates: boolean;      // Local Ads waitlist
}
```

**Backend flow:**
1. Store as `pending_review`.
2. Verify the phone by OTP. If a CAC number is given, check it (CAC public search) to award the verified-business badge.
3. Email a link to claim the page, linking it to a myHoodora account.

Rate-limit by IP and phone number.

**Later endpoints for the page itself:**
- `GET/PATCH /business-pages/:id`
- `POST /business-pages/:id/posts`: Business Posts, targeted at `areasServed`
- `POST /business-pages/:id/recommendations`: verified residents only; **never purchasable**
- Local Ads (paid, in naira)

## 11b. myHoodora AI pilot waitlist ✅

The marketing page at `/ai` advertises myHoodora AI, a sister product that turns course material into a song, a game and a video (see the myHoodora AI PRD). For now the page only collects pilot sign-ups. Mock reference: `apps/web/src/lib/api/hoodora-ai.ts`. Endpoint key: `ai.pilot`.

`POST /ai/pilot-requests` (public, no account) → `{ id, status: "waitlisted" }`

```ts
interface AiPilotRequest {
  name: string;                  // ≥2
  email: string;
  institution: string;           // school / organisation name
  institutionType: "primary" | "secondary" | "university" | "online" | "corporate" | "other";
  role?: string;                 // ≤80, e.g. "Lecturer, Biochemistry"
  subjects?: string;             // ≤300, what they'd convert first
}
```

Rate-limit by IP and email. De-duplicate on email plus institution.

## 11c. Contact & careers ✅

These are public forms on `/contact` and `/careers`. Mock reference: `apps/web/src/lib/api/company.ts`. Endpoint keys: `contact`, `careers`.

`POST /contact` → `{ id, status: "received" }`. Route the message to the right inbox by `topic`; `safety` goes to the trust team first.

```ts
interface ContactMessage {
  topic: "general" | "account" | "safety" | "business" | "press" | "partnerships" | "ai";
  name: string;
  email: string;
  message: string;               // 20–2000
  organisation?: string;         // shown for press / partnerships / business / ai
}
```

`POST /careers/talent-network` → `{ id, status: "joined" }`

```ts
interface TalentProfile {
  name: string;
  email: string;
  team: "engineering" | "design" | "community" | "growth" | "operations";
  city: string;
  link?: string;                 // https URL: LinkedIn / portfolio / GitHub
  note?: string;                 // ≤500
}
```

Open roles are static for now (`apps/web/src/lib/careers.ts`, currently empty). Later this becomes `GET /careers/roles`, or an ATS feed. Press announcements are in `apps/web/src/lib/press.ts`.

## 13. Admin API ✅

These power the admin operations platform. The design and flows are in [`archive/2026-09-29-admin-target-architecture.md`](./archive/2026-09-29-admin-target-architecture.md) (the design it was built from). The frontend is built contract-first: each service in `apps/web/src/lib/api/admin/*` calls these when its `ENDPOINTS` key (`admin.*`) is `live`, and uses the mock store otherwise.

### 13.0 Rules for every `/admin/*` route

- **Guard:** `FirebaseAuthGuard` + a new **`RolesGuard`** with `@Roles("moderator", "admin")` (or `"admin"` where marked **A**). **The backend is the only authority.**
- **Errors:** `403 { code: "forbidden" }` when the role is insufficient, and `404` when the target doesn't exist.
- **Lists** take `?q=&page=1&pageSize=25&sort=field:asc|desc` plus the filters listed below, and return:
  ```ts
  interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
  ```
- **Audit log:** every mutating call writes an `AuditEvent` in the same transaction and returns the updated entity.
- **Reasons:** actions that affect a neighbour require `reason` (a preset id) + optional `note`. The author-facing notification uses the preset's public text, never the internal note.

> 🔴 **Fix now, independently:** `POST /neighborhoods` and `DELETE /neighborhoods/:id` currently have no role check. Any signed-in user can call them. Add `@Roles("admin")`.

### 13.1 Session & overview

`GET /admin/me` → `{ uid, displayName, role: "moderator" | "admin", can: Capability[] }`

```ts
type Capability =
  | "moderation.act" | "moderation.suspend" | "verification.review"
  | "hoods.manage" | "businesses.review" | "broadcasts.send"
  | "team.manage" | "settings.manage";
```

`GET /admin/overview`:

```ts
interface AdminOverview {
  attention: {
    openReports: number; urgentReports: number; oldestOpenReportAt: string | null;
    pendingVerifications: number; businessApplications: number;
    unansweredInbox: number; liveUrgentAlerts: number;
  };
  pulse: {                                  // last 7 days vs previous 7
    newNeighbours: Trend; posts: Trend; activeHoods: Trend; medianResolveHours: Trend;
  };
  recentActions: AuditEvent[];              // last 10
}
interface Trend { value: number; previous: number }
```

### 13.2 Moderation

```ts
type ReportStatus = "open" | "under_review" | "escalated" | "resolved" | "dismissed";
type ReportSeverity = "high" | "medium" | "low";   // derived: threats/discrimination/scam = high
type ReportTargetType = "post" | "comment" | "listing" | "message" | "user" | "group" | "business";

interface AdminReport {
  id: string;
  target: { type: ReportTargetType; id: string; preview: string; authorUid?: string; hoodId?: string };
  reasons: { reason: ReportReason; count: number }[];   // grouped: many neighbours can report one thing
  reporterCount: number;
  firstReportedAt: string; lastReportedAt: string;
  severity: ReportSeverity;
  status: ReportStatus;
  assignee?: { uid: string; displayName: string };
  resolution?: { action: ModerationAction; reason: string; note?: string; by: string; at: string };
}
type ModerationAction =
  | "keep" | "remove_content" | "warn_author" | "restrict_author" | "suspend_author" | "escalate";
```

| Method & path | Notes |
| --- | --- |
| `GET /admin/reports?status&type&reason&hoodId&authorUid&severity` | `status`: a `ReportStatus` or `active` (open + under_review + escalated); omitted = all. Default sort `severity:desc,firstReportedAt:asc` |
| `GET /admin/reports/:id` | Adds `target` (full content as rendered: post/comment/listing/user), `author` summary + `priorActions: AuditEvent[]`, `reporters` (**admin-only**, never shown to the author), `related: AdminReport[]`, `timeline: AuditEvent[]` |
| `POST /admin/reports/:id/claim` · `/release` | Sets or clears the assignee. `409` if already claimed by someone else |
| `POST /admin/reports/:id/actions` | `{ action, reason, note?, restrictDays? }`. `suspend_author` and `restrictDays > 7` are **A**. Resolves the report (or `escalated`). Notifies the author |
| `GET /admin/audit?actorUid&action&targetType&from&to` | Moderation history. Immutable |

```ts
interface AuditEvent {
  id: string; at: string;
  actor: { uid: string; displayName: string; role: string };
  action: ModerationAction | "verify" | "reject_verification" | "change_hood" | "reinstate"
        | "hood_create" | "hood_update" | "hood_archive" | "business_approve" | "business_reject"
        | "broadcast_send" | "role_change" | "alert_end";
  target: { type: string; id: string; label: string };
  reason?: string; note?: string;
}
```

### 13.3 Neighbours (users)

This proposes splitting today's `verificationStatus: "banned"` into two fields:

```ts
interface AdminNeighbour {
  uid: string; displayName: string; email: string; photoURL?: string;
  role: "member" | "moderator" | "admin";
  hood?: { id: string; name: string };
  verificationStatus: "unverified" | "pending_review" | "verified" | "rejected";
  accountStatus: "active" | "restricted" | "suspended";   // 🆕 replaces "banned"
  restrictedUntil?: string;
  joinedAt: string; lastActiveAt?: string;
  counts: { posts: number; reportsAgainst: number; reportsFiled: number };
}
```

| Method & path | Notes |
| --- | --- |
| `GET /admin/neighbours?q&hoodId&verification&account&role&joinedFrom&joinedTo` | |
| `GET /admin/neighbours/:uid` | Adds `location` (address **admins only**), `verificationAttempts[]`, `timeline` |
| `GET /admin/neighbours/:uid/posts` · `/reports` | Paged |
| `POST /admin/neighbours/:uid/actions` | `{ action: "verify" \| "reject_verification" \| "change_hood" \| "warn" \| "restrict" \| "suspend" \| "reinstate", hoodId?, days?, reason, note? }`. `suspend` is **A** |
| `POST /admin/neighbours/bulk` | `{ uids, action: "verify" \| "restrict", hoodId?, reason }`, max 100 → `{ updated, results: [{ uid, ok, message? }] }`. Each neighbour is handled on their own (§26) |

### 13.4 Verification queue

`GET /admin/verification?status=pending_review|failed&hoodId` → `Page<VerificationCase>`

```ts
interface VerificationCase {
  uid: string; displayName: string; submittedAt: string;
  address: string; point: { lat: number; lng: number };
  nearestHoods: { id: string; name: string; distanceMeters: number }[];
  attempts: number; lastError?: "outside_coverage" | "low_accuracy" | "mismatch";
}
```

Approve and reject use `POST /admin/neighbours/:uid/actions` (`verify` with `hoodId`, `reject_verification` with a reason).

### 13.5 Hoods

```ts
interface AdminHood {
  id: string; name: string; city: string; country: string;
  center: { lat: number; lng: number }; radiusMeters: number;
  status: "active" | "paused" | "archived";          // 🆕 replaces isActive + hard delete
  stats: { members: number; verifiedPct: number; posts7d: number; openReports: number; growth7d: number };
  createdAt: string;
}
```

| Method & path | Notes |
| --- | --- |
| `GET /admin/hoods?q&city&status` | |
| `GET /admin/hoods/:id` | Adds `timeline` and a `members7d` series for the chart |
| `GET /admin/hoods/:id/members` · `/posts` · `/reports` | Paged |
| `POST /admin/hoods` **A** | `{ name, city, country, center, radiusMeters, description? }`. `409` + `overlaps[]` when it overlaps an existing Hood (reuses `/neighborhoods/nearby` logic) |
| `PATCH /admin/hoods/:id` **A** | Name, radius, status, description |

### 13.6 Content

| Method & path | Notes |
| --- | --- |
| `GET /admin/posts?q&hoodId&category&authorUid&status=visible\|removed&reported=true&from&to` | Category covers alerts, events, polls, recommendations, general, for_sale |
| `GET /admin/posts/:id` | Post + comments (incl. removed) + reports + timeline |
| `POST /admin/posts/:id/actions` | `{ action: "remove" \| "restore", reason, note? }` |
| `POST /admin/comments/:id/actions` | Same |
| `GET /admin/alerts?hoodId&level=urgent\|active\|resolved\|ended` | Live safety alerts |
| `POST /admin/alerts/:id/actions` | `{ action: "end" \| "downgrade" \| "remove", reason }` |
| `GET /admin/groups?q&hoodId&privacy&reported` · `GET /admin/groups/:id` | |
| `POST /admin/groups/:id/actions` | `{ action: "archive" \| "restore" \| "transfer", toUid?, reason }` |
| `GET /admin/listings?q&hoodId&status=active\|sold\|removed&reported` · `GET /admin/listings/:id` | |
| `POST /admin/listings/:id/actions` | `{ action: "remove" \| "restore", reason }` |

### 13.7 Businesses

| Method & path | Notes |
| --- | --- |
| `GET /admin/businesses?tab=applications\|verified\|reported&q&category&area` | Applications come from `POST /business-pages/applications` (§11) |
| `GET /admin/businesses/:id` | Application or page, phone OTP status, CAC check result, reports, timeline |
| `POST /admin/businesses/:id/actions` **A** | `{ action: "approve" \| "request_info" \| "reject" \| "suspend" \| "reinstate", reason?, message? }`. `approve` creates the page and emails the claim link |

### 13.8 Support inbox & broadcasts

```ts
interface InboxThread {
  id: string; source: "in_app" | "contact_form" | "feedback";
  topic: string; subject: string; from: { uid?: string; name: string; email: string };
  status: "open" | "waiting" | "resolved"; priority: "low" | "normal" | "high";
  assignee?: { uid: string; displayName: string };
  messages: { from: "user" | "staff"; body: string; at: string; by?: string }[];
  createdAt: string; updatedAt: string;
}
```

| Method & path | Notes |
| --- | --- |
| `GET /admin/inbox?status&source&topic&q` · `GET /admin/inbox/:id` | Merges today's support queries, `/contact` messages (§11c) and feedback |
| `POST /admin/inbox/:id/reply` | `{ body }` → emails / notifies the neighbour |
| `PATCH /admin/inbox/:id` | `{ status?, assigneeUid?, priority? }` |
| `GET /admin/broadcasts` · `POST /admin/broadcasts` | `{ title, body, audience: { type: "all" } \| { type: "hood", hoodIds } \| { type: "user", uids }, scheduleAt? }`. `audience.all` is **A**. Returns `{ id, estimatedReach }` |
| `POST /admin/broadcasts/estimate` | Same body → `{ estimatedReach }` (for the live reach counter) |

### 13.9 Insights, team & settings

| Method & path | Notes |
| --- | --- |
| `GET /admin/insights?from&to&hoodId` | `{ signups[], verifiedFunnel{started,verified,failed}, activeByHood[], reportsByReason[], medianResolveHours[], kindnessPrompts }` (daily series) |
| `GET /admin/team` · `PATCH /admin/team/:uid` **A** | Staff list; `{ role: "member" \| "moderator" \| "admin" \| "owner" }`. Granting or revoking admin/owner needs an **owner** (`team.manage.admins`). The last owner can't step down (409). You can't change your own role (400) |
| `GET /admin/settings` · `PATCH /admin/settings` **A** | `{ reportReasons[], alertWindows{category: hours}, coverageCities[] }`. `coverageCities` is derived from open Hoods (read-only; ignored on PATCH), and so are reason `label`s. `alertWindows` are 1 h–30 days and apply to new alerts |
| `GET /admin/signups?type=ai_pilot\|talent\|business_ads` | Read-only lists from §11b and §11c |

## 14. Pass-1 additions and changes (2026-09-29)

Changes the backend made while implementing this contract. The web is already updated for them.

**Roles and account state (§13.0)**
- `role`: `member < moderator < admin < owner`. Owners have every admin power plus `team.manage.admins`. `GET /admin/me` includes it in `can`.
- `verificationStatus` (`unverified | pending_review | verified | rejected`) is separate from `accountStatus` (`active | restricted | suspended`), plus `restrictedUntil`. The old `banned` value was migrated to `accountStatus: suspended` (migration 001).
- **Suspended** accounts get `403 "This account is suspended."` on everything except `GET /users/me`, `POST /auth/session` and `POST /auth/logout-everywhere` (§24), so the app can explain what happened. **Restricted** (until `restrictedUntil`) and **unverified** neighbours can read but get 403 on posting and reacting. Unverified neighbours can still report.

**`GET /users/me`** adds `emailVerified`, `bio`, `accountStatus`, `restrictedUntil` and `createdAt`. **`PATCH /users/me`** accepts only `displayName`, `bio` (≤ 160) and `photoURL` (https). Sending `neighborhoodId` (or any other field) is a **400**: your Hood only changes through location verification or staff.

**Neighbourhoods:** `POST /neighborhoods` and `DELETE /neighborhoods/:id` now need `hoods.manage` (admin). They were previously open to any signed-in user. `DELETE` **archives** (204); it no longer deletes. New Hoods that overlap an existing one get a 409.

**Email verification** (`auth.emailVerification`)
- On first sign-in (account creation) we send **one** welcome email. Password sign-ups get a verification link; Google and Apple sign-ups are marked verified immediately. No email is sent on later sign-ins.
- The link is `${APP_URL}/verify-email?token=…`. The token is 32 random bytes, stored only as a SHA-256 hash, valid 24 h and single use. Any newer link invalidates older ones.
- `POST /auth/email-verification/confirm` `{ token }` → 204. Public and throttled. Invalid, used and expired tokens all get the **same** generic 400. On success we also mark the Firebase user `emailVerified` (best-effort).
- `POST /auth/email-verification/resend` → 202. **429** after 3 links in an hour.
- The web page `/verify-email` strips the token from the address bar, sends `Referrer-Policy: no-referrer` and never sends a token twice. Email verification was a nudge (banner), not a gate, until 2026-10-07: posting and messaging now need it as well as address verification (§27).

**Webhooks:** `POST /api/webhooks/resend` receives Resend delivery events (Svix/Standard Webhooks signature on the raw body, 5-minute replay window, idempotent per `svix-id`, status never moves backwards). It returns 503 until `RESEND_WEBHOOK_SECRET` is set. It isn't used by the web.

**Rate limits (429):** urgent alerts are limited to 1 per 6 h per neighbour; reports to 10/min and 50/h; verification resends to 3/h. There's also a global throttle: per person once signed in, per IP on public routes (§26; it was per IP for everyone until 2026-10-06).

**Notifications:** new `type`s `moderation` (staff decisions about you or your content; never includes the staff note) and `system` (broadcasts). `GET /notifications/unread-count` → `{ count }`.

**Reports** are idempotent per reporter and item (repeat → 204, no double count). You can't report your own content (400). Reports group into one case per item, and a new report reopens a dismissed case.

---

## 15. Pass-2 additions (2026-09-29)

**Shapes the API adds** (all optional to the web types, so old clients are unaffected):
- `Listing.seller`, `GroupPost.author` and `Conversation.participants[]` embed `{ uid, displayName, photoURL? }`, so names show without extra lookups.
- `GET /groups/:id?invite=<token>`: an invite link lets someone outside the group's boundary see it before joining.
- `POST /groups/:id/invite-link` accepts `{ reset: true }` (admins) to revoke old links.

**Rules the API enforces**
- *Listings:* your Hood only; 10 new listings a day; free items (`priceNaira: null`) are never negotiable; photos must be https URLs; sold items are hidden except from the seller; blocked sellers are hidden.
- *Groups:*
  - `boundary` works as follows. `neighbourhood` means your Hood. `nearby` means Hoods whose centres are within 5 km. `city` means the same city. Groups you've joined are always visible.
  - Creating a group needs a verified neighbour; 3 new groups a day.
  - Names are unique per Hood, case-insensitive (409).
  - Private posts and members are members-only (403).
  - A group can't lose its last admin (409), and can't be deleted once others have posted (409).
- *Chat:*
  - One thread per pair + listing. `POST` is idempotent, and the server fills in the listing details itself.
  - The recipient's `privacy.messaging` preference is respected: `nobody` or `contacts` blocks new threads (403); `neighbourhood` blocks other Hoods unless the thread is about a listing.
  - Blocks work both ways.
  - 20 new threads a day.
  - Restricted neighbours can still message.
- *Business Pages:*
  - The phone number must be Nigerian E.164; the CAC number `RC…`/`BN…`.
  - 3 applications per phone per day.
  - Approval emails a single-use claim link (`/business/claim?token=…`, 7 days) that links the page to the signed-in account.
- *Public forms:* rate-limited per IP and per email. The AI pilot waitlist is de-duplicated on email + institution; talent-network sign-ups update in place. Each sends one acknowledgement email.

**Hood Leads** (volunteer moderators, Nextdoor model)
- Admins appoint Leads per Hood with `GET/PUT /admin/hoods/:id/leads` `{ uids }`. Leads must be verified, active neighbours of that Hood; up to 15.
- Reports go to a Lead vote when all of these hold:
  - the reported item is a post, comment, listing or group;
  - the reason isn't high-risk or staff-only (scam, harassment and misinformation are);
  - the Hood has at least 3 active Leads.

  Everything else goes to staff.
- `GET /moderation/lead/status` → `{ isLead, hoodId, waiting }`.
- `GET /moderation/lead/queue` (Leads only) shows reports in your Hood. Reporters are never shown, and your own content and reports are excluded.
- `POST /moderation/cases/:id/votes` `{ vote: keep | maybe_remove | remove }` → `{ myVote, decided }`.
- Three votes with a two-thirds majority decide the case through the normal decision path, audited as "Hood Leads (consensus)". Without agreement within 48 h, the case escalates to staff. Staff can decide at any time.
- `AdminReport.route` is `"staff" | "leads"`, and `ReportDetail.leadVotes` gives the tally.

**Appeals**
- `GET /moderation/my-decisions` returns decisions about your content, plus outcomes of your reports, from the last 90 days, each with `canAppeal` and `appeal`.
- `POST /moderation/cases/:id/appeals` `{ reason }` (10–1000 chars) is allowed once per decision, within 30 days. Authors can appeal removals, warnings, restrictions and suspensions; reporters can appeal a "keep". A second appeal gets 409.
- Staff use `GET /admin/appeals?status` and `POST /admin/appeals/:id/decide` `{ outcome: upheld | overturned, reason }`.
- The original decider can't review their own decision (403). Reversing a restriction or suspension needs an admin.
- An overturn reverses the enforcement: content is restored, or removed for a reporter's appeal, or the account is reinstated. The person who appealed is notified.
- `AdminOverview.attention.openAppeals` counts appeals waiting.

**Support & telemetry**
- `POST /support` `{ topic: account | verification | safety | bug | other, message }` → `{ id, status: "received" }`. It appears in `/admin/inbox` as `source: "in_app"`; safety requests are high priority.
- Staff replies reach the neighbour by email and by a `system` notification.
- `POST /telemetry/kindness` `{ outcome?: shown | edited | posted_anyway | discarded }` → 204. These are anonymous daily counters; `insights.kindnessPrompts` is the 30-day total of `shown`.

**Admin (§13.6–13.9)**
- `GET /admin/listings`, `GET /admin/groups`, `POST /admin/listings/:id/actions` `{ remove | restore }`, `POST /admin/groups/:id/actions` `{ archive | remove | restore }`.
- `GET /admin/businesses?tab`, `GET /admin/businesses/:id` and `POST /admin/businesses/:id/actions`, which returns the updated detail. Business actions need `businesses.review`.
- `GET/POST/PATCH /admin/inbox…` (`PATCH` accepts `assignToMe` or `assigneeUid`).
- `GET /admin/signups?type=ai_pilot|talent|business_ads` (`settings.manage`).
- `AdminOverview.attention.businessApplications` is now real.

---

## 16. Join a nearby neighbourhood (built, 2026-09-30)

**Why:** someone whose address is just outside every Hood used to hit a dead end ("We're not in your area yet"). Now they're offered the Hoods that are *close* and can **ask to join one**. Staff approve the request from the verification queue. Joining this way never makes someone "verified" by itself, so "verified" keeps meaning geo- or staff-confirmed.

**Status:** built in `apps/api` and live in the web app (`users.hoodRequest: "live"`). "Close" = within the Hood's radius + `NEARBY_BUFFER_M` (default 3000 m). Hoods without a `status` field count as open (same rule as verification). Requests and withdrawals are audited (`hood_request`, `hood_request_cancel`) and emit `queue.changed` to staff.

### (a) `POST /users/me/verify-location`: extended outside-coverage response

```ts
// No Hood contains the point:
{
  verificationStatus: "unverified";          // or "verified" if they already were
  reason: "outside_coverage";
  nearbyHoods: NearbyHood[];                 // 🆕 nearest first, max 3; [] when nothing is close
}

interface NearbyHood {
  id: string;
  name: string;
  city: string;
  distanceMeters: number;                    // point → Hood, rounded
}
```

- **The API decides "close".** Use `HoodsService.nearest()` limited to **open** Hoods, and keep those within `hood.radiusMeters + NEARBY_BUFFER_M` (suggested 3000 m, from config). The client never sends a radius.
- Keep recording the attempt (point, address, `outside_coverage`) as today. (b) validates against it.
- A successful match (`verified`) also **clears any pending request** (`requestedHood = null`).

### (b) `POST /users/me/hood-request` → `Me`

Body: `{ hoodId: string }`. Returns the updated profile (same shape as `GET /users/me`).

| Rule | Response |
| --- | --- |
| `hoodId` must be one of the nearby Hoods for the caller's **last verification attempt point** (recomputed on the server, never trusted from the client) | `400 "That neighbourhood isn't near your address."` |
| Caller is already `verified` | `409 "You're already a verified neighbour."` |
| Caller is `rejected` | `403` |
| Hood not open (paused/archived) | `400` |
| Success | `verificationStatus: "pending_review"`, `requestedHood: { id, name, requestedAt }`, audit entry, appears in the admin queue |

- Re-requesting replaces the previous request (idempotent per user).
- Throttle like `verify-location` (10/min).

### (c) `DELETE /users/me/hood-request` → `Me`

Cancels a pending request: `verificationStatus: "unverified"`, `requestedHood: null`. Returns `409` if nothing is pending.

### (d) `GET /users/me` (`Me`) gains

```ts
requestedHood?: { id: string; name: string; requestedAt: string } | null;   // set while pending_review from a join request
```

### (e) Admin verification queue (§13.4)

```ts
interface VerificationCase {
  // …existing fields
  requestedHood?: { id: string; name: string };   // 🆕 the Hood they asked to join
}
```

- **Approve:** the existing `POST /admin/neighbours/:uid/actions` `{ action: "verify", hoodId }`. The web app pre-fills `hoodId` from `requestedHood`. Also clear `requestedHood` and notify the user ("You've joined {name}").
- **Reject a join request:** the existing `reject_verification`, but for a *request* set the user back to `unverified` (not `rejected`), clear `requestedHood`, and notify them with the reason, so they can fix their address or request again.

### How the web app uses it
- Onboarding step 3 saves the profile first, then checks the location. `nearbyHoods.length > 0` shows a "You're close to a neighbourhood" picker, then "Request sent".
- While `pending_review`, the app banner, locked areas, the feed card and Settings → Neighbourhood show "waiting for approval to join {name}". Settings has **Cancel request**.
- Reference implementation: the mock branch of `verifyLocationApi` / `requestHoodApi` / `cancelHoodRequestApi` in `apps/web/src/lib/firebase/auth.ts`.

---

## 17. QA staff accounts (for testing the admin portal)

Three test accounts exist on the development Firebase project and database, one per staff role (`owner`, `admin`, `moderator`), so the admin portal and its permissions can be tested end to end.

- **Credentials are not in this repository.** Locally they are read from `apps/api/.env` (`QA_OWNER_EMAIL` / `QA_OWNER_PASSWORD`, `QA_ADMIN_…`, `QA_MODERATOR_…`); share them through the team's password manager.
- **Signing in:** `/login`, then `/admin`. Staff who aren't onboarded as residents skip onboarding and land on `/admin`; a deep link such as `/admin/verification` survives the login.
- **What each role reaches:** owner, everything including Team; admin, everything except owner-only actions; moderator, moderation, verification and content (Team, Settings and Broadcasts return 403).
- **Who sees what at `/admin`:** signed out → `/login`; signed-in non-staff → the ordinary 404 page (the server asks `GET /auth/session/staff` before sending any admin code); staff → the admin, served `noindex`. Every admin API call is authorised again by the API from the database role.
- The browser test suite (`apps/web/e2e/auth.spec.ts`) signs in as the moderator and ends by signing that account out everywhere, so it needs a fresh login afterwards.
- **Before launch:** disable or delete these accounts (Firebase console → disable user; set `role: "member"` or remove the user record). They are full-access logins.

---

## 18. Support conversations (2026-09-30)

Support is a conversation, not a one-off form. A neighbour's requests (and any conversation staff start with them) live in **Messages → myHoodora Support** (`/inbox/support`), and replies arrive live (§19). Staff work them from Admin → Support → Inbox as before.

| Method & path | Who | Notes |
| --- | --- | --- |
| `POST /support { topic, message }` | neighbour | Unchanged: opens a thread → `{ id, status: "received" }`. The app then opens `/inbox/support/<id>` |
| `GET /support/threads` | neighbour | Their threads (`source` `in_app` or `staff`), newest first → `SupportThreadSummary[]` |
| `GET /support/threads/unread-count` | neighbour | `{ count }`: threads with a team message newer than `userReadAt` |
| `GET /support/threads/:id` | neighbour | `SupportThread`; marks it read. **Someone else's thread → 404** |
| `POST /support/threads/:id/messages { body }` | neighbour | 1–2000 chars, 60/hour. Sets `status: "open"` (back in "Needs a reply"; reopens a resolved thread) |
| `POST /admin/inbox { uid, subject, body }` | staff | Starts a thread (`source: "staff"`, `status: "waiting"`, assigned to the sender). Audited as `inbox_start` |

```ts
interface SupportThread {
  id: string; subject: string; topic: string;
  status: "open" | "waiting" | "resolved";   // open = the team owes a reply
  startedBy: "user" | "staff";
  messages: { from: "user" | "staff"; body: string; at: string; by?: string }[];  // by = staff name
  unread: boolean;                          // a team message the neighbour hasn't opened
  createdAt: string; updatedAt: string;
}
type SupportThreadSummary = Omit<SupportThread, "messages"> & { lastMessage?: SupportThread["messages"][number] };
```

- Never exposed to the neighbour: priority, assignee, their stored email.
- **Reaching the neighbour** (staff reply or start, one helper): `support.message` live event, an in-app notification linking to `/inbox/support/<id>`, and an email whose button opens the conversation ("Reply in the app…"). Email replies aren't read by the system, so app users are pointed back to the app. Public contact-form threads (no account) keep plain email replies.
- `inbound_messages` gains `userReadAt` and the `staff` source; indexed by `{ uid, updatedAt }`.

---

## 19. Real-time (2026-09-30)

One Server-Sent Events stream per signed-in tab carries every live update.

**`GET /realtime/stream`** (Bearer token, `text/event-stream`, not throttled):
- Sends `event: ready` on connect, `event: ping` every 25 s, and events named by `type` with the JSON below as `data`.
- The caller hears three channels, resolved from their account when they connect: their own (`user:<uid>`), their Hood's (`hood:<hoodId>`), and `staff` (staff only).
- `EventSource` can't send an `Authorization` header, so the web app reads the stream with `fetch`.

```ts
interface RealtimeEvent {
  type: "post.created" | "post.updated" | "post.deleted" | "comment.created" | "comment.deleted"
      | "notification.created" | "unread.changed" | "chat.message" | "chat.read" | "group.post"
      | "listing.created" | "listing.updated" | "support.message" | "inbox.updated" | "queue.changed"
      | "session.changed";
  id?: string; postId?: string; conversationId?: string; threadId?: string; groupId?: string;
  at: string;
}
```

**Events are hints, never data.** They carry ids only; clients refetch through the normal endpoints, which apply blocks, removals, private groups and the viewer's own state. A new field never needs adding here to keep screens correct.

| Event | Channel | Sent when |
| --- | --- | --- |
| `post.created` / `post.deleted` | hood | A post is created / deleted, or removed by staff |
| `post.updated` | hood | Reactions, poll votes, RSVPs, comment count, alert resolved or downgraded. **Coalesced: at most one per post per second** |
| `comment.created` / `comment.deleted` | hood | Comment added / deleted / removed or restored by moderation |
| `notification.created` | user | Any `NotificationsService.notify()` (so every notification is live) |
| `unread.changed` | user | Notifications or a support thread marked read |
| `chat.message` / `chat.read` | each member | Message sent / someone read the thread (only when something was unread) |
| `group.post` | each group member | Group post created or deleted (never the Hood channel: groups can be private or span Hoods) |
| `listing.created` / `listing.updated` | hood | Listed / sold / deleted / removed |
| `support.message` | the neighbour | Staff reply or start, status change, or their own reply from another tab |
| `inbox.updated` / `queue.changed` | staff | Support thread activity / report filed, claimed, released or decided |
| `session.changed` | user | Hood move, verification, restriction, suspension, reinstatement or role change. **The client reconnects** (new channels) and refreshes the profile |

**Client rules**:
- Reconnect with jittered backoff (1 s → 30 s), and use a fresh ID token each time.
- **Resync after every reconnect**: refetch whatever is on screen.
- If the stream fails 3 times in a row, poll those queries every 15 s until it recovers.
- Close the stream after 5 minutes in a background tab, and resync on return.
- Feed: new posts wait behind a "N new posts" pill (the feed never jumps); your own posts appear instantly.

**Scale (multiple API instances)**: the bus is an adapter (`REALTIME_BUS`), like email's `EMAIL_PROVIDER`, chosen once at startup in `apps/api/src/realtime/realtime.module.ts`. The log line `Realtime bus: …` names the one in use.

| Adapter | Used when | Cost per event | Notes |
| --- | --- | --- | --- |
| **Redis pub/sub** (Upstash) | `REDIS_URL` is set and reachable | 1 `PUBLISH` | Two connections per instance (publish + subscribe); auto-reconnect and re-subscribe. The URL needs publish rights (Upstash's `default` user, not `default_ro`) |
| **MongoDB change streams** | Redis missing or down at startup | 1 insert into `realtime_events` (TTL 60 s) | One change stream per instance; resumes from its last token after errors |
| In-memory | Neither works | none | **Correct for one instance only**; logs a warning |

- `REALTIME_BUS=auto` (default) is `redis → mongo → memory`. `redis`, `mongo` and `memory` force one.
- **Environments stay apart** even when they share Redis and Mongo: channel `myhoodora:realtime:<REALTIME_ENV or NODE_ENV>`, and Mongo filters on `env`.
- If Redis drops mid-run, the publishing instance delivers to its own users and warns; everyone else catches up through client resync on reconnect.
- **Render**: set `REDIS_URL` (and optionally `REALTIME_ENV=production`) on the API service before scaling beyond one instance.
- Verified 2026-09-30 with two local instances: actions on one reached streams on the other with Redis and with Mongo, and the in-memory control lost them, as expected.
- Upstash bills per command (free tier 500K a month): each event is one `PUBLISH`, coalescing merges bursts, and each instance subscribes once however many browsers are connected.

---

## 12. Post-MVP (not built, not scheduled)

Search and the kindness check moved out of this list: see §21 and §22. These are deferred until after launch (see `docs/roadmap.md`); nothing in the web app or API depends on them.

| Need | Endpoint idea |
| --- | --- |
| Public neighbourhood pages (`/neighbourhood/[slug]`) | `GET /public/neighbourhoods/:slug` (no auth; summary + "anyone" posts) |
| Alternative verification (phone OTP, estate code, neighbour invite) | `POST /users/me/verify-{phone,code,invite}` |
| SMS (phone numbers on accounts, business phone confirmation) | An `SmsProvider` adapter; the port exists, nothing implements it |

---

## 20. File storage: photos and videos (2026-09-30)

Uploads go **through the API**, never straight from the browser to a vendor. Business modules depend on `StorageService`; the vendor sits behind the `StorageProvider` port (`apps/api/src/storage/`). Content keeps plain HTTPS URLs (`mediaUrls`, `photos`, `photoURL`), so switching providers never touches posts, listings or profiles.

### `POST /media` (multipart) → 201

| Field | |
| --- | --- |
| `file` | Photo: JPG, PNG, WebP, GIF, HEIC, up to 10 MB. Video: MP4, MOV, WebM, up to 50 MB (**posts only**). |
| `purpose` | `post` \| `listing` \| `group` \| `avatar` (decides the folder and whether video is allowed) |

```ts
{ id: string; url: string; resourceType: "image" | "video"; format?: string; bytes: number; width?: number; height?: number; durationSeconds?: number }
```

- Put `url` in `mediaUrls` (up to 10 photos or 1 video per post), `photos` (up to 10 per listing), a group cover or `photoURL`.
- Profile photos save immediately. `PATCH /users/me { photoURL: null }` removes the photo, and a replaced or removed photo we stored is deleted from storage.
- `400` wrong type or unreadable file · `413` too big · `429` over 30 uploads/min · `503` uploads switched off or the provider is down.
- Photos are stored at most 2560 px on the long edge. Delivery URLs are `f_auto,q_auto` (right format and size per browser), and delivered images carry no camera metadata (GPS).

### How uploads travel (2026-09-30)

**Default: through the API, streamed.** `POST /media` writes the upload to a temp file on disk (multer `dest`), reads the real type from the file's first bytes, and the adapter streams it from disk to Cloudinary in one request. It never holds the whole file in memory. Measured on the real account: a 65.8 MB video took 18.8 s, and repeated uploads added about 1–5 MB to API memory (the first one after a restart carries a one-off ~65 MB warm-up). The temp file is always deleted, and leftovers from a crashed process are swept at startup and hourly.

- **Real type, not the label:** a PDF renamed `.jpg` → 400; a video labelled as a photo is stored as the video it is.
- **Concurrency gate:** at most `STORAGE_MAX_CONCURRENT_UPLOADS` (default 4) files go to storage at once per instance; up to 20 more wait; beyond that, `503 "Lots of uploads right now…"`.
- **Long uploads:** the API allows a request 20 minutes (Node's default is 5), so a 100 MB clip on slow mobile data can finish; headers must still arrive quickly.
- **Not used:** Cloudinary's chunked `upload_large`. It returned a stream (not a promise), read the file on its own, and in our measurement took 231 s with +365 MB memory. One streamed request covers the 100 MB cap.

**Optional: direct upload (off; `STORAGE_DIRECT_UPLOADS=true` to enable, e.g. on a paid plan).** Each completion costs one Cloudinary Admin API call, and the free plan limits those per hour. The web app's `media.direct` key must be `"live"` too.

### Direct upload (videos, when enabled): `POST /media/direct` → upload to storage → `POST /media/:id/complete`

Large files never pass through the API:

1. `POST /media/direct { purpose, mimetype, size }` → `{ id, upload: { url, fields, fileField, expiresAt } }`. The API checks the type, purpose and size (videos ≤ **100 MB**, posts only) and signs a ticket for **one new file id**. The ticket holds no secret (the API secret only signs), and changing any signed field is refused by storage. `{ id: null, upload: null }` for photos (they keep `POST /media`, which resizes them and strips metadata) or when the provider has no direct upload.
2. The browser POSTs a multipart form to `upload.url`: every `fields` entry, then the file under `fileField`. There's no API token; the signature is the permission. Cloudinary allows browser origins (CORS), checked for `localhost:3000` and `myhoodora.com`.
3. `POST /media/:id/complete` → the normal media shape. The API reads back **what storage actually holds** (Cloudinary Admin API with `media_metadata`: real bytes and duration) and enforces ≤ 100 MB and ≤ 60 s; otherwise the file is deleted and 413/400 is returned. Idempotent. `400 "We didn't receive your video…"` if nothing arrived.

Unfinished tickets are `pending` rows in `media_assets` that expire after 2 h (TTL index). A file uploaded but never completed stays in storage. It's rare, and a periodic sweep of old `pending` folders can remove them. Each completion is one Cloudinary Admin API call (the free plan has an hourly Admin API quota; the response reports `rate_limit_remaining`).

### `POST /media/import { url, purpose }` → 201 ("Add from link")

The API downloads a photo/video someone linked and stores it exactly like an upload (same response, type, size and length rules), so a post never depends on the other site. `https` only, up to 3 redirects each re-checked, hosts on private/loopback/link-local networks refused (SSRF), 50 MB / 30 s cap. A web page instead of a file → 400 "That link isn't a photo or video file…". Example: `https://www.pexels.com/download/video/18156302/` imports as a 10 s MP4.

### Video rules

- **Posts only**, and a post has **up to 10 photos or one video** (`400 "Add photos or a video, not both."`).
- **≤ 60 seconds** (checked on the stored file; longer ones are deleted and rejected) and **≤ 100 MB**. Phones record 1080p at about 2 MB/s, so 4K clips can go over, and the web app says so.
- Delivered as **MP4, at most 1280 px** (prepared at upload time), so any provider's video URL ends in a video extension. The web app shows a poster frame, plays inline with native controls (no autoplay), and pauses when scrolled away.

### Displaying media (web)

`apps/web/src/lib/media/media-url.ts` is the delivery loader (like a Next.js image loader). For Cloudinary URLs it requests the size needed plus `srcset`; with an aspect ratio it smart-crops with `c_fill,g_auto`, which keeps faces and subjects in frame. Other hosts pass through unchanged. Feed photos keep their own shape within **4:5 to 1.91:1** (the Instagram and Facebook range). Grids are 4:3; avatars are square face-crops at the displayed size. On phones the picker also offers **Camera** and **Record video** (`capture`).

### `DELETE /media/:id` → 204

Deletes a file **you** uploaded (e.g. removed from a draft before posting). `404` if it isn't yours. Best effort from the web app.

### Configuration

| Variable | |
| --- | --- |
| `STORAGE_PROVIDER` | `cloudinary` (default). An unknown value stops the API at startup with a clear message. |
| `STORAGE_MAX_CONCURRENT_UPLOADS` | Default `4`: files one instance sends to storage at once. |
| `STORAGE_DIRECT_UPLOADS` | Default off. `true` enables browser → storage uploads for videos (Admin API quota applies). |
| `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@<cloud_name>`. **Server-side only.** The shape is validated at startup and the value is never logged. Without it, `POST /media` answers 503 (production logs a warning). |

Files go under `myhoodora/<NODE_ENV>/<purpose>/`, so local test uploads never mix with production. Each upload is recorded in `media_assets` (owner, provider, provider id, url) so it can be deleted by our id, through the provider that stored it.

### Adding Supabase Storage or Firebase Storage

1. Implement `StorageProvider` (`upload`, `delete`, `url`) in `apps/api/src/storage/providers/<name>-storage.adapter.ts`. It's the only file that imports that SDK.
2. Add a `case "<name>"` in `createStorageProvider()` (`storage.module.ts`) reading its own env vars.
3. Set `STORAGE_PROVIDER=<name>`. Controllers, services and the web app don't change. Files already stored keep their old URLs; deletes of them answer 503 until moved.

---

## 21. Search (2026-09-30)

### `GET /search?q&type&limit` → 200

- `q`: 2–100 characters, case-insensitive. `type`: `posts` | `listings` | `people`; omit it for up to 5 of each. `limit`: 1–50 for one type (default 20).
- **Your own Hood only**, with exactly the visibility of the lists results come from: the feed (blocks, removed, deleted), For Sale & Free (sold hidden except your own) and neighbour search (verified, active). Empty arrays before you've joined a Hood.
- Also available on the lists themselves: `GET /posts/neighborhood/:id?q=` and `GET /listings?q=`.

```ts
{ q: string; posts?: Post[]; listings?: Listing[]; people?: PublicProfile[] }   // only the requested types are present
```

Web: the header search box → `/search?q=` with tabs All · Posts · For Sale & Free · Neighbours. On mobile, a search icon in the header.

Scale note: matching is a case-insensitive regex inside one Hood, which is fine at Hood size. Move to Atlas Search when Hoods grow into many thousands of posts.

---

## 22. Kindness Reminder check (2026-09-30)

### `POST /moderation/check { text }` → `{ flagged: boolean; reasons: ("insult" | "threat" | "shouting")[] }`

- A nudge before posting or commenting, **not moderation**: nothing is stored or reported (the anonymous shown/edited/posted-anyway counts stay on `POST /telemetry/kindness`).
- `insult`: name-calling, English plus common Pidgin, Yoruba and Igbo terms, on word boundaries (so "Odeyemi" and "foolproof" pass). `threat`: first-person threats ("I will deal with you"), not reports of crime. `shouting`: mostly capitals over 20+ letters.
- The web app shows the reason in the reminder and lets people edit or post anyway. It fails open: if the check is slow (3 s) or down, posting goes ahead. Throttled to 60/min.

---

## 23. Event reminders, after the event, and date rules (2026-10-01)

### Dates
- `POST /posts` with `category: "event"`: `eventDate` must be **≥ now − 1 h** (an event starting right now is fine) and **≤ 12 months ahead**, otherwise `400 "That date has already passed."` / `"Events can be up to a year ahead."`. The web composer applies the same rule. Recaps of past happenings are normal posts with photos.
- An event has no end-time field, so it's treated as lasting **3 hours**. It's "Happening now" from the start until start + 3 h, then "Ended".

### RSVP after the event
- `PUT /posts/:id/rsvp` after the event ended → `409 "This event has ended."`. Cancelling (`DELETE`) still works. `GET /posts/:id/rsvp` includes `ended: boolean`.
- Web: RSVP buttons become "This event has ended · N went"; the event moves to the **Past** tab when it ends (not when it starts); chips show **Today**, **Happening now** or **Ended**.

### Reminders (scheduler in the API, every 5 minutes)
| Who | When | Message |
| --- | --- | --- |
| Going | 2 days before (if RSVP'd 30+ min earlier) | "Reminder: {event} is on Sat 4 Oct, 4:00 pm", plus the place |
| Going | 3 hours before | "Starting in 3 hours: {event}". `kind: "event_reminder_final"` → the web app's **pop-up** |
| Interested | the day before | "{event} is tomorrow. Still interested?", inviting them to tap Going |
| Host | 2 days before | "Your event is in 2 days: n going, m interested" |
| Host | 9–48 h after it ended | "How did {event} go?" Share photos or a thank-you. `kind: "event_followup"` |
| Going | 9–48 h after it ended | "Hope you enjoyed {event}". Say thanks to the host. `kind: "event_followup"` |

- **Exactly once, even with several API instances:** each reminder is claimed with an atomic `$addToSet` on the RSVP (`remindersSent`) or the post (`hostNotices`) before it's sent. A missed window (API down) is skipped, never sent late.
- Only people still in the event's Hood are reminded; people who blocked the host aren't; deactivated accounts are skipped.
- Channels: in-app always; email only if the person turned on event emails (Settings → Notifications), via the usual template with a "View event" button.
- `EVENT_REMINDERS_ENABLED=false` turns the scheduler off (default on).

### Notifications gain `kind` and `subjectId`
`AppNotification` now has optional `kind` (`event_reminder` | `event_reminder_final` | `event_followup`) and `subjectId` (the event's post id). The web pop-up shows an **unread** `event_reminder_final` once:
- buttons: View event, Add to calendar (an `.ics` file built in the browser, with its own 1-hour alarm), Can't go anymore (cancels the RSVP), Got it;
- every choice marks it read; outside clicks don't dismiss it.

---

## 24. Web session cookie and logout (2026-10-01)

The browser still authenticates every API call with a **Firebase ID token** (`Authorization: Bearer <idToken>`). That hasn't changed. What changed is the cookie the web server (`src/proxy.ts`) uses to decide which *pages* to serve: it is now a **Firebase session cookie** minted by the Admin SDK, not the raw ID token.

| Route | Credential | Who calls it | Result |
| --- | --- | --- | --- |
| `POST /auth/session` | Bearer **ID token** (revocation checked) | The Next.js server, from `POST /api/auth/session` | `200 { sessionCookie, expiresIn }` (`expiresIn` in seconds). `401` if the token is invalid, expired or revoked. Suspended accounts are allowed. |
| `GET /auth/session` | Bearer **session cookie** (revocation checked) | The Next.js server, from the page gate for every signed-in page | `204` live · `401` invalid, expired or revoked. Suspended accounts are allowed. |
| `GET /auth/session/staff` | Bearer **session cookie** (revocation checked) | The Next.js server, from the `/admin` page gate | `204` staff · `403` not staff (or suspended) · `401` invalid, expired or revoked |
| `POST /auth/logout-everywhere` | Bearer ID token | The browser, from Settings → Account → **Sign out everywhere** | `204`. Revokes every refresh token: all ID tokens and session cookies for the account stop working. Replaces `POST /auth/logout`. |

- **The two credentials never stand in for each other.** `GET /auth/session` and `GET /auth/session/staff` are the only routes that take a session cookie; every other route takes ID tokens only. Firebase signs them with different issuers, so each verifier rejects the other kind.
- **Lifetime:** 7 days (`SESSION_COOKIE_TTL_DAYS`, 5 minutes to 14 days). The web renews the cookie once it is past half its life, as long as the Firebase session is alive, so someone who visits weekly never meets the login page.
- **What the cookie is worth:** page routing only. It returns no data: every data call needs an ID token and is revocation-checked.
- **Revocation at the page gate.** A cookie is never enough by having it. The proxy checks signature and expiry itself, then asks `GET /auth/session` whether the session is still live, and remembers "live" for 60 seconds per server instance (simultaneous requests share one call). This runs on every page, public ones included, whenever a cookie is present, so a rejected cookie is deleted wherever the visitor lands; visitors without a cookie cost nothing. So after a "sign out everywhere", a password change or a disabled account, signed-in pages stop being served within a minute (at once for a cookie the server hasn't seen in the last minute); the cookie is deleted and the visitor lands on `/login`. If the API can't be reached the page is served and shows the app's own "can't reach myHoodora" state, rather than signing everyone out.
- **A new sign-in always gets a new cookie** (the web compares `auth_time`), so a cookie from before a revocation is never carried over.
- **Rate limits** on the two session routes are per credential (hashed), not per IP: the web server calls them on everyone's behalf.
- **Logout is local.** The web's logout signs Firebase out in that browser and clears its cookie (`POST /api/auth/logout` on the web origin). Other browsers and devices stay signed in. `POST /auth/logout-everywhere` is the separate "sign out everywhere" action.

### Web routes (same origin, not this API)
- `POST /api/auth/session` `{ idToken }` → sets the HttpOnly cookie. `200` in place · `401` sign-in not valid (cookie cleared) · `503` API unreachable · `403` not a same-origin request. Idempotent: a cookie that already belongs to that person and is under half its life is kept without calling this API.
- `POST /api/auth/logout` → clears the cookie. Safe to repeat. `403` if not same-origin.
- Cookie: `__Host-session` in production (`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`); `__session` without `Secure` on plain-HTTP localhost.
- **Mock mode (`NEXT_PUBLIC_USE_MOCKS=true`) has no server session.** There is no API to mint or check a cookie, so the proxy gates nothing, `POST /api/auth/session` answers `200` without setting a cookie, and signed-out visitors are turned away by the pages themselves (AppShell, AdminShell, onboarding). `sessionReady` and the rest of `AuthContext` behave the same. Never deploy a mock build as the real site: it has no server-side page gate.
- **Cookie name and hosting.** `__Host-` needs HTTPS, `Path=/` and no `Domain`, all true when the app is served from its own origin (how it is deployed; there is no Firebase Hosting config in the repo). If the web is ever put behind **Firebase Hosting rewrites**, switch production to `__session` in `apps/web/src/lib/auth/session-cookie.ts`: Firebase Hosting forwards only that cookie name.
- **How the three states stay in step.** Firebase in the browser is the source of truth for *who is signed in*; the cookie follows it. Signed in with no (or a stale) cookie → the client re-creates it before navigating into the app. Signed out with a cookie → the client deletes it (only when it has reason to think one exists: someone was signed in in that tab, or the proxy just served a signed-in page). Revoked → the API refuses data at once, the open tab signs out on its first 401, and the page gate refuses within a minute.
- **QA accounts:** after `POST /auth/logout-everywhere` (used in testing), every session of that account is dead by design; just log in again.

### Media shapes on posts (2026-10-02)
Every post response (`POST /posts`, the feed, `GET /posts/:id`) now includes `mediaAspects: (number | null)[]`: width ÷ height of each `mediaUrls` entry, in the same order, from the dimensions recorded at upload. `null` means the API didn't store that file (a pasted link). The web frames photos and videos with it before they load, so a post no longer starts small and grows; for `null` it measures on load as before.

---

## 25. Batched broadcasts, listing photo shapes, upload cleanup (2026-10-02)

### Admin broadcasts are delivered after the request, in batches
- `POST /admin/broadcasts` now answers at once with `{ id, estimatedReach, status: "sending" }`. Delivery runs afterwards in batches of 1,000 notifications, so a message to every neighbour never holds a request open.
- `GET /admin/broadcasts` rows gain `status` (`sending` | `sent` | `failed`) and `delivered` (notifications written so far). Rows from before this change report `sent`.
- **No duplicates:** each notification carries a unique key per broadcast and person. Delivery can be re-run (after a restart, or by retry) and people who already have it are skipped. A broadcast still `sending` when the API starts is resumed automatically.
- **Double-click guard:** the same title, body and audience from the same sender within 5 minutes is `409 "You sent this exact message a moment ago…"`.
- `POST /admin/broadcasts/:id/retry` (needs `broadcasts.send`) finishes a `failed` broadcast → `{ id, status: "sending" }`; `409` unless it is `failed`, `404` if unknown.
- Authorisation is unchanged: `broadcasts.send` (admins and owners; moderators get 403). Suspended and deactivated accounts are never recipients. Broadcasts are in-app notifications only (no email).

### Listings carry photo shapes
`GET /listings`, `GET /listings/:id` and `POST /listings` responses include `photoAspects: (number | null)[]`, the same idea as `mediaAspects` on posts (§24): width ÷ height per photo, `null` for links the API didn't store.

### Abandoned direct uploads are cleaned up
With `STORAGE_DIRECT_UPLOADS=true`, a ticket nobody completes within an hour is swept: the stored file (if any) is deleted from the storage provider, then the pending record. Runs hourly. Direct uploads remain **off by default**; the standard path is `POST /media` through the API.

### Revocation check (2026-10-02)
The API no longer calls Firebase on every request to ask whether a session was revoked. It verifies the token locally and compares its sign-in time with (a) `sessionsRevokedAt` on our user record, set by `POST /auth/logout-everywhere` and read on every request, and (b) Firebase's own revocation state, re-read at most once per user every `AUTH_REVOCATION_CACHE_SECONDS` (default 30). Responses are unchanged: a revoked token is still `401`.


## 26. Changes from the October 2026 audit (2026-10-06)

Each of these implements an item in [`codebase-audit.md`](./codebase-audit.md). All are compatible with the web build that was live before them, unless marked **breaking**.

### A Firebase outage is 503, not 401 (B2)
Any authenticated route can answer `503 { message: "We can't check your sign-in right now. Please try again in a moment." }` when the API cannot reach Google: either to download its signing keys or to read a user's revocation state. It used to answer 401, which the web treats as a dead session and signs the person out. While Google is unreachable, the last known revocation state of a user is reused for up to 5 minutes after it was fetched. "Sign out everywhere" and suspensions are unaffected: they come from our own records.

The web server's own checks follow the same rule: `POST /api/auth/session` answers 503 (cookie kept) and the page gate lets the page load when it cannot download Google's keys.

### Who may read a Hood (B3, B4)
- **A Hood counts only for a verified neighbour.** An account that is unverified, pending or rejected gets 404 (or an empty list) from every Hood-scoped route, whatever `neighborhoodId` is on its record.
- **`reject_verification` removes the Hood.** The neighbour's `neighborhoodId` is cleared (kept as `lastNeighborhoodId` for staff). `verify` gives one back.
- **`change_hood` needs a verified neighbour**, otherwise `400 "This neighbour isn't verified yet. Verify them to place them in a Hood."` The admin page only offered it for verified neighbours already.
- **`POST /users/me/verify-location` can move a verified neighbour to a different Hood once every 90 days** (`HOOD_CHANGE_COOLDOWN_DAYS`). Sooner: `409` with a message naming their Hood, and they stay in it. The attempt is recorded with `result: "mismatch"`. A move that is allowed writes an audit record, action `hood_self_change`.
- **`GET /neighborhoods`, `/neighborhoods/nearby`, `/neighborhoods/:id`** return the full record (centre, radius) only to staff and to a Hood's own verified members. Everyone else gets `{ _id, name, city, country }`. **Breaking** for a client that drew other Hoods' circles; the web never did.
- `HOOD_ACCESS_STRICT=false` turns all five off (a temporary rollback switch).

### Neighbour detail: address for admins (B15)
`GET /admin/neighbours/:uid` (and the same view returned by `POST …/actions`) includes `location` only for admins and owners, as §13.3 always said. Moderators get the rest unchanged, including `verificationAttempts`. (Confirmed on 2026-10-07: moderators may see the addresses in verification attempts and in the verification queue; they need them to review address checks.)

### `POST /posts`: `clientId`, and alerts announced afterwards (B6)
- New optional field `clientId` (8 to 64 letters, digits, `-` or `_`; a UUID is ideal). Send the same value when repeating a request (after a timeout): the response is the post created the first time, `201` again, and nothing is created or announced twice. Scoped to the author. Never returned.
- For `category: "alert"` the response no longer waits for neighbours to be notified. Notifications follow within seconds, written in batches by a background job, each neighbour once. Hoods of any size are covered (there was a 5,000 limit).

### Event posts carry their RSVPs (B7)
Every post with `category: "event"` includes `rsvp: { postId, goingCount, interestedCount, myStatus, ended }`, the same object `GET /posts/:id/rsvp` returns. A page of events needs no request per card.

### Rate limits are per person (B7)
- Signed in: counted per person. On public routes: per IP, as before. Numbers unchanged (10/s, 60/min, 500/h, stricter per route).
- Before sign-in is checked there is one generous per-IP ceiling against floods (1,000 requests per 10 s). The web server's session routes are exempt, as they all come from one address.
- A `429` from the rate limiter has `message: "Too many requests. Please wait a moment and try again."` and a `Retry-After` header in seconds, exposed to browsers through CORS.

### Uploads: who, and how much (B12)
- `POST /media`, `/media/import` and `/media/direct` with `purpose` `post`, `listing` or `group` need the same standing as posting (a verified, active neighbour): otherwise `403` with the usual "Verify your address…" or "Your account is restricted…" message. `purpose: "avatar"` stays open to any account.
- Each person may keep up to 200 files and 1 GB uploaded in any 24 hours (`STORAGE_DAILY_UPLOADS`, `STORAGE_DAILY_UPLOAD_MB`). Past that: `429 "You've reached today's upload limit. Try again tomorrow."`

### Deactivation hides content (B5, first step)
See §10. `author` / `seller` / `participants[]` cards for someone who has deactivated are `{ uid, displayName: "Former neighbour" }` with no `photoURL`.

### Moderation (B8, B9, B11, B20)
- **A new report reopens a decided case** when the content is still up (the author was warned, or it was removed and later restored). The case goes to staff with `status: "open"`, a new `reopenedAt`, and `resolution` still holding the earlier decision, which stays appealable.
- **Suspended accounts can call** `GET /moderation/my-decisions`, `POST /moderation/cases/:id/appeals`, `GET /notifications` and `GET /notifications/unread-count`.
- **A conversation can be reported only by the two people in it** (anyone else: `404`), and the report is about the other person. Each report records `reportedUid`; `GET /admin/reports/:id` shows it as `reports[].reported`.
- **Overturning a "keep" on a reporter's appeal** sets the case's `resolution` to `remove_content` (by the reviewer) and sends the author the usual "Your post was removed… You can appeal within 30 days" notification.

### Long threads (B10)
`GET /conversations/:id/messages` and `GET /posts/:id/comments` return the **newest** page (they returned the oldest 500 and nothing after). Query: `limit` (1 to 500, default 500) and `before` (the id of the oldest item you have). Items are oldest-first within a page. A full page means there may be earlier ones.

### Web server lookup routes (B14)
`/api/geocode`, `/api/reverse-geocode` and `/api/ip-location` need a valid session cookie (`401` without), allow 20 calls a minute per person (`429` with `Retry-After`), and answer `504` when the third party is too slow.

### Staff actions (B19, B21, B22, B24)
- A group whose last member leaves is archived.
- `POST /admin/neighbours/bulk` handles each neighbour on their own and returns `{ updated, results: [{ uid, ok, message? }] }` in the order sent. `403` only when the caller may not take that action on anyone.
- `PATCH /admin/hoods/:id` answers `409` when a larger `radiusMeters` would overlap another Hood. `POST /neighborhoods` and `DELETE /neighborhoods/:id` now write the same audit records as the `/admin/hoods` routes.
- Removing or restoring content, alert actions, Hood changes and Hood Lead appointments commit together with their audit record, or not at all.

### Notifications
A `title` over 140 characters or a `body` over 280 is shortened with "…", never refused (B18).

## 27. Decisions of 7 October 2026

The questions the audit left open, as the owner answered them, and what the API now does.

### Posting and messaging need a confirmed email (audit B3)
- `content.create` (posts, comments, listings, groups, group posts, media for any of them) and `messages.send` (starting a conversation, sending a message) need a confirmed email address as well as a verified address. Confirmed means our emailed link was followed, or the person signs in with a provider that has proved the address (Google).
- Without it: `403 "Confirm your email address first. We sent you a link when you signed up; you can ask for a new one at the top of the app."` `GET /users/me` already reports `emailVerified`.
- Unaffected: reading, reactions, RSVPs, reports, a profile photo, preferences, `POST /auth/email-verification/resend`. Staff capabilities do not depend on it.
- `EMAIL_CONFIRMATION_REQUIRED=false` turns it off. **Needed wherever verification emails cannot be delivered yet.**

### Privacy settings take effect (audit B23)
- `privacy.profileVisibility: "nearby"` opens `GET /users/:uid/public` to verified neighbours of Hoods whose centre is within 5 km of the profile owner's, as well as their own Hood. `"neighbourhood"` (the default) is unchanged. Blocks still apply. It is the profile owner's setting that counts, not the viewer's.
- `privacy.messaging: "contacts"` ("Only people I've messaged") lets someone start a new conversation only if the recipient has sent them a message before, in any conversation between the two. It used to refuse everyone, like `"nobody"`. Existing conversations carry on under every setting, as before.

### Account deletion, 30 days after deactivation (audit B5)
Runs as a background job per account, only when `DATA_DELETION_MODE=live` (`dry-run`, the default, logs what would go and changes nothing).

| What | What happens to it |
| --- | --- |
| Posts, listings, comments, group posts | Deleted (comment counts adjusted) |
| Uploaded files | Deleted from storage |
| Group memberships and join requests | Removed. A group they alone ran passes to its longest-standing member, or is archived if nobody is left |
| Hood Lead role, notifications, email-confirmation links, other people's blocks on them | Removed |
| Firebase sign-in | Deleted |
| The user record | Emptied of everything personal and marked `purgedAt`. The uid remains |
| Conversations | **Kept for the other person, both sides.** The deleted person's uid is replaced, in `participantUids`, `members`, `startedBy`, `lastMessage` and every message's `senderUid`, by the stand-in `"deleted-user"`, whose card is `{ uid: "deleted-user", displayName: "Deleted User" }`. `POST /conversations/:id/messages` to such a conversation is `403 "This person has deleted their account, so they can't receive messages."` |
| Moderation cases, reports, audit events | Kept, with the bare uid |

- `GET /users/me` for a deleted account: `410 "This account has been deleted."` For an account deactivated more than 30 days ago while deletion is live: `410 "This account was deactivated more than 30 days ago and can no longer be restored."` In `dry-run` and `off`, signing in still restores the account however long it has been.
- Author cards for a deleted account are `{ uid, displayName: "Deleted User" }`.
- The only owner is never deleted: an error is logged until the role is handed on.

### Media is deleted with its content (audit B13)
An hourly sweep deletes stored files that nothing uses, in the same `DATA_DELETION_MODE`. A file counts as in use while a live post, listing or group, or someone's profile, has its URL; for one hour after its post or listing is deleted by its author; and for 31 days after staff remove the content (the appeal window). An upload never attached to anything is kept for 24 hours. Content restored after its window comes back without its media.

### Left as they are
- **Rate limits** keep the numbers in §26 (10/s, 60/min, 500/h), per person.
- **The IP lookup** behind `/api/ip-location` (ip-api.com) stays.
- **Moderators** may see the addresses in verification attempts and the verification queue. The profile `location` on `GET /admin/neighbours/:uid` remains admins-only, as §13.3 says.
