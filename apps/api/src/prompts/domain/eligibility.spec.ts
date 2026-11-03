import { pickPrompt, shouldAskStoreReview, type Neighbour, type PromptRule } from "./eligibility";

const now = new Date("2026-10-27T12:00:00Z");
const DAY = 86_400_000;
const rule = (over: Partial<PromptRule> = {}): PromptRule => ({ id: "p1", status: "active", deleted: false, triggerType: "action", triggerKey: "post_created", triggerCount: 1, hoodIds: [], cities: [], priority: 5, maxShows: 2, ...over });
const me = (over: Partial<Neighbour> = {}): Neighbour => ({ joinedAt: new Date(now.getTime() - 30 * DAY), hoodId: "h1", city: "Lagos", answered: new Set(), shows: new Map(), ...over });
const opts = { now, cooldownDays: 14 };

describe("pickPrompt", () => {
  it("fires on its action from the Nth time", () => {
    const p = rule({ triggerCount: 3 });
    expect(pickPrompt([p], me(), { key: "post_created", count: 2 }, opts)).toBeNull();
    expect(pickPrompt([p], me(), { key: "post_created", count: 3 }, opts)).toBe(p);
    expect(pickPrompt([p], me(), { key: "comment_created", count: 3 }, opts)).toBeNull();
  });

  it("open and manual prompts show when the app opens; manual only once sent", () => {
    const open = rule({ id: "o", triggerType: "open", triggerKey: undefined });
    const manual = rule({ id: "m", triggerType: "manual", triggerKey: undefined, sentAt: null });
    expect(pickPrompt([open], me(), { key: "app_open", count: 9 }, opts)).toBe(open);
    expect(pickPrompt([manual], me(), { key: "app_open", count: 1 }, opts)).toBeNull();
    const sent = { ...manual, sentAt: new Date(now.getTime() - 1000) };
    expect(pickPrompt([sent], me(), { key: "app_open", count: 1 }, opts)).toBe(sent);
  });

  it("respects the audience: neighbourhoods, cities and how long they've been here", () => {
    expect(pickPrompt([rule({ hoodIds: ["h2"] })], me(), { key: "post_created", count: 1 }, opts)).toBeNull();
    expect(pickPrompt([rule({ cities: ["Lagos"] })], me(), { key: "post_created", count: 1 }, opts)).not.toBeNull();
    expect(pickPrompt([rule({ maxDaysSinceJoin: 7 })], me(), { key: "post_created", count: 1 }, opts)).toBeNull();
    expect(pickPrompt([rule({ minDaysSinceJoin: 7 })], me(), { key: "post_created", count: 1 }, opts)).not.toBeNull();
  });

  it("never again once answered, nor after being closed maxShows times", () => {
    expect(pickPrompt([rule()], me({ answered: new Set(["p1"]) }), { key: "post_created", count: 1 }, opts)).toBeNull();
    expect(pickPrompt([rule({ maxShows: 2 })], me({ shows: new Map([["p1", 2]]) }), { key: "post_created", count: 1 }, opts)).toBeNull();
  });

  it("waits out the cooldown since the last prompt, except for one sent by hand", () => {
    const recent = me({ lastPromptAt: new Date(now.getTime() - 3 * DAY) });
    expect(pickPrompt([rule()], recent, { key: "post_created", count: 1 }, opts)).toBeNull();
    const manual = rule({ triggerType: "manual", triggerKey: undefined, sentAt: new Date(now.getTime() - DAY) });
    expect(pickPrompt([manual], recent, { key: "app_open", count: 1 }, opts)).toBe(manual);
    expect(pickPrompt([rule()], me({ lastPromptAt: new Date(now.getTime() - 15 * DAY) }), { key: "post_created", count: 1 }, opts)).not.toBeNull();
  });

  it("drafts, paused, deleted, not-yet-started and ended prompts stay quiet; highest priority wins", () => {
    for (const over of [{ status: "draft" }, { status: "paused" }, { deleted: true }, { startsAt: new Date(now.getTime() + DAY) }, { endsAt: new Date(now.getTime() - DAY) }]) {
      expect(pickPrompt([rule(over)], me(), { key: "post_created", count: 1 }, opts)).toBeNull();
    }
    const low = rule({ id: "a", priority: 2 });
    const high = rule({ id: "b", priority: 9 });
    expect(pickPrompt([low, high], me(), { key: "post_created", count: 1 }, opts)).toBe(high);
  });
});

describe("shouldAskStoreReview", () => {
  const rules = { enabled: true, milestones: [{ key: "post_created", count: 5 }], minDaysSinceJoin: 7, cooldownDays: 120 };
  const n = { joinedAt: new Date(now.getTime() - 30 * DAY) };

  it("asks exactly at a milestone, once settled in, and rarely", () => {
    expect(shouldAskStoreReview(rules, n, { key: "post_created", count: 5 }, now)).toBe(true);
    expect(shouldAskStoreReview(rules, n, { key: "post_created", count: 6 }, now)).toBe(false);
    expect(shouldAskStoreReview(rules, { joinedAt: new Date(now.getTime() - 2 * DAY) }, { key: "post_created", count: 5 }, now)).toBe(false);
    expect(shouldAskStoreReview(rules, { ...n, lastAskedAt: new Date(now.getTime() - 30 * DAY) }, { key: "post_created", count: 5 }, now)).toBe(false);
    expect(shouldAskStoreReview({ ...rules, enabled: false }, n, { key: "post_created", count: 5 }, now)).toBe(false);
  });
});
