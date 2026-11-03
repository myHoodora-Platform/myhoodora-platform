# Worklog: chat polish, Redis where it helps, Swagger review (2026-09-30)

A resumable checklist. If a session ends mid-way, continue from the first unticked box. Every step leaves the build green (`tsc`, `eslint`, tests) before the next starts.

**Ground rules** (from the request):
- Follow existing patterns: port/adapter like `EMAIL_PROVIDER` / `REALTIME_BUS`, DRY, no business-logic rewrites.
- Inspect before changing.
- Don't over-engineer.
- Upstash bills per command (free tier: 500K a month), so every Redis use must earn its cost.

## Part A: chat that feels like a chat
- [x] A1. **Typing indicator**: "… is typing" with animated dots.
  - API: `POST /conversations/:id/typing`, `POST /support/threads/:id/typing` (neighbour) and `POST /admin/inbox/:id/typing` (staff). No database write; each publishes an ephemeral `chat.typing` / `support.typing` event to the other side only.
  - Server throttle: at most 1 per person per thread per 3 s, which also caps Upstash cost.
- [x] A2. Web: `useTypingSignal` (sends while the draft changes, throttled) plus a `TypingDots` bubble in the shared `ChatMessageList`. Used in neighbour chat, support chat and the admin support thread. Hides 5 s after the last signal or when their message arrives.
- [x] A3. Tests: API throttle and recipients; web hook throttling. Live check in Chrome.

## Part B: Redis only where it clearly helps
- [x] B1. Inspect: rate limiting (`ThrottlerModule`, currently in-memory per instance), hot or expensive reads (settings, hoods, admin overview/insights), background work (emails and notifications are sent inline), temporary data.
- [x] B2. Write the decision in "Decisions" below: what uses Redis and why, and what doesn't.
- [x] B3. ~~Shared `REDIS_CLIENT` provider~~ **Not needed**: no new Redis use passed B2, so adding one would be unused code.
- [x] B4. Implement the chosen item: the chat client cache (web `src/lib/memory-cache.ts`, used by the chat list, chat thread and support screens, cleared on sign-out), with tests.

## Part C: Swagger/OpenAPI review
- [x] C1. Inventory: controllers without tags, auth or summaries; routes missing params, query or body docs; DTOs with poor examples or enums; missing important error responses. The plugin (`introspectComments`, `classValidatorShim`) already documents DTO fields from types and comments.
- [x] C2. Fix gaps only: summaries, `@ApiParam`/`@ApiQuery` where the plugin can't infer, examples on key DTO fields, 404/409 where real, `@Public()` routes clearly unauthenticated, the realtime SSE route documented as `text/event-stream`.
- [x] C3. Verify: fetch `/api/docs-json`, script-check every operation has a summary, a tag and correct security; confirm there are no behaviour changes (API tests pass).
- [x] C4. Summary: issues found, changes, what was left alone and why, remaining gaps.

## Decisions (filled in as work proceeds)
**Redis is used for one thing, cross-instance live updates (pub/sub), which it already does.** Nothing else clears the bar today. Each candidate, with the reason:

| Candidate | Verdict | Why |
| --- | --- | --- |
| Live updates across instances | **Redis (done)** | The only way to fan out between instances; 1 command per event |
| Typing signals | **Redis pub/sub, no storage** | Ephemeral: throttled with `RealtimeService.gate()` before any read, never persisted |
| Global rate limiting (`ThrottlerModule`, 3 windows) | **Not now**: add Redis storage **when running >1 instance** | Shared limits only matter with several instances, and it costs about 3 Upstash commands **per request** (500K a month free is roughly 5K requests a day). Per-instance limits are acceptable abuse protection today. Per-person daily limits (alerts, groups, listings, conversations) are already enforced from MongoDB, so they're shared already |
| Caching `GET /users/me` / the account guard's per-request user read | **No** | Upstash is a network hop like Atlas (no latency win), and a cached role or suspension would need invalidation on every staff action, so it's a correctness risk for no gain |
| Platform settings | **No** | Already cached in-process for 30 s; changes are rare |
| Admin overview counts (~15 `countDocuments`) | **No** | Staff-only, low traffic; caching would make the live sidebar counts stale |
| Feeds / posts / listings | **No** | Viewer-relative (blocks, own reactions, votes), so a shared cache would be wrong or complex |
| Background jobs (emails, notifications, broadcasts) | **No Redis queue** | A BullMQ worker polls Redis constantly, which burns Upstash commands; Upstash recommends QStash for queues. See finding below |

**Finding (not Redis, reported not changed):** `POST /admin/broadcasts` to "Everyone" notifies recipients **one by one inside the request** (`NotificationsService.notify` loop, up to 100,000). At scale this would time out. The right fix is batching (`insertMany`, chunked emails) or a hosted queue (QStash); it's business logic, so it's out of scope here.

**"Caching the right way" for chat is client-side.** Opening a conversation you've already seen should be instant. The web app will keep chats in an in-memory stale-while-revalidate cache per tab (never `localStorage`: messages are private on shared devices), cleared on sign-out, and refreshed by live events. It costs no Redis and makes the biggest visible difference.

## Progress notes
- Start: API tests 30/30, web tests 87/87; realtime bus is Redis (Upstash) on `myhoodora:realtime:development`.
- Part A done: typing routes (`/conversations/:id/typing`, `/support/threads/:id/typing`, `/admin/inbox/:id/typing`), `RealtimeService.gate()` (checked before any DB read), web `use-typing.ts` + `TypingDots` in the shared `ChatMessageList`. Verified in Chrome: dots appear live, hide after 5 s; Chrome typing reached the other user's stream. API 31 tests, web 87.
- Part B done: no new Redis uses (see Decisions); chat client cache `src/lib/memory-cache.ts` (+3 tests) used by chat list/thread and support list/thread, cleared on sign-out. Verified in Chrome: reopening a thread shows messages instantly. Web 90 tests.
- Part C done: all 147 operations have a summary, a declared tag and a 2xx response; 404 documented on 22 by-id routes (was 1); SSE route documented as `text/event-stream`; 14 DTO field examples. Only decorators and comments changed. API 31 tests, lint and tsc clean.
  - **Gotcha 1:** adding any response decorator (e.g. `@ApiNotFound`) removes Nest's implicit default 2xx, so always pair it with `@ApiOkResponse` / `@ApiCreatedResponse` / `@ApiNoContentResponse`.
  - **Gotcha 2:** on a *required* `string` field, the Swagger plugin drops an `@example` with spaces unless it's double-quoted (`@example "Office chair, barely used"`), and it turns `'` into `"`, so avoid apostrophes.
  - Left as-is: 108 success responses without a body schema (services return TS interfaces; response classes would duplicate them).
