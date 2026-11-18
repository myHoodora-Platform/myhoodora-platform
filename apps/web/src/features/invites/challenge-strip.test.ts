import { describe, expect, it } from "vitest";
import { challengeStrip, lagosToday, type EngagementSummary } from "@myhoodora/api-contract/engagement";

const challenge = { name: "myHoodora Launch Challenge", startsAt: "2026-11-16T23:00:00.000Z", endsAt: null, active: true, minInvites: 5, minActiveDays: 5, invites: 1, activeDays: 2, builder: false, builderSince: null };
const streak = { current: 4, best: 6, tier: "bronze" as const, activeToday: true, toNextTier: 3 };
const summary = (over: Partial<EngagementSummary>): EngagementSummary => ({ streak: null, challenge: null, badge: null, ...over });

/** The slim strip at the top of the feed (web and app share these words). */
describe("challengeStrip", () => {
  it("invites people into the challenge with both paths' progress", () => {
    expect(challengeStrip(summary({ challenge, streak }))).toEqual({ title: "Become a Hood Builder", detail: "1 of 5 invites · 2 of 5 days" });
    expect(challengeStrip(summary({ challenge: { ...challenge, activeDays: 9, invites: 7 } }))!.detail).toBe("5 of 5 invites · 5 of 5 days");
  });

  it("thanks a Hood Builder and shows their streak", () => {
    expect(challengeStrip(summary({ challenge: { ...challenge, builder: true }, streak }))).toEqual({ title: "You're a Hood Builder", detail: "4-day streak ✓ · invite neighbours" });
    expect(challengeStrip(summary({ challenge: { ...challenge, builder: true } }))!.detail).toBe("Invite neighbours to grow your Hood");
  });

  it("after the challenge, only a streak is worth a line; nothing at all stays quiet", () => {
    const ended = { ...challenge, active: false };
    expect(challengeStrip(summary({ challenge: ended, streak: { ...streak, activeToday: false } }))).toEqual({ title: "4-day streak", detail: "Post, reply, vote or RSVP today to keep it going" });
    expect(challengeStrip(summary({ challenge: ended }))).toBeNull();
    expect(challengeStrip(summary({ streak: { ...streak, current: 0 } }))).toBeNull();
    expect(challengeStrip(null)).toBeNull();
  });

  it("hides until tomorrow in Lagos time", () => {
    expect(lagosToday(Date.parse("2026-11-17T22:59:00Z"))).toBe("2026-11-17");
    expect(lagosToday(Date.parse("2026-11-17T23:00:00Z"))).toBe("2026-11-18");
  });
});
