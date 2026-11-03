import { JobsService } from "../src/jobs/jobs.service";
import { NotificationsService } from "../src/notifications/notifications.service";
import { PostsService } from "../src/posts/posts.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * Audit B6: telling a Hood about an alert used to happen inside POST /posts, one neighbour at a
 * time. In a large Hood the request outlived the web's 15-second limit after the post already
 * existed, so the retry posted the alert twice.
 */
describe("Alerts: the Hood is told after the request, in batches, exactly once", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  const CROWD = 2_000;

  type Row = { uid: string; title: string; body?: string; href: string; groupKey?: string; dedupeKey?: string; readAt: Date | null; actorUid?: string };
  const notifications = () => t.model<Row>("Notification");
  const jobs = () => t.app.get(JobsService);
  const about = (postId: string) => notifications().find({ href: `/p/${postId}` }).lean<Row[]>();
  const alert = (extra: Record<string, unknown> = {}) => ({ message: "Burst pipe flooding Road 12", category: "alert", alertCategory: "other", ...extra });
  const post = (uid: string, body: Record<string, unknown>) => t.http.post("/api/posts").set(t.auth(uid)).send(body);

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1");
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    for (const uid of ["ada", "bola", "chidi"]) await t.member(uid, lekki);
    await t.member("dayo", lekki, { blockedUids: ["ada"] });
    await t.member("gone", lekki, { deactivatedAt: new Date() });
    await t.member("susp", lekki, { accountStatus: "suspended" });
    await t.user("stranger", { neighborhoodId: lekki });
    await t.member("yemi", yaba);
    await t.users.insertMany(
      Array.from({ length: CROWD }, (_, i) => ({ uid: `n${String(i).padStart(5, "0")}`, email: `n${i}@test.dev`, displayName: `N ${i}`, neighborhoodId: yaba, verificationStatus: "verified", verifiedAt: new Date() })),
    );
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());
  afterEach(async () => {
    jest.restoreAllMocks();
    await jobs().drain();
    await notifications().deleteMany({});
  });

  it("the request answers without waiting for anyone to be notified", async () => {
    // Hold every notification write until the test lets go: the old code could not answer while this was held.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const service = t.app.get(NotificationsService);
    const real = service.notify.bind(service);
    jest.spyOn(service, "notify").mockImplementation(async (input) => {
      await held;
      return real(input);
    });

    const res = await post("yemi", alert()).expect(201);
    expect(res.body).toMatchObject({ category: "alert", authorUid: "yemi" });
    expect(await about(res.body._id)).toEqual([]);
    expect(await t.model("Job").countDocuments({ type: "alert.fanout", "payload.postId": res.body._id })).toBe(1);

    release();
    await jobs().drain();
    expect(await notifications().countDocuments({ href: `/p/${res.body._id}` })).toBe(CROWD);
  });

  it("a 2,000-member Hood is told in a few writes, each neighbour exactly once", async () => {
    const model = notifications();
    const bulk = jest.spyOn(model, "bulkWrite");
    const insert = jest.spyOn(model, "insertMany");
    const create = jest.spyOn(model, "create");
    const one = jest.spyOn(model, "updateOne");

    const res = await post("yemi", alert()).expect(201);
    await jobs().drain();

    const perPerson = await model.aggregate<{ _id: string; n: number }>([{ $match: { href: `/p/${res.body._id}` } }, { $group: { _id: "$uid", n: { $sum: 1 } } }]);
    expect(perPerson).toHaveLength(CROWD);
    expect(perPerson.every((p) => p.n === 1)).toBe(true);
    // Batches of 1,000, not a round trip (or two) per neighbour.
    expect(bulk.mock.calls.length + insert.mock.calls.length).toBeLessThanOrEqual(4);
    expect(create).not.toHaveBeenCalled();
    expect(one).not.toHaveBeenCalled();
  });

  it("goes to verified, active neighbours of that Hood only: not the author, not someone who blocked them, not other Hoods", async () => {
    const res = await post("ada", alert()).expect(201);
    await jobs().drain();
    const rows = await about(res.body._id);
    expect(rows.map((r) => r.uid).sort()).toEqual(["bola", "chidi"]);
    expect(rows[0]).toMatchObject({ title: "New other alert in your Hood", body: "Burst pipe flooding Road 12", actorUid: "ada", readAt: null });
  });

  it("an urgent alert that is delivered twice (a retry, a takeover) still reaches each neighbour once", async () => {
    const res = await post("bola", alert({ urgent: true, alertCategory: "security", message: "Armed robbery on Admiralty Way" })).expect(201);
    await jobs().drain();
    const posts = t.app.get(PostsService);
    await posts.fanOutAlert(res.body._id);
    await posts.fanOutAlert(res.body._id);
    const rows = await about(res.body._id);
    expect(rows.map((r) => r.uid).sort()).toEqual(["ada", "chidi", "dayo"]);
    expect(rows[0]!.title).toBe("Urgent: security alert nearby");
  });

  it("ordinary alerts of one kind within half an hour stay one unread notification per neighbour, showing the latest", async () => {
    const first = await post("ada", alert({ alertCategory: "power", message: "Power out on Road 3" })).expect(201);
    await jobs().drain();
    await post("ada", alert({ alertCategory: "power", message: "Power back on Road 3" })).expect(201);
    await jobs().drain();
    // Delivered again for good measure: grouping makes that harmless too.
    await t.app.get(PostsService).fanOutAlert(first.body._id);

    const mine = await notifications().find({ uid: "bola" }).lean<Row[]>();
    expect(mine).toHaveLength(1);
    expect(mine[0]!.groupKey).toMatch(/^alert:/);

    // Once read, the next alert is a new notification, not an edit of the read one.
    await notifications().updateMany({ uid: "bola" }, { $set: { readAt: new Date() } });
    await post("chidi", alert({ alertCategory: "power", message: "Transformer sparking" })).expect(201);
    await jobs().drain();
    expect(await notifications().countDocuments({ uid: "bola" })).toBe(2);
  });

  it("an alert deleted before the Hood was told is not announced", async () => {
    jest.spyOn(jobs(), "enqueue").mockResolvedValue(true); // recorded, but not run yet
    const res = await post("chidi", alert()).expect(201);
    jest.restoreAllMocks();
    await t.http.delete(`/api/posts/${res.body._id}`).set(t.auth("chidi")).expect(204);
    await t.app.get(PostsService).fanOutAlert(res.body._id);
    expect(await about(res.body._id)).toEqual([]);
  });

  it("a job that can't be recorded doesn't fail a post that already exists (the retry would post it twice)", async () => {
    jest.spyOn(jobs(), "enqueue").mockRejectedValue(new Error("database blip"));
    const logged = jest.spyOn((t.app.get(PostsService) as unknown as { logger: { error: () => void } }).logger, "error").mockImplementation(() => undefined);
    const res = await post("chidi", alert({ alertCategory: "traffic" })).expect(201);
    expect(res.body._id).toEqual(expect.any(String));
    expect(logged).toHaveBeenCalled();
  });

  describe("a retried POST with the same clientId is the same post", () => {
    const clientId = (n: number) => `c1d2e3f4-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const postCount = (uid: string) => t.model("FeedPost").countDocuments({ authorUid: uid });

    it("returns the post created the first time, and tells the Hood once", async () => {
      const before = await postCount("ada");
      const body = alert({ alertCategory: "fire", message: "Bush fire behind the estate", clientId: clientId(1) });
      const first = await post("ada", body).expect(201);
      const again = await post("ada", body).expect(201);
      expect(again.body._id).toBe(first.body._id);
      expect(again.body).toMatchObject({ message: "Bush fire behind the estate", category: "alert" });
      expect(await postCount("ada")).toBe(before + 1);
      await jobs().drain();
      expect((await about(first.body._id)).map((r) => r.uid).sort()).toEqual(["bola", "chidi"]);
      // The first-class field never leaves the server.
      expect(first.body.clientId).toBeUndefined();
    });

    it("holds when both requests arrive together", async () => {
      const before = await postCount("bola");
      const body = { message: "Anyone seen a grey cat?", clientId: clientId(2) };
      const [a, b] = await Promise.all([post("bola", body), post("bola", body)]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body._id).toBe(b.body._id);
      expect(await postCount("bola")).toBe(before + 1);
    });

    it("lets a retried urgent alert through: it is the same alert, not a second one within six hours", async () => {
      const body = alert({ urgent: true, alertCategory: "security", message: "Gunshots near the gate", clientId: clientId(3) });
      const first = await post("chidi", body).expect(201);
      const again = await post("chidi", body).expect(201);
      expect(again.body._id).toBe(first.body._id);
      // A genuinely new urgent alert is still limited.
      await post("chidi", { ...body, clientId: clientId(4) }).expect(429);
    });

    it("is per person: the same id from two neighbours is two posts; no id means no deduplication", async () => {
      const body = { message: "Good morning neighbours", clientId: clientId(5) };
      const mine = await post("ada", body).expect(201);
      const theirs = await post("bola", body).expect(201);
      expect(theirs.body._id).not.toBe(mine.body._id);
      const plain = { message: "Same words twice" };
      expect((await post("ada", plain).expect(201)).body._id).not.toBe((await post("ada", plain).expect(201)).body._id);
    });

    it("refuses an id that isn't one", async () => {
      for (const bad of ["short", "x".repeat(65), "has spaces in it!", 12345678]) await post("ada", { message: "Hello", clientId: bad }).expect(400);
    });
  });

  // Audit B18: a notification longer than the limits used to be refused after the action it reports had happened.
  it("a title or body past the limits is shortened, never refused", async () => {
    const n = await t.app.get(NotificationsService).notify({ uids: ["bola"], type: "group", title: "T".repeat(200), body: "B".repeat(400), href: "/groups/x" });
    expect(n).toBe(1);
    const row = await notifications().findOne({ uid: "bola", href: "/groups/x" }).lean<Row>();
    expect(row!.title).toHaveLength(140);
    expect(row!.title.endsWith("…")).toBe(true);
    expect(row!.body).toHaveLength(280);
    // The grouped path writes differently, so it is checked separately.
    await t.app.get(NotificationsService).notify({ uids: ["chidi"], type: "group", title: "T".repeat(200), body: "B".repeat(400), href: "/groups/y", groupKey: "long:1" });
    const grouped = await notifications().findOne({ uid: "chidi", href: "/groups/y" }).lean<Row>();
    expect([grouped!.title.length, grouped!.body!.length]).toEqual([140, 280]);
  });
});
