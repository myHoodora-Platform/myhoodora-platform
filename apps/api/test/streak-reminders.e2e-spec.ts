import { lagosDay } from "../src/engagement/domain/streak";
import { EngagementService } from "../src/engagement/engagement.service";
import { StreakRemindersService } from "../src/engagement/streak-reminders.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** The 18:00 WAT streak reminder (plan WP-C, contract §42), on a crowd of 100 neighbours. */
describe("Streak reminders", () => {
  let t: TestApp;
  let hood: string;
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const CROWD = 100;
  // Today at 18:30 Lagos time (17:30 UTC), whatever the clock says when the test runs.
  const at = (watHour: number, watMinute = 30) => new Date(Date.parse(`${lagosDay(new Date())}T00:00:00Z`) + (watHour - 1) * HOUR + watMinute * 60_000);
  const evening = at(18);
  const run = (now: Date) => t.app.get(StreakRemindersService).tick(now);
  /** A post `daysAgo` days before `evening`, mid-afternoon Lagos time. */
  const postOn = (uid: string, daysAgo: number[]) =>
    t.users.db.collection("posts").insertMany(
      daysAgo.map((d) => {
        const when = new Date(evening.getTime() - d * DAY - 3 * HOUR);
        return { authorUid: uid, neighborhoodId: hood, content: "x", message: "x", category: "general", type: "general", isActive: true, mediaUrls: [], createdAt: when, updatedAt: when };
      }),
    );
  const pushedTo = () => new Set(t.pushProvider.outbox.map((m) => m.token.replace(/^tok-/, "")));

  beforeAll(async () => {
    t = await createTestApp();
    hood = await t.hood();
    await t.users.insertMany(
      Array.from({ length: CROWD }, (_, i) => ({
        uid: `s${i}`,
        email: `s${i}@t.dev`,
        displayName: `S ${i}`,
        neighborhoodId: hood,
        verificationStatus: "verified",
        ageConfirmedAt: new Date(),
        ...(i === 15 && { preferences: { notifications: { streaks: { push: false, email: false } } } }),
        ...(i === 16 && { deactivatedAt: new Date() }),
      })),
    );
    await t.model("PushDevice").insertMany(Array.from({ length: CROWD }, (_, i) => ({ uid: `s${i}`, token: `tok-s${i}`, platform: "android", lastSeenAt: new Date() })));
    for (let i = 0; i < CROWD; i++) {
      // s0–s9 are already active today; s10–s14 have only a 2-day streak; everyone else has 4 days, not today yet.
      await postOn(`s${i}`, i < 10 ? [0, 1, 2, 3] : i < 15 ? [1, 2] : [1, 2, 3, 4]);
    }
    await t.app.get(EngagementService).refreshRecent(evening);
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await t.pushSettled();
    t.pushProvider.outbox.length = 0;
  });

  it("nothing before 18:00 or from 21:00 Lagos time", async () => {
    expect(await run(at(17, 59))).toBe(0);
    expect(await run(at(21, 0))).toBe(0);
  });

  it("at 18:30, one push to everyone whose 3+ day streak would break today, and who wants it", async () => {
    // s15 turned streak pushes off (still gets the quiet in-app note); s16 deactivated; s0–s9 already active; s10–s14 below 3 days.
    expect(await run(evening)).toBe(CROWD - 16);
    await t.pushSettled();
    const pushed = pushedTo();
    expect(pushed.size).toBe(CROWD - 17);
    for (const skipped of ["s0", "s9", "s10", "s14", "s15", "s16"]) expect(pushed.has(skipped)).toBe(false);
    expect(t.pushProvider.outbox.find((m) => m.token === "tok-s50")).toMatchObject({ title: "Keep your 4-day streak going" });
    const row = await t.model<{ uid: string; kind: string; href: string }>("Notification").findOne({ uid: "s50" }).lean();
    expect(row).toMatchObject({ kind: "streak_reminder", href: "/news-feed" });
  });

  it("at most once a day, even when it runs again (another instance, a restart)", async () => {
    expect(await run(new Date(evening.getTime() + 20 * 60_000))).toBe(0);
    await t.pushSettled();
    expect(t.pushProvider.outbox).toHaveLength(0);
  });

  it("not to someone who was active since the last refresh, and not when streaks are switched off", async () => {
    await t.users.updateMany({ uid: { $in: ["s40", "s41"] } }, { $unset: { streakRemindedDay: 1 } });
    await postOn("s40", [0]);
    // s40 posted this afternoon: recomputed before sending, so no nudge. s41 still gets one.
    expect(await run(evening)).toBe(1);
    await t.users.updateOne({ uid: "s41" }, { $unset: { streakRemindedDay: 1 } });
    await t.http.patch("/api/admin/engagement").set(await admin()).send({ streaksOn: false }).expect(200);
    expect(await run(evening)).toBe(0);
  });

  async function admin() {
    await t.member("admin1", hood, { role: "admin" });
    return t.auth("admin1", { emailVerified: true });
  }
});
