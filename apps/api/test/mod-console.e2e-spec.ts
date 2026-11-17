import { RealtimeService } from "../src/realtime/realtime.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

type Item = { postId: string; hood: { id: string }; author: { uid: string; newcomer: boolean }; firstPost: boolean; waitingMinutes: number; overdue: boolean };

/** The moderator console (plan WP-B, contract §45). */
describe("Moderator console", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  const v = { emailVerified: true };
  const needs = async (uid: string, qs = "") => (await t.http.get(`/api/admin/console/needs-reply${qs}`).set(t.auth(uid, v)).expect(200)).body as { items: Item[]; waiting: number; overdue: number };
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1", 3.4746, 6.4478, 1500);
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    await t.member("mod1", lekki, { role: "moderator", displayName: "Mo Derator" });
    await t.member("admin1", lekki, { role: "admin" });
    await t.member("old", lekki, { createdAt: new Date(Date.now() - 60 * 86_400_000) } as never);
    await t.users.db.collection("users").updateMany({ uid: { $in: ["old", "yemi"] } }, { $set: { createdAt: new Date(Date.now() - 60 * 86_400_000) } });
    await t.member("newbie", lekki);
    await t.member("yemi", yaba);
    await t.users.insertMany(Array.from({ length: 100 }, (_, i) => ({ uid: `n${i}`, email: `n${i}@t.dev`, displayName: `N ${i}`, neighborhoodId: i % 2 ? lekki : yaba, verificationStatus: "verified", ageConfirmedAt: new Date(), emailVerifiedAt: new Date() })));
    // Established neighbours (joined two months ago): not newcomers.
    await t.users.db.collection("users").updateMany({ uid: { $in: [/^n\d+$/, "yemi"] } }, { $set: { createdAt: new Date(Date.now() - 60 * 86_400_000) } });
    for (let i = 0; i < 40; i++) await t.post(`n${i}`, { message: `Question ${i}` });
    ids.oldPost = (await t.post("old", { message: "Anyone know a plumber?" }))._id;
    // An old question, two and a half hours ago.
    await t.users.db.collection("posts").updateOne({ authorUid: "old" }, { $set: { createdAt: new Date(Date.now() - 150 * 60_000) } });
    ids.newbiePost = (await t.post("newbie", { message: "Hi everyone, just moved in!" }))._id;
    ids.yaba = (await t.post("yemi", { message: "Yaba question" }))._id;
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("lists unanswered posts: a newcomer's first post first, then whoever waited longest; overdue after 2 hours", async () => {
    const r = await needs("mod1");
    expect(r.waiting).toBe(43);
    expect(r.items[0]).toMatchObject({ postId: ids.newbiePost, firstPost: true, author: { newcomer: true } });
    expect(r.items[1]).toMatchObject({ postId: ids.oldPost, overdue: true });
    expect(r.overdue).toBe(1);
    await t.http.get("/api/admin/console/needs-reply").set(t.auth("n1", v)).expect(403);
  });

  it("replies as yourself (Staff) or as the Hood Team; answered posts leave the list", async () => {
    const mine = (await t.http.post("/api/admin/console/reply").set(t.auth("mod1", v)).send({ postId: ids.newbiePost, content: "Welcome to Lekki! 👋", as: "self" }).expect(201)).body;
    expect(mine.author).toMatchObject({ uid: "mod1", staff: true });
    const team = (await t.http.post("/api/admin/console/reply").set(t.auth("mod1", v)).send({ postId: ids.yaba, content: "Good question, neighbours?", as: "team" }).expect(201)).body;
    expect(team.author).toMatchObject({ kind: "team" });
    const r = await needs("mod1");
    expect(r.items.some((i) => i.postId === ids.newbiePost || i.postId === ids.yaba)).toBe(false);
    expect(await t.model("AuditEvent").countDocuments({ action: { $in: ["console_reply", "console_reply_team"] } })).toBe(2);
  });

  it("admins assign Hoods; 'My Hoods' shows only those", async () => {
    await t.http.put("/api/admin/console/assignments/mod1").set(t.auth("mod1", v)).send({ hoodIds: [yaba] }).expect(403);
    const list = (await t.http.put("/api/admin/console/assignments/mod1").set(t.auth("admin1", v)).send({ hoodIds: [yaba] }).expect(200)).body;
    expect(list.staff.find((s: { uid: string }) => s.uid === "mod1").hoods).toEqual([{ id: yaba, name: "Yaba" }]);
    const mine = await needs("mod1", "?mine=true");
    expect(mine.items.length).toBeGreaterThan(0);
    expect(mine.items.every((i) => i.hood.id === yaba)).toBe(true);
    expect((await needs("mod1", "?mine=false")).items.some((i) => i.hood.id === lekki)).toBe(true);
  });

  it("stats: posts, replied, median minutes to the first reply, first replies per staff member", async () => {
    const s = (await t.http.get("/api/admin/console/stats").set(t.auth("mod1", v)).expect(200)).body;
    expect(s).toMatchObject({ posts: 43, replied: 2 });
    expect(s.medianMinutesToFirstReply).toEqual(expect.any(Number));
    expect(s.firstRepliesByStaff.map((x: { uid: string }) => x.uid).sort()).toEqual(["mod1", "myhoodora-hood-team"]);
  });

  it("open consoles hear about new posts and replies at once, one staff event per busy second", async () => {
    const spy = jest.spyOn(t.app.get(RealtimeService), "toStaff");
    const settle = () => new Promise((r) => setTimeout(r, 1300));
    for (let i = 60; i < 70; i++) await t.post(`n${i}`, { message: `Burst ${i}` });
    await settle();
    expect(spy.mock.calls.filter(([type]) => type === "console.changed")).toHaveLength(1);
    const burst = (await needs("mod1")).items.find((i) => i.postId);
    await t.http.post("/api/admin/console/reply").set(t.auth("mod1", v)).send({ postId: burst!.postId, content: "On it!", as: "self" }).expect(201);
    await settle();
    expect(spy.mock.calls.filter(([type]) => type === "console.changed")).toHaveLength(2);
    spy.mockRestore();
  });
});
