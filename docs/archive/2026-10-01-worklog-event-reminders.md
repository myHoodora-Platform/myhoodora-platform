# Worklog: event reminders, follow-ups, no past-dated events (2026-10-01)

Plan: `~/.claude/plans/let-me-see-how-goofy-badger.md`. Continue from the first unticked box.

Decisions (user): Going → 2 days + 3 hours before; Interested → 1 day before. Pop-up only for the final (3-hour) reminder. After the event: Ended, RSVPs closed, next-morning follow-ups (host recap, attendee thanks). Past dates blocked on the API too (1 h grace, ≤ 12 months ahead).

- [x] E1. API time rules `posts/domain/event-time.ts` (`EVENT_LENGTH_MS`, `eventEndsAt`, `hasEnded`, `dueReminders`) + tests.
- [x] E2. API: `validateMeta` date window; RSVP after end → 409; `rsvpSummary.ended`.
- [x] E3. Notifications: optional `kind` + `subjectId` (schema, `NotifyInput`, `AppNotification`).
- [x] E4. `EventRemindersService` (5-min tick, exactly-once claims on `Rsvp.remindersSent` / `post.hostNotices`, indexes, `EVENT_REMINDERS_ENABLED`) + tests.
- [x] E5. Web: `event-time.ts` (`eventPhase`), `lib/calendar.ts` (`.ics`), RSVP closed when ended, Happening now/Ended chips, upcoming/past split at the end time, composer 12-month cap.
- [x] E6. Web: `EventReminderModal` (unread `event_reminder_final` → once) mounted in the app shell + tests.
- [x] E7. Docs (contract, env), live test on Atlas, Chrome check.

## Progress notes
- E1–E4 done: `posts/domain/event-time.ts` (8 tests), `validateMeta` date window, RSVP 409 after end + `ended`, notification `kind`/`subjectId`, `EventRemindersService` (6 tests incl. two-instance race). API posts tests 18.
- E5–E6 done: web `event-time.ts`, `lib/calendar.ts`, `EventPhaseChip`, RSVP closed when ended + "Add to calendar", past split at the end, composer window; `EventReminderModal` inside `NotificationBell` (3-line change), shown once. Web tests 113.
- E7 done: contract §23, env. Live on Atlas: past/far dates 400; final reminder sent once over two passes (claim recorded); RSVP after end 409 + `ended`; host recap + attendee follow-up once; test data removed. Chrome: pop-up shows ("Starting in 1 h 57 min"), outside click doesn't dismiss, Got it marks read, gone after reload; "Today" chip.
- Bug found in Chrome and fixed: the dialog was dismissed by a focus change as it opened (which marked it read unseen); it now ignores outside interactions.
- Note: the network to Atlas and Google was flaky during testing (connect timeouts); every check was retried until it ran.
