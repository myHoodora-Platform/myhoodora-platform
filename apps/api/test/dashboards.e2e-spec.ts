import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Admin → Insights: activation per Hood and the launch challenge (plan WP-F, contract §46). */
describe("Activation and challenge dashboards", () => {
  let t: TestApp;
  let ready: string;
  let growing: string;
  let empty: string;
  const v = { emailVerified: true };

  beforeAll(async () => {
    t = await createTestApp();
    ready = await t.hood("Lekki Phase 1", 3.4746, 6.4478, 1500);
    growing = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    empty = await t.hood("Ikoyi", 3.43, 6.45, 1500);
    await t.member("mod1", ready, { role: "moderator" });
    await t.member("admin1", ready, { role: "admin" });
    await t.users.insertMany(Array.from({ length: 120 }, (_, i) => ({ uid: `n${i}`, email: `n${i}@t.dev`, displayName: `N ${i}`, neighborhoodId: i < 100 ? ready : growing, verificationStatus: "verified", ageConfirmedAt: new Date(), emailVerifiedAt: new Date(), ...(i % 4 === 0 && { invitedBy: { uid: "n1", code: "NNN22", via: "link", at: new Date() } }) })));
    for (let i = 0; i < 16; i++) await t.post(`n${i}`, { message: `Lekki ${i}` });
    for (let i = 100; i < 106; i++) await t.post(`n${i}`, { message: `Yaba ${i}` });
    await t.users.db.collection("hood_roles").insertOne({ hoodId: ready, uid: "n2", role: "lead", appointedBy: "admin1", createdAt: new Date() });
    await t.users.db.collection("posts").insertOne({ authorUid: "myhoodora-hood-team", neighborhoodId: ready, source: "team", message: "Welcome!", content: "Welcome!", category: "general", type: "general", isActive: true, removedAt: null, createdAt: new Date(), pinnedUntil: new Date(Date.now() + 86_400_000) });
    await t.http.put("/api/admin/console/assignments/mod1").set(t.auth("admin1", v)).send({ hoodIds: [ready] }).expect(200);
  });
  afterAll(() => t.close());

  it("lights each Hood against the checklist, reddest first", async () => {
    const a = (await t.http.get("/api/admin/dashboards/activation").set(t.auth("mod1", v)).expect(200)).body;
    const by = (id: string) => a.rows.find((r: { hood: { id: string } }) => r.hood.id === id);
    expect(by(ready)).toMatchObject({ light: "green", missing: [], leads: 1, welcome: true, moderator: true, teamItems: 1 });
    expect(by(growing)).toMatchObject({ light: "amber", neighbours: 20 });
    expect(by(growing).missing).toEqual(expect.arrayContaining(["a Hood Lead", "a moderator"]));
    expect(by(empty)).toMatchObject({ light: "red", neighbours: 0 });
    expect(a.rows[0].hood.id).toBe(empty);
    expect(a.counts).toEqual({ red: 1, amber: 1, green: 1 });
  });

  it("shows the challenge: weekly sign-ups from invites, the funnel, Builders and advice", async () => {
    for (const event of ["shared_view", "shared_view", "shared_join_tap", "banner_open"]) await t.http.post("/api/public/funnel").send({ event }).expect(204);
    const c = (await t.http.get("/api/admin/dashboards/challenge").set(t.auth("mod1", v)).expect(200)).body;
    const thisWeek = c.weekly[c.weekly.length - 1];
    expect(thisWeek).toMatchObject({ invited: 30, invitedVerified: 30 });
    expect(c.funnel).toMatchObject({ shared_view: 2, shared_join_tap: 1, banner_open: 1 });
    expect(c.hoods).toEqual({ red: 1, amber: 1, green: 1 });
    expect(["keep_going", "push_harder", "consider_ending"]).toContain(c.advice);
    expect(c.why).toEqual(expect.any(String));
    await t.http.get("/api/admin/dashboards/challenge").set(t.auth("n5", v)).expect(403);
  });
});
