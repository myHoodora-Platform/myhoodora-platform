import { createTestApp, type TestApp } from "./helpers/app";
import { missingKeys, requiredKeys } from "./helpers/web-contract";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * Every admin endpoint the web flipped to "live" answers 200 with the shape
 * apps/web/src/lib/api/admin/types.ts expects (required top-level keys).
 */
describe("admin API ↔ web contract (§13)", () => {
  let t: TestApp;
  let hood: string;
  let postId: string;
  let reportId: string;
  let businessId: string;
  let threadId: string;
  const web = requiredKeys("admin/types.ts", "admin/content.ts");

  beforeAll(async () => {
    t = await createTestApp();
    hood = await t.hood();
    await t.member("ada", hood);
    await t.member("bola", hood);
    await t.user("pending", { verificationStatus: "pending_review", verificationAttempts: [{ at: new Date(), lat: 6.45, lng: 3.47, result: "outside_coverage" }] } as never);
    await t.member("boss", hood, { role: "owner" });
    postId = (await t.post("ada", { message: "Generator for sale, barely used" }))._id;
    await t.post("ada", { message: "Power out on Admiralty Way", category: "alert", alertCategory: "power" });
    await t.http.post("/api/reports").set(t.auth("bola")).send({ targetType: "post", targetId: postId, reason: "spam" }).expect(204);
    const list = await t.http.get("/api/admin/reports").set(t.auth("boss")).expect(200);
    reportId = list.body.items[0].id;
    await t.http.post(`/api/admin/neighbours/ada/actions`).set(t.auth("boss")).send({ action: "warn", reason: "Be kind" }).expect(201);
    // Pass-2 data
    await t.http.post("/api/listings").set(t.auth("ada")).send({ title: "Standing fan", priceNaira: 20000, category: "home_appliances", condition: "good", photos: [] }).expect(201);
    await t.http.post("/api/groups").set(t.auth("ada")).send({ name: "Road 12 Parents", description: "School runs and playdates.", category: "parents", privacy: "open", boundary: "neighbourhood" }).expect(201);
    businessId = (
      await t.http
        .post("/api/business-pages/applications")
        .send({ businessName: "Fix It Fast", category: "home_services", description: "Plumbing and electrical repairs around Lekki.", areasServed: ["Lekki Phase 1"], contactName: "Obi", phone: "+2348031234567", email: "obi@fix.test", wantsAdsUpdates: false })
        .expect(201)
    ).body.id;
    threadId = (await t.http.post("/api/contact").send({ topic: "press", name: "Reporter", email: "press@news.test", message: "Interview request about myHoodora's launch in Lagos." }).expect(201)).body.id;
    await t.http.post("/api/ai/pilot-requests").send({ name: "Dr Bisi", email: "bisi@unilag.test", institution: "UNILAG", institutionType: "university" }).expect(201);
  });
  afterAll(() => t.close());

  const get = async (path: string) => {
    const res = await t.http.get(`/api/admin${path}`).set(t.auth("boss"));
    if (res.status !== 200) throw new Error(`${path} → ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
  };
  const expectShape = (obj: Record<string, unknown>, type: string) => expect({ type, missing: missingKeys(obj, web(type)) }).toEqual({ type, missing: [] });
  const expectPage = (body: { items: Record<string, unknown>[] }, type: string) => {
    expectShape(body as never, "Page");
    expect(body.items.length).toBeGreaterThan(0);
    body.items.forEach((row) => expectShape(row, type));
  };

  it("session and overview", async () => {
    const me = await get("/me");
    expectShape(me, "AdminSession");
    expect(me.can).toContain("team.manage.admins");
    expectShape(await get("/overview"), "AdminOverview");
    expectShape(await get("/insights"), "Insights");
    const settings = await get("/settings");
    expectShape(settings, "PlatformSettings");
    expect(settings.coverageCities).toEqual([{ city: "Lagos", hoods: 1 }]);
    // The web form PATCHes the whole object back, labels and coverage included.
    const saved = await t.http.patch("/api/admin/settings").set(t.auth("boss")).send(settings).expect(200);
    expectShape(saved.body, "PlatformSettings");
  });

  it("moderation", async () => {
    expectPage(await get("/reports"), "AdminReport");
    expectShape(await get(`/reports/${reportId}`), "ReportDetail");
    expectPage(await get("/audit"), "AuditEvent");
  });

  it("community", async () => {
    expectPage(await get("/neighbours"), "AdminNeighbour");
    expectShape(await get("/neighbours/ada"), "NeighbourDetail");
    expectPage(await get("/hoods"), "AdminHood");
    expectShape(await get(`/hoods/${hood}`), "HoodDetail");
    const verification = await get("/verification");
    expect(verification.items.length).toBe(1);
  });

  it("content", async () => {
    expectPage(await get("/posts"), "AdminPost");
    expectShape(await get(`/posts/${postId}`), "PostDetail");
    expectPage(await get("/alerts"), "AdminAlert");
  });

  it("marketplace and groups", async () => {
    expectPage(await get("/listings"), "AdminListing");
    expectPage(await get("/groups"), "AdminGroup");
  });

  it("businesses, inbox and sign-ups", async () => {
    expectPage(await get("/businesses?tab=applications"), "AdminBusiness");
    expectShape(await get(`/businesses/${businessId}`), "BusinessDetail");
    expectPage(await get("/inbox"), "InboxThread");
    expectShape(await get(`/inbox/${threadId}`), "InboxThread");
    const pilots = (await get("/signups?type=ai_pilot")) as Record<string, unknown>[];
    expect(pilots.length).toBe(1);
    pilots.forEach((p) => expectShape(p, "SignupEntry"));
  });

  it("team and broadcasts", async () => {
    const team = await get("/team");
    expect(Array.isArray(team)).toBe(true);
    await t.http.post("/api/admin/broadcasts").set(t.auth("boss")).send({ title: "Estate AGM", body: "Saturday 10am at the hall.", audience: { type: "all" } }).expect((r) => expect([200, 201]).toContain(r.status));
    const sent = (await get("/broadcasts")) as Record<string, unknown>[];
    expect(sent.length).toBe(1);
    sent.forEach((b) => expectShape(b, "Broadcast"));
  });
});
