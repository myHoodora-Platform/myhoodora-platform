import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HOOD_TEAM_UID } from "../src/hood-content/domain/hood-team";
import { atWat, watDate } from "../src/hood-content/domain/schedule";
import { HoodContentService } from "../src/hood-content/hood-content.service";
import { JobsService } from "../src/jobs/jobs.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const BANK = readFileSync(join(__dirname, "../../../docs/product/hood-content-bank.md"), "utf8");

type FeedItem = { type: string; data: { _id: string; pinned?: boolean; source?: string; message: string; author: { uid: string; kind?: string; staff?: boolean } } };
type Scheduled = { _id: string; hoodId: string; status: string; code: string | null; source: string; runAt: string; problem: string | null; postId: string | null };

describe("Hood Team: content bank, official posts, pins, activation and daily prompts", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  let bodija: string;
  const CROWD = 120;

  const admin = () => t.auth("boss", { emailVerified: true });
  const drain = () => t.app.get(JobsService).drain();
  const service = () => t.app.get(HoodContentService);
  const feedPage = async (uid: string, hoodId: string, cursor?: string) =>
    (await t.http.get(`/api/feed/hood/${hoodId}?limit=20&session=testsession01${cursor ? `&cursor=${cursor}` : ""}`).set(t.auth(uid, { emailVerified: true })).expect(200)).body as { items: FeedItem[]; nextCursor: string | null };

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1");
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    await t.hood("Surulere", 3.3534, 6.5005, 1500);
    bodija = String((await t.hoods.create({ name: "Bodija", city: "Ibadan", country: "Nigeria", location: { type: "Point", coordinates: [3.9104, 7.4305] }, radiusMeters: 1500, status: "active" }))._id);
    await t.member("boss", lekki, { role: "admin" });
    await t.member("mod1", lekki, { role: "moderator" });
    await t.member("ada", lekki);
    await t.member("tunde", yaba);
    // A busy Hood: many neighbours, many posts.
    await t.users.insertMany(
      Array.from({ length: CROWD }, (_, i) => ({ uid: `n${i}`, email: `n${i}@test.dev`, displayName: `N ${i}`, neighborhoodId: lekki, verificationStatus: "verified", verifiedAt: new Date(), emailVerifiedAt: new Date(), ageConfirmedAt: new Date() })),
    );
    const base = Date.now() - CROWD * 60_000;
    await t.model("FeedPost").insertMany(
      Array.from({ length: CROWD }, (_, i) => ({ authorUid: `n${i}`, neighborhoodId: lekki, type: "text", content: `Neighbour post ${i}`, message: `Neighbour post ${i}`, category: "general", createdAt: new Date(base + i * 60_000) })),
    );
    await service().ensureTeamAccount();
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("sets up one official account nobody can be confused with a neighbour", async () => {
    await service().ensureTeamAccount();
    expect(await t.users.countDocuments({ uid: HOOD_TEAM_UID })).toBe(1);
    const profile = (await t.http.get(`/api/users/${HOOD_TEAM_UID}/public`).set(t.auth("tunde")).expect(200)).body;
    expect(profile).toMatchObject({ displayName: "myHoodora Hood Team", kind: "team", verified: true });
  });

  it("imports the content bank file (staff with content.manage only), and again adds nothing", async () => {
    await t.http.post("/api/admin/hood-content/items/import").set(t.auth("mod1", { emailVerified: true })).send({ markdown: BANK }).expect(403);
    await t.http.post("/api/admin/hood-content/items/import").set(t.auth("ada", { emailVerified: true })).send({ markdown: BANK }).expect(403);
    const first = (await t.http.post("/api/admin/hood-content/items/import").set(admin()).send({ markdown: BANK }).expect(200)).body;
    expect(first).toMatchObject({ added: 180, updated: 0, problems: [] });
    const again = (await t.http.post("/api/admin/hood-content/items/import").set(admin()).send({ markdown: BANK }).expect(200)).body;
    expect(again).toMatchObject({ added: 0, unchanged: 180 });
    // Moderators can read the bank.
    const items = (await t.http.get("/api/admin/hood-content/items?tag=welcome").set(t.auth("mod1", { emailVerified: true })).expect(200)).body as { code: string; pinDays: number }[];
    expect(items.map((i) => i.code)).toEqual(["W01", "W02", "W03", "W04", "W05", "W06", "W07", "W08", "W09", "W10"]);
  });

  it("posts as the Hood Team, pinned on top of the first page only, and paging never repeats it", async () => {
    const welcome = (await t.http.get("/api/admin/hood-content/items?q=W02").set(admin()).expect(200)).body[0] as { _id: string };
    const res = (await t.http.post("/api/admin/hood-content/compose").set(admin()).send({ itemId: welcome._id, hoodIds: [lekki] }).expect(201)).body;
    expect(res).toMatchObject({ hoods: 1, scheduled: 1 });
    await drain();

    const first = await feedPage("ada", lekki);
    const top = first.items[0]!.data;
    expect(top).toMatchObject({ pinned: true, source: "team", author: { uid: HOOD_TEAM_UID, kind: "team" } });
    expect(top.message).toContain("Good morning, Lekki Phase 1");
    expect(top.message).not.toMatch(/\{hood\}|\{city\}/);

    // Walk the whole feed: every neighbour post once, the pinned post once.
    const seen: string[] = first.items.map((i) => i.data._id);
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await feedPage("ada", lekki, cursor);
      expect(page.items.some((i) => i.data.pinned)).toBe(false);
      seen.push(...page.items.map((i) => i.data._id));
      cursor = page.nextCursor;
    }
    expect(seen.length).toBe(CROWD + 1);
    expect(new Set(seen).size).toBe(seen.length);

    // The legacy list pages by skip: the pinned post sits outside it.
    const legacy = (await t.http.get(`/api/posts/neighborhood/${lekki}?limit=10&skip=0`).set(t.auth("ada")).expect(200)).body as { pinned?: boolean }[];
    expect(legacy.length).toBe(11);
    expect(legacy[0]!.pinned).toBe(true);

    // Unpin: back in date order (newest, so still first, but not pinned).
    await t.http.patch(`/api/admin/hood-content/posts/${top._id}/pin`).set(admin()).send({ days: 0 }).expect(204);
    const after = await feedPage("ada", lekki);
    expect(after.items[0]!.data).toMatchObject({ _id: top._id });
    expect(after.items[0]!.data.pinned).toBeUndefined();
    // Neighbours' posts are never pinned.
    await t.http.patch(`/api/admin/hood-content/posts/${after.items[1]!.data._id}/pin`).set(admin()).send({ days: 3 }).expect(400);
  });

  it("a retried publish job returns the post it already made", async () => {
    const res = (await t.http.post("/api/admin/hood-content/compose").set(admin()).send({ message: "Water update for {hood}", hoodIds: [yaba] }).expect(201)).body;
    await drain();
    const [row] = (await t.http.get(`/api/admin/hood-content/scheduled?batchId=${res.batchId}`).set(admin()).expect(200)).body as Scheduled[];
    expect(row).toMatchObject({ status: "published" });
    await t.model("ScheduledPost").updateOne({ _id: row!._id }, { $set: { status: "scheduled" } });
    await service().publish(row!._id);
    expect(await t.model("FeedPost").countDocuments({ neighborhoodId: yaba, authorUid: HOOD_TEAM_UID })).toBe(1);
  });

  it("schedules later, lists it, and cancelling stops it", async () => {
    const runAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    const res = (await t.http.post("/api/admin/hood-content/compose").set(admin()).send({ message: "Later in {hood}", allHoods: true, runAt }).expect(201)).body;
    expect(res).toMatchObject({ hoods: 4, scheduled: 4 });
    expect((await t.http.post(`/api/admin/hood-content/batches/${res.batchId}/cancel`).set(admin()).expect(200)).body).toEqual({ cancelled: 4 });
    const rows = (await t.http.get(`/api/admin/hood-content/scheduled?batchId=${res.batchId}`).set(admin()).expect(200)).body as Scheduled[];
    expect(rows.every((r) => r.status === "cancelled")).toBe(true);
    // Even if its job ran, nothing is posted.
    await service().publish(rows[0]!._id);
    expect(await t.model("FeedPost").countDocuments({ message: { $regex: "^Later in" } })).toBe(0);
  });

  it("refuses alerts, unfinished local details and bad input", async () => {
    await t.http.post("/api/admin/hood-content/compose").set(admin()).send({ message: "Hi", category: "alert", hoodIds: [lekki] }).expect(400);
    await t.http.post("/api/admin/hood-content/compose").set(admin()).send({ message: "Hi" }).expect(400);
    await t.http.post("/api/admin/hood-content/compose").set(admin()).send({ message: "Vote", category: "poll", pollOptions: ["Only"], hoodIds: [lekki] }).expect(400);
    const info = (await t.http.get("/api/admin/hood-content/items?q=I01").set(admin()).expect(200)).body[0] as { _id: string; needsLocalDetails: boolean };
    expect(info.needsLocalDetails).toBe(true);
    const res = (await t.http.post("/api/admin/hood-content/compose").set(admin()).send({ itemId: info._id, hoodIds: [lekki] }).expect(201)).body;
    expect(res).toMatchObject({ scheduled: 0, needsLocalDetails: [{ code: "I01", cities: ["Lagos"] }] });
  });

  it("activation: quiet Hoods get the ten-day plan once; busy Hoods are left alone; city versions fill local details", async () => {
    const i06 = (await t.http.get("/api/admin/hood-content/items?q=I06").set(admin()).expect(200)).body[0] as { _id: string };
    await t.http
      .patch(`/api/admin/hood-content/items/${i06._id}`)
      .set(admin())
      .send({ cityVariants: [{ city: "Ibadan", body: "⚡ Light in {hood} comes from IBEDC." }] })
      .expect(200);

    const res = (await t.http.post("/api/admin/hood-content/activation").set(admin()).send({ allHoods: true }).expect(201)).body;
    // Lekki has 120+ posts: left alone. Yaba (1 post), Surulere and Bodija get the plan.
    expect(res).toMatchObject({ hoods: 3, activeHoods: 1 });
    const missing = new Map((res.needsLocalDetails as { code: string; cities: string[] }[]).map((w) => [w.code, w.cities]));
    expect(missing.get("I01")).toEqual(["Ibadan", "Lagos"]);
    expect(missing.get("I06")).toEqual(["Lagos"]); // Ibadan has its own version now

    const again = (await t.http.post("/api/admin/hood-content/activation").set(admin()).send({ allHoods: true }).expect(201)).body;
    expect(again).toMatchObject({ scheduled: 0, alreadyScheduled: res.scheduled });

    // Day 0's welcome post goes out at 08:00 Lagos time (now, if that has passed): bring it forward
    // so the test doesn't depend on the hour it runs.
    const welcomes = (await t.model<{ _id: unknown }>("ScheduledPost").find({ source: "activation", code: "W01" }).lean().exec()).map((r) => String(r._id));
    await t.model("ScheduledPost").updateMany({ _id: { $in: welcomes } }, { $set: { runAt: new Date() } });
    await t.model("Job").updateMany({ "payload.id": { $in: welcomes } }, { $set: { runAt: new Date() } });
    await drain();
    const page = await feedPage("tunde", yaba);
    const welcome = page.items.find((i) => i.data.message.includes("Welcome to Yaba on myHoodora"));
    expect(welcome?.data).toMatchObject({ pinned: true, source: "team" });
    const bodijaRows = (await t.http.get(`/api/admin/hood-content/scheduled?hoodId=${bodija}&source=activation`).set(admin()).expect(200)).body as Scheduled[];
    expect(bodijaRows.some((r) => r.code === "I06")).toBe(true);
  });

  it("daily prompt: once a day, in open Hoods not in their activation plan today", async () => {
    await t.http.patch("/api/admin/hood-content/daily").set(admin()).send({ enabled: true, hour: 8 }).expect(200);
    const today = watDate(new Date());
    const nine = atWat(today, "09:00");
    const seven = atWat(today, "07:00");
    expect(await service().dailyTick(seven)).toBe(0);
    const scheduled = await service().dailyTick(nine);
    // Only Lekki: the other three are in their activation plan today.
    expect(scheduled).toBe(1);
    expect(await service().dailyTick(new Date(nine.getTime() + 3600_000))).toBe(0);
    await drain();
    const rows = (await t.http.get(`/api/admin/hood-content/scheduled?source=daily`).set(admin()).expect(200)).body as Scheduled[];
    expect(rows).toEqual([expect.objectContaining({ hoodId: lekki, status: "published" })]);
    // A chosen day overrides the rotation.
    const daily = (await t.http.put(`/api/admin/hood-content/daily/calendar/${today}`).set(admin()).send({ code: "D31" }).expect(200)).body;
    expect(daily.upcoming[0]).toMatchObject({ date: today, code: "D31", chosen: true });
  });

  it("starters: filled in for your Hood, 'Introduce yourself' first; none before you join", async () => {
    const starters = (await t.http.get("/api/hood-content/starters").set(t.auth("tunde")).expect(200)).body as { code: string; text: string }[];
    expect(starters[0]).toMatchObject({ code: "S01" });
    expect(starters.length).toBe(6);
    expect(starters.every((s) => !/\{hood\}|\[FILL/.test(s.text))).toBe(true);
    await t.user("newbie");
    expect((await t.http.get("/api/hood-content/starters").set(t.auth("newbie")).expect(200)).body).toEqual([]);
  });

  it("replies to a Hood Team post never notify the system account; staff show a Staff label", async () => {
    const [team] = (await feedPage("tunde", yaba)).items.filter((i) => i.data.source === "team");
    await t.http.post(`/api/posts/${team!.data._id}/comments`).set(t.auth("tunde", { emailVerified: true })).send({ content: "Thanks Hood Team!" }).expect(201);
    expect(await t.model("Notification").countDocuments({ uid: HOOD_TEAM_UID })).toBe(0);
    const staffPost = await t.post("boss", { message: "Hello from the admin" });
    const view = (await t.http.get(`/api/posts/${staffPost._id}`).set(t.auth("ada")).expect(200)).body;
    expect(view.author).toMatchObject({ staff: true });
    expect(view.author.kind).toBeUndefined();
  });
});
