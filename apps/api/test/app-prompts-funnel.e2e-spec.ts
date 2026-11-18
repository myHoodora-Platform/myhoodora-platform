import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** "Get the app" prompts (admin-set, in /app-config) and the anonymous funnel counts (contract §43). */
describe("App prompts and the funnel", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
    const hood = await t.hood();
    await t.member("admin1", hood, { role: "admin" });
    await t.member("mod1", hood, { role: "moderator" });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("the apps read the prompt switches; admins change them", async () => {
    expect((await t.http.get("/api/app-config").expect(200)).body.appPrompts).toEqual({ banner: true, sheet: true, sheetEveryDays: 7 });
    await t.http.patch("/api/admin/settings").set(t.auth("admin1", { emailVerified: true })).send({ appPrompts: { banner: false, sheet: true, sheetEveryDays: 14 } }).expect(200);
    expect((await t.http.get("/api/app-config").expect(200)).body.appPrompts).toEqual({ banner: false, sheet: true, sheetEveryDays: 14 });
    await t.http.patch("/api/admin/settings").set(t.auth("admin1", { emailVerified: true })).send({ appPrompts: { banner: true, sheet: true, sheetEveryDays: 0 } }).expect(400);
  });

  it("counts named steps anonymously, many at once; refuses unknown names; staff read the totals", async () => {
    for (let i = 0; i < 120; i++) {
      await t.http.post("/api/public/funnel").send({ event: i % 3 ? "shared_view" : "banner_open" }).expect(204);
      if (i % 8 === 7) t.resetThrottle();
    }
    await t.http.post("/api/public/funnel").send({ event: "steal_cookies" }).expect(400);
    const stats = (await t.http.get("/api/admin/funnel").set(t.auth("mod1", { emailVerified: true })).expect(200)).body;
    expect(stats.totals).toMatchObject({ shared_view: 80, banner_open: 40, sheet_shown: 0 });
    expect(stats.days).toHaveLength(1);
    const stored = await t.users.db.collection("funnel_counts").find().toArray();
    expect(Object.keys(stored[0]!).filter((k) => k !== "__v").sort()).toEqual(["_id", "day", "event", "n"]);
  });
});
