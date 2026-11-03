import { BroadcastsService } from "../src/admin/broadcasts.service";
import { NotificationsService } from "../src/notifications/notifications.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

describe("Admin broadcasts: delivered in batches, after the request", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  const CROWD = 2_300; // more than two batches of 1,000

  type Row = { id: string; status: string; delivered: number; reach: number };
  const list = async () => (await t.http.get("/api/admin/broadcasts").set(t.auth("boss")).expect(200)).body as Row[];
  /** Waits for delivery to finish. Reads the database directly: polling the API would trip the rate limit. */
  const settled = async (id: string): Promise<Row> => {
    for (let i = 0; i < 200; i++) {
      const b = await t.model<Row>("Broadcast").findById(id).lean<Row>().exec();
      if (b && b.status !== "sending") return b;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("broadcast never finished");
  };
  const notifications = () => t.model<{ uid: string; dedupeKey?: string }>("Notification");
  const send = (uid: string, body: unknown) => t.http.post("/api/admin/broadcasts").set(t.auth(uid)).send(body as object);

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1");
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    await t.member("boss", lekki, { role: "admin" });
    await t.member("boss2", lekki, { role: "admin" });
    await t.member("mod1", lekki, { role: "moderator" });
    await t.member("ada", lekki);
    await t.member("gone", yaba, { deactivatedAt: new Date() } as never);
    await t.member("susp", yaba, { accountStatus: "suspended" });
    await t.users.insertMany(
      Array.from({ length: CROWD }, (_, i) => ({ uid: `n${String(i).padStart(5, "0")}`, email: `n${i}@test.dev`, displayName: `N ${i}`, neighborhoodId: yaba, verificationStatus: "verified", verifiedAt: new Date() })),
    );
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("answers at once, then reaches everyone in the audience exactly once", async () => {
    const res = await send("boss", { title: "Water outage", body: "Mains repair tomorrow from 9am to noon.", audience: { type: "hood", hoodIds: [yaba] } }).expect(201);
    expect(res.body).toMatchObject({ estimatedReach: CROWD, status: "sending" });

    const done = await settled(res.body.id);
    expect(done).toMatchObject({ status: "sent", delivered: CROWD, reach: CROWD });
    expect(await notifications().countDocuments({ dedupeKey: { $regex: `^broadcast:${res.body.id}:` } })).toBe(CROWD);
    // Suspended and deactivated neighbours are left out.
    expect(await notifications().countDocuments({ uid: { $in: ["gone", "susp"] } })).toBe(0);

    const inbox = (await t.http.get("/api/notifications").set(t.auth("n00042")).expect(200)).body as { title: string; type: string }[];
    expect(inbox.filter((n) => n.title === "Water outage")).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ type: "system" });
  });

  it("running delivery again (a restart mid-send) notifies nobody twice", async () => {
    const [latest] = await list();
    await t.app.get(BroadcastsService).deliver(latest!.id);
    await t.model("Broadcast").updateOne({ _id: latest!.id }, { $set: { status: "sending" } });
    await t.app.get(BroadcastsService).deliver(latest!.id);
    expect(await notifications().countDocuments({ dedupeKey: { $regex: `^broadcast:${latest!.id}:` } })).toBe(CROWD);
    expect((await settled(latest!.id)).delivered).toBe(CROWD);
  });

  it("refuses the same message to the same audience again within minutes (double click): 409", async () => {
    const body = { title: "Estate AGM", body: "Saturday 10am at the hall.", audience: { type: "user", uids: ["ada"] } };
    const first = await send("boss", body).expect(201);
    await send("boss", body).expect(409);
    await settled(first.body.id);
    expect(await notifications().countDocuments({ uid: "ada", dedupeKey: { $regex: "^broadcast:" } })).toBe(1);
    // A different message, or the same one from someone else, is a new broadcast.
    await send("boss", { ...body, title: "Estate AGM moved" }).expect(201);
    await send("boss2", body).expect(201);
  });

  it("is staff only, 'Everyone' is admin only, and input is validated", async () => {
    const ok = { title: "Hello all", body: "A short note for everyone.", audience: { type: "all" } };
    await send("ada", ok).expect(403);
    await send("mod1", ok).expect(403);
    await t.http.post("/api/admin/broadcasts").send(ok).expect(401);
    await send("boss", { ...ok, title: "Hi" }).expect(400);
    await send("boss", { ...ok, body: "short" }).expect(400);
    await send("boss", { ...ok, audience: { type: "hood", hoodIds: [] } }).expect(400);
    await send("boss", { ...ok, extra: true }).expect(400);
  });

  it("a failure part-way is recorded, not lost; retry finishes it without duplicates", async () => {
    const bulk = jest.spyOn(t.app.get(NotificationsService), "notifyBulk");
    let calls = 0;
    const real = bulk.getMockImplementation();
    bulk.mockImplementation(async function (this: NotificationsService, input) {
      if (++calls === 2) throw new Error("database blip");
      return (real ?? NotificationsService.prototype.notifyBulk).call(this, input);
    });
    const quiet = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await send("boss", { title: "Security patrol", body: "New night patrol starts on Friday.", audience: { type: "hood", hoodIds: [yaba] } }).expect(201);
    const failed = await settled(res.body.id);
    expect(failed).toMatchObject({ status: "failed", delivered: 1_000 });
    bulk.mockRestore();
    quiet.mockRestore();

    await t.http.post(`/api/admin/broadcasts/${res.body.id}/retry`).set(t.auth("ada")).expect(403);
    await t.http.post(`/api/admin/broadcasts/${res.body.id}/retry`).set(t.auth("boss")).expect(201);
    expect(await settled(res.body.id)).toMatchObject({ status: "sent", delivered: CROWD });
    expect(await notifications().countDocuments({ dedupeKey: { $regex: `^broadcast:${res.body.id}:` } })).toBe(CROWD);
    await t.http.post(`/api/admin/broadcasts/${res.body.id}/retry`).set(t.auth("boss")).expect(409);
    await t.http.post("/api/admin/broadcasts/000000000000000000000000/retry").set(t.auth("boss")).expect(404);
  });

  it("picks up a broadcast a restart left unfinished", async () => {
    const stalled = await t.model("Broadcast").create({ title: "Stalled", body: "Interrupted by a deploy.", audience: { type: "user", uids: ["ada"] }, audienceLabel: "ada", reach: 1, sentBy: "boss", sentByUid: "boss", status: "sending", delivered: 0 });
    // sentAt is the creation timestamp (immutable through Mongoose): backdate it on the collection.
    await t.model("Broadcast").collection.updateOne({ _id: stalled._id }, { $set: { sentAt: new Date(Date.now() - 10 * 60_000) } });
    expect(await t.app.get(BroadcastsService).resumeStalled()).toBe(1);
    expect(await settled(String(stalled._id))).toMatchObject({ status: "sent", delivered: 1 });
  });
});
