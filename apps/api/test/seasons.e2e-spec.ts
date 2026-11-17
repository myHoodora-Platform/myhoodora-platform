import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Festive seasons (plan WP-D, contract §41): admins set them, every app reads the current one from /app-config. */
describe("Festive seasons", () => {
  let t: TestApp;
  const admin = () => t.auth("admin1", { emailVerified: true });
  const hour = 3_600_000;

  beforeAll(async () => {
    t = await createTestApp();
    const hood = await t.hood();
    await t.member("admin1", hood, { role: "admin" });
    await t.member("mod1", hood, { role: "moderator" });
    await t.member("ada", hood);
  });
  afterAll(() => t.close());

  it("starts each year with Christmas and New Year, in Lagos time; only admins manage them", async () => {
    const list = (await t.http.get("/api/admin/seasons").set(admin()).expect(200)).body as { key: string; startsAt: string; countdownTo: string | null }[];
    const year = new Date().getUTCFullYear();
    expect(list.find((s) => s.key === `christmas-${year}`)?.startsAt).toBe(`${year}-12-14T23:00:00.000Z`);
    expect(list.find((s) => s.key === `new-year-${year + 1}`)?.countdownTo).toBe(`${year}-12-31T23:00:00.000Z`);
    await t.http.get("/api/admin/seasons").set(t.auth("mod1", { emailVerified: true })).expect(403);
    await t.http.post("/api/admin/seasons").set(t.auth("ada", { emailVerified: true })).send({}).expect(403);
  });

  it("the apps get the season on now (and nothing for staff only); switching it off takes it away", async () => {
    const now = Date.now();
    const created = (
      await t.http
        .post("/api/admin/seasons")
        .set(admin())
        .send({ key: "test-party", label: "Test party", startsAt: new Date(now - hour).toISOString(), endsAt: new Date(now + hour).toISOString(), effect: "sparkle", mascot: "party_hat", accent: "gold", greetingTitle: "Hello!", greetingBody: "Have fun" })
        .expect(201)
    ).body as { _id: string; live: boolean };
    expect(created.live).toBe(true);
    const config = (await t.http.get("/api/app-config").expect(200)).body;
    expect(config.season).toEqual({ key: "test-party", startsAt: expect.any(String), endsAt: expect.any(String), effect: "sparkle", intensity: "normal", mascot: "party_hat", accent: "gold", greeting: { title: "Hello!", body: "Have fun" }, image: null, countdownTo: null });

    await t.http.patch(`/api/admin/seasons/${created._id}`).set(admin()).send({ enabled: false }).expect(200);
    expect((await t.http.get("/api/app-config").expect(200)).body.season).toBeNull();
    const audit = await t.model("AuditEvent").find({ action: { $in: ["season_create", "season_update"] } }).lean();
    expect(audit).toHaveLength(2);
    await t.http.delete(`/api/admin/seasons/${created._id}`).set(admin()).expect(204);
  });

  it("refuses backwards dates, pasted images, a countdown outside the season, and a duplicate key", async () => {
    const now = Date.now();
    const base = { label: "Bad", startsAt: new Date(now + 2 * hour).toISOString(), endsAt: new Date(now + 4 * hour).toISOString() };
    await t.http.post("/api/admin/seasons").set(admin()).send({ ...base, key: "bad-dates", endsAt: new Date(now).toISOString() }).expect(400);
    await t.http.post("/api/admin/seasons").set(admin()).send({ ...base, key: "bad-image", imageUrl: "https://example.com/santa.gif" }).expect(400);
    await t.http.post("/api/admin/seasons").set(admin()).send({ ...base, key: "bad-count", countdownTo: new Date(now + 10 * hour).toISOString() }).expect(400);
    const year = new Date().getUTCFullYear();
    await t.http.post("/api/admin/seasons").set(admin()).send({ ...base, key: `christmas-${year}` }).expect(409);
  });

  it("tells the apps a day ahead, so they switch on at the minute", async () => {
    const now = Date.now();
    await t.http.post("/api/admin/seasons").set(admin()).send({ key: "tomorrow", label: "Tomorrow", startsAt: new Date(now + 3 * hour).toISOString(), endsAt: new Date(now + 30 * hour).toISOString() }).expect(201);
    expect((await t.http.get("/api/app-config").expect(200)).body.season.key).toBe("tomorrow");
  });
});
