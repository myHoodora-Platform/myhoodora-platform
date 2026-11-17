import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

type Me = {
  streak: { current: number; best: number; tier: string | null; activeToday: boolean } | null;
  challenge: { invites: number; activeDays: number; builder: boolean; active: boolean } | null;
  badge: { builder?: true; tier?: string; streak?: number } | null;
};

/** Streaks, the launch challenge and badges (plan WP-C, contract §42), counted from what people already did. */
describe("Streaks, Hood Builders and badges", () => {
  let t: TestApp;
  let hood: string;
  const DAY = 86_400_000;
  const CROWD = 100;
  const admin = () => t.auth("admin1", { emailVerified: true });
  const me = async (uid: string) => (await t.http.get("/api/engagement/me").set(t.auth(uid, { emailVerified: true })).expect(200)).body as Me;
  /** Activity `daysAgo` days back (noon Lagos), straight into the collections, as if it had happened then. */
  const activeOn = async (uid: string, daysAgo: number[], kind: "posts" | "comments" | "poll_votes" | "rsvps" = "posts") => {
    const noon = (d: number) => new Date(Date.now() - d * DAY);
    const rows = daysAgo.map((d) =>
      kind === "posts"
        ? { authorUid: uid, neighborhoodId: hood, content: "x", message: "x", category: "general", type: "general", isActive: true, mediaUrls: [], createdAt: noon(d), updatedAt: noon(d) }
        : kind === "comments"
          ? { authorUid: uid, postId: "p", content: "x", createdAt: noon(d), updatedAt: noon(d) }
          : { uid, postId: `p${d}`, optionId: "a", status: "going", createdAt: noon(d), updatedAt: noon(d) },
    );
    await t.users.db.collection(kind).insertMany(rows);
  };

  beforeAll(async () => {
    t = await createTestApp();
    hood = await t.hood();
    for (const uid of ["ada", "bisi", "chidi", "dele", "emeka"]) await t.member(uid, hood, { displayName: uid[0]!.toUpperCase() + uid.slice(1) });
    await t.member("admin1", hood, { role: "admin" });
    await t.member("mod1", hood, { role: "moderator" });
    await t.users.insertMany(Array.from({ length: CROWD }, (_, i) => ({ uid: `n${i}`, email: `n${i}@t.dev`, displayName: `N ${i}`, neighborhoodId: hood, verificationStatus: "verified", ageConfirmedAt: new Date() })));
    // The challenge began three weeks ago for this test.
    await t.http.patch("/api/admin/engagement").set(admin()).send({ challengeStartsAt: new Date(Date.now() - 21 * DAY).toISOString() }).expect(200);
  });
  afterAll(() => t.close());

  it("counts a streak from posts, replies, votes and RSVPs, forgiving one missed day a week", async () => {
    await activeOn("ada", [0, 1, 2]);
    await activeOn("ada", [3], "comments");
    await activeOn("ada", [4], "poll_votes");
    await activeOn("ada", [6], "rsvps"); // day 5 missed: forgiven
    const s = await me("ada");
    expect(s.streak).toMatchObject({ current: 6, activeToday: true, tier: "bronze" });
    expect(s.challenge).toMatchObject({ activeDays: 6, builder: true, active: true });
    expect(s.badge).toEqual({ builder: true, tier: "bronze", streak: 6 });
  });

  it("makes a Hood Builder from 3 verified invites in the challenge; unverified or older invites don't count", async () => {
    const at = new Date(Date.now() - 2 * DAY);
    await t.users.updateMany({ uid: { $in: ["n0", "n1", "n2"] } }, { $set: { invitedBy: { uid: "bisi", code: "BIS22", via: "link", at } } });
    await t.users.updateOne({ uid: "n3" }, { $set: { invitedBy: { uid: "bisi", code: "BIS22", via: "link", at }, verificationStatus: "unverified" } });
    await t.users.updateOne({ uid: "n4" }, { $set: { invitedBy: { uid: "bisi", code: "BIS22", via: "link", at: new Date(Date.now() - 40 * DAY) } } });
    expect((await me("bisi")).challenge).toMatchObject({ invites: 3, builder: true });
    await activeOn("chidi", [0, 1]);
    expect((await me("chidi")).challenge).toMatchObject({ activeDays: 2, builder: false });
  });

  it("shows the badge on their posts and replies in the feed", async () => {
    await t.post("ada", { message: "Hello from a builder" });
    const feed = (await t.http.get(`/api/posts/neighborhood/${hood}`).set(t.auth("n10", { emailVerified: true })).expect(200)).body as { author: { uid: string; badge?: Me["badge"] } }[];
    expect(feed.find((p) => p.author.uid === "ada")?.author.badge).toEqual({ builder: true, tier: "bronze", streak: 6 });
  });

  it("staff grant and take away the badge (audited); a taken one doesn't come back by itself", async () => {
    await t.http.put("/api/admin/engagement/builders/chidi").set(t.auth("mod1", { emailVerified: true })).send({ on: true, reason: "Hood Lead" }).expect(403);
    expect((await t.http.put("/api/admin/engagement/builders/chidi").set(admin()).send({ on: true, reason: "Hood Lead picked offline" }).expect(200)).body.challenge.builder).toBe(true);
    await t.http.put("/api/admin/engagement/builders/ada").set(admin()).send({ on: false, reason: "Spam posting" }).expect(200);
    expect((await me("ada")).challenge?.builder).toBe(false);
    const builders = (await t.http.get("/api/admin/engagement/builders").set(t.auth("mod1", { emailVerified: true })).expect(200)).body as { uid: string; by: string }[];
    expect(builders.map((b) => b.uid).sort()).toEqual(["bisi", "chidi"]);
    expect(builders.find((b) => b.uid === "chidi")?.by).toBe("staff");
    const csv = await t.http.get("/api/admin/engagement/builders?format=csv").set(admin()).expect(200);
    expect(csv.text.split("\n")[0]).toBe('"Name","Hood","Builder since","How","Verified invites","Active days"');
    expect(await t.model("AuditEvent").countDocuments({ action: { $in: ["builder_grant", "builder_revoke"] } })).toBe(2);
  });

  it("ending the challenge stops new Builders; earned badges stay; the switch takes badges off avatars", async () => {
    await t.http.post("/api/admin/engagement/end-challenge").set(admin()).expect(201);
    await activeOn("dele", [0, 1, 2, 3, 4, 5]);
    expect((await me("dele")).challenge).toMatchObject({ builder: false, active: false });
    expect((await me("bisi")).challenge?.builder).toBe(true);
    const view = (await t.http.get("/api/admin/engagement").set(admin()).expect(200)).body;
    expect(view.counts.builders).toBe(2);
    expect(view.counts.streaks.bronze).toBeGreaterThanOrEqual(1);

    await t.http.patch("/api/admin/engagement").set(admin()).send({ badgesOn: false }).expect(200);
    expect((await me("bisi")).badge).toBeNull();
    const card = (await t.http.get(`/api/posts/neighborhood/${hood}`).set(t.auth("n10", { emailVerified: true })).expect(200)).body as { author: { badge?: unknown } }[];
    expect(card.every((p) => !p.author.badge)).toBe(true);
    await t.http.patch("/api/admin/engagement").set(admin()).send({ badgesOn: true, challengeEndsAt: null }).expect(200);
  });

  it("refreshes everyone recently active in one go, at volume", async () => {
    for (let i = 20; i < 70; i++) await activeOn(`n${i}`, [0, 1, 2, 3, 4]);
    const svc = t.app.get((await import("../src/engagement/engagement.service")).EngagementService);
    expect(await svc.refreshRecent()).toBeGreaterThanOrEqual(50);
    expect(await t.users.countDocuments({ "engagement.builderAt": { $ne: null }, uid: /^n/ })).toBe(50);
  });
});
