import { createTestApp, type TestApp } from "./helpers/app";
import { AuditService } from "../src/audit/audit.service";
import { AppVersionWatcherService } from "../src/platform/app-version-watcher.service";
import type { StoreCheck, StoreVersionSource } from "../src/platform/store-versions";
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
    // A second admin, so the app-updates test has its own write allowance (writes are rate limited per person).
    await t.member("rel", hood, { role: "admin" });
    await t.member("auto", hood, { role: "admin" });
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
    expect(settings.coverageCities).toEqual([{ state: "Lagos", city: "Lagos", hoods: 1 }]);
    // The web form PATCHes the whole object back, labels and coverage included.
    const saved = await t.http.patch("/api/admin/settings").set(t.auth("boss")).send(settings).expect(200);
    expectShape(saved.body, "PlatformSettings");
  });

  it("analytics re-ask interval: 180 days by default, set by admins, read by the app", async () => {
    expect((await get("/settings")).analyticsReaskDays).toBe(180);
    const config = () => t.http.get("/api/app-config").set(t.auth("ada")).expect(200);
    expect((await config()).body.analytics).toEqual({ reaskDays: 180 });
    await t.http.patch("/api/admin/settings").set(t.auth("boss")).send({ analyticsReaskDays: 90 }).expect(200);
    expect((await config()).body.analytics).toEqual({ reaskDays: 90 });
    await t.http.patch("/api/admin/settings").set(t.auth("boss")).send({ analyticsReaskDays: 1000 }).expect(400);
    await t.http.patch("/api/admin/settings").set(t.auth("ada")).send({ analyticsReaskDays: 0 }).expect(403);
  });

  it("myHoodora AI link: the studio by default, switched by admins, readable signed out", async () => {
    const studio = "https://studio.myhoodora.com/";
    expect((await get("/settings")).hoodoraAi).toEqual({ target: "studio", studioUrl: studio });
    const links = async () => (await t.http.get("/api/app-config").expect(200)).body.links;
    expect(await links()).toEqual({ hoodoraAiStudio: studio });
    await t.http.patch("/api/admin/settings").set(t.auth("boss")).send({ hoodoraAi: { target: "page", studioUrl: studio } }).expect(200);
    expect(await links()).toEqual({ hoodoraAiStudio: null });
    // The address is kept while the page is chosen, so switching back is one click.
    expect((await get("/settings")).hoodoraAi).toEqual({ target: "page", studioUrl: studio });
    await t.http.patch("/api/admin/settings").set(t.auth("boss")).send({ hoodoraAi: { target: "studio", studioUrl: "http://studio.myhoodora.com/" } }).expect(400);
    await t.http.patch("/api/admin/settings").set(t.auth("boss")).send({ hoodoraAi: { target: "elsewhere", studioUrl: studio } }).expect(400);
    await t.http.patch("/api/admin/settings").set(t.auth("ada")).send({ hoodoraAi: { target: "studio", studioUrl: studio } }).expect(403);
    await t.http.patch("/api/admin/settings").set(t.auth("boss")).send({ hoodoraAi: { target: "studio", studioUrl: studio } }).expect(200);
    expect(await links()).toEqual({ hoodoraAiStudio: studio });
  });

  it("app updates: 1.0.0 with the Play page by default, set by admins, readable signed out", async () => {
    const play = "https://play.google.com/store/apps/details?id=com.myhoodora.app";
    const updates = async () => (await t.http.get("/api/app-config").expect(200)).body.updates;
    expect(await updates()).toEqual({ android: { latest: "1.0.0", minimum: "1.0.0", storeUrl: play }, ios: { latest: "1.0.0", minimum: "1.0.0", storeUrl: null } });
    const next = { android: { latest: "1.1.0", minimum: "1.0.0", storeUrl: play }, ios: { latest: "1.1.0", minimum: "1.1.0", storeUrl: "https://apps.apple.com/app/id123" } };
    await t.http.patch("/api/admin/settings").set(t.auth("rel")).send({ appUpdates: next }).expect(200);
    expect((await get("/settings")).appUpdates).toMatchObject(next);
    expect(await updates()).toEqual(next);
    const bad = (android: object) => t.http.patch("/api/admin/settings").set(t.auth("rel")).send({ appUpdates: { ...next, android: { ...next.android, ...android } } }).expect(400);
    await bad({ latest: "1.1" });
    await bad({ minimum: "1.2.0" }); // newer than latest
    await bad({ storeUrl: "http://play.google.com/" });
    await t.http.patch("/api/admin/settings").set(t.auth("ada")).send({ appUpdates: next }).expect(403);
    await t.http.patch("/api/admin/settings").set(t.auth("rel")).send({ appUpdates: { ...next, ios: { ...next.ios, storeUrl: "" } } }).expect(200);
    expect((await updates()).ios.storeUrl).toBeNull();
  });

  it("app updates follow the stores: Latest from the store, Minimum after the admin's days, never above the store", async () => {
    const watcher = t.app.get(AppVersionWatcherService);
    const store: Record<"android" | "ios", StoreCheck> = { android: { version: "1.2.0", url: null, problem: null }, ios: { version: null, url: null, problem: null } };
    (watcher as unknown as { sources: StoreVersionSource[] }).sources.splice(0, Infinity, { platform: "android", check: async () => store.android }, { platform: "ios", check: async () => store.ios });
    const settings = async () => (await t.http.get("/api/admin/settings").set(t.auth("auto")).expect(200)).body;

    expect((await settings()).appUpdatesAuto).toEqual({ fromStores: true, requireAfterDays: 30 });
    const checked = (await t.http.post("/api/admin/settings/app-updates/check").set(t.auth("auto")).expect(201)).body;
    expect(checked.appUpdates.android).toMatchObject({ latest: "1.2.0", minimum: "1.0.0" });
    expect(checked.appStoreStatus.android).toMatchObject({ version: "1.2.0", problem: null });
    expect(checked.appStoreStatus.ios).toMatchObject({ version: null, problem: null });
    expect((await t.app.get(AuditService).recent(5)).map((e) => e.target.label)).toContain("App updates: Android latest 1.1.0 → 1.2.0");

    // 31 days on, Minimum follows; the store failing meanwhile changes nothing and is reported.
    store.ios = { version: null, url: null, problem: "Apple's lookup answered 503" };
    await watcher.check(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000));
    const later = await settings();
    expect(later.appUpdates.android.minimum).toBe("1.2.0");
    expect(later.appUpdates.ios).toMatchObject({ latest: "1.1.0", minimum: "1.1.0" });
    expect(later.appStoreStatus.ios.problem).toBe("Apple's lookup answered 503");
    expect((await t.http.get("/api/app-config").expect(200)).body.updates.android).toMatchObject({ latest: "1.2.0", minimum: "1.2.0" });

    // The whole settings object goes back as the admin page sends it; the timer is admin-set, 0 to 365.
    await t.http.patch("/api/admin/settings").set(t.auth("auto")).send({ ...later, appUpdatesAuto: { fromStores: false, requireAfterDays: 0 } }).expect(200);
    expect((await settings()).appUpdatesAuto).toEqual({ fromStores: false, requireAfterDays: 0 });
    await t.http.patch("/api/admin/settings").set(t.auth("auto")).send({ appUpdatesAuto: { fromStores: true, requireAfterDays: 400 } }).expect(400);
    await t.http.post("/api/admin/settings/app-updates/check").set(t.auth("ada")).expect(403);
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
    const near = (await get("/hoods/near?lat=6.4478&lng=3.4746")) as Record<string, unknown>[];
    expect(near.length).toBeGreaterThan(0);
    near.forEach((row) => expectShape(row, "HoodFootprint"));
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
