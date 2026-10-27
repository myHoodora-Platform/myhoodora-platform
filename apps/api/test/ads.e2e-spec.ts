import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

type Item = { type: "post"; data: { _id: string } } | { type: "ad"; slotId: string; data: Record<string, unknown> & { _id: string; advertiser: { name: string }; why: string } };
interface Page { items: Item[]; nextCursor: string | null }

const IMG = "https://res.cloudinary.com/test/image/upload/ad-wide.jpg";
const SMALL = "https://res.cloudinary.com/test/image/upload/ad-small.jpg";
const LOGO = "https://res.cloudinary.com/test/image/upload/logo.png";
const VIDEO = "https://res.cloudinary.com/test/video/upload/ad.mp4";

describe("Sponsored items: admin, placement, targeting, caps, events", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  let abuja: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    yaba = await t.hood("Yaba", 3.3792, 6.5095);
    abuja = await t.hood("Wuse", 7.4613, 9.0765);
    await t.hoods.updateOne({ _id: abuja }, { $set: { city: "Abuja" } });
    await t.member("boss", lekki, { role: "admin" });
    await t.member("mod", lekki, { role: "moderator" });
    for (const uid of ["ada", "bola", "chidi"]) await t.member(uid, lekki);
    await t.member("emeka", abuja);

    // Files we stored (what an upload would have recorded).
    await t.model("MediaAsset").insertMany([
      { ownerUid: "boss", provider: "cloudinary", providerId: "ad-wide", resourceType: "image", purpose: "ad", url: IMG, width: 1080, height: 1080, bytes: 1000 },
      { ownerUid: "boss", provider: "cloudinary", providerId: "ad-small", resourceType: "image", purpose: "ad", url: SMALL, width: 300, height: 300, bytes: 1000 },
      { ownerUid: "boss", provider: "cloudinary", providerId: "logo", resourceType: "image", purpose: "ad", url: LOGO, width: 200, height: 200, bytes: 1000 },
      { ownerUid: "boss", provider: "cloudinary", providerId: "ad-video", resourceType: "video", purpose: "ad", url: VIDEO, width: 1080, height: 1920, bytes: 1000 },
    ]);
    // 30 posts in Lekki, newest last, and a few in Wuse.
    const now = Date.now();
    const post = (hood: string, i: number) => ({ authorUid: ["ada", "bola", "chidi"][i % 3], neighborhoodId: hood, type: "text", category: "general", content: `Post ${i}`, message: `Post ${i}`, createdAt: new Date(now - (100 - i) * 60_000) });
    await t.model("FeedPost").insertMany([...Array.from({ length: 30 }, (_, i) => post(lekki, i)), ...Array.from({ length: 12 }, (_, i) => ({ ...post(abuja, i), authorUid: "emeka" }))]);
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const admin = () => t.auth("boss");
  const create = (body: Record<string, unknown>) => t.http.post("/api/admin/ads").set(admin()).send(body);
  const status = (id: string, s: string) => t.http.put(`/api/admin/ads/${id}/status`).set(admin()).send({ status: s });
  const feed = async (uid: string, hood: string, query: string) => (await t.http.get(`/api/feed/hood/${hood}?${query}`).set(t.auth(uid)).expect(200)).body as Page;
  const ads = (p: Page) => p.items.filter((i) => i.type === "ad") as Extract<Item, { type: "ad" }>[];
  const shape = (p: Page) => p.items.map((i) => (i.type === "ad" ? "A" : "P")).join("");
  const imageAd = { title: "Mama Put promo", advertiserName: "Mama Put Kitchen", format: "image", primaryText: "Jollof Fridays, 20% off for neighbours.", headline: "Lunch on Road 4", ctaType: "shop", ctaUrl: "https://mamaput.example/menu", media: [{ url: IMG, kind: "image" }] };
  /** Pause every live ad, so a test sees only its own. */
  const pauseAll = async () => {
    const live = (await t.http.get("/api/admin/ads?status=active").set(admin()).expect(200)).body as { _id: string }[];
    for (const a of live) await status(a._id, "paused").expect(200);
  };

  describe("who may manage ads", () => {
    it.each(["ada", "mod"])("%s can't list, create, change settings or upload ad media (403)", async (uid) => {
      await t.http.get("/api/admin/ads").set(t.auth(uid)).expect(403);
      await t.http.post("/api/admin/ads").set(t.auth(uid)).send(imageAd).expect(403);
      await t.http.patch("/api/admin/ads/settings").set(t.auth(uid)).send({ firstAfter: 1 }).expect(403);
      await t.http.post("/api/media/direct").set(t.auth(uid)).send({ purpose: "ad", mimetype: "image/jpeg", size: 1000 }).expect(403);
    });

    it("an admin can", async () => {
      await t.http.get("/api/admin/ads").set(admin()).expect(200);
    });
  });

  describe("creating and going live", () => {
    it("only our own uploads, wide enough", async () => {
      await create({ ...imageAd, media: [{ url: "https://elsewhere.example/a.jpg", kind: "image" }] }).expect(400);
      expect((await create({ ...imageAd, media: [{ url: SMALL, kind: "image" }] }).expect(400)).body.message).toMatch(/600px/);
      expect((await create({ ...imageAd, media: [{ url: VIDEO, kind: "image" }] }).expect(400)).body.message).toMatch(/a video/);
    });

    it("starts as a draft; going live checks it's complete; every step is audited", async () => {
      const draft = (await create({ title: "Gym", advertiserName: "Iron Gym", format: "image", media: [{ url: IMG, kind: "image" }] }).expect(201)).body as { _id: string; status: string };
      expect(draft.status).toBe("draft");
      expect((await status(draft._id, "active").expect(400)).body.message).toMatch(/text.*button|button.*text/s);
      // A draft may be unfinished; going live is when it must be complete.
      await t.http.patch(`/api/admin/ads/${draft._id}`).set(admin()).send({ primaryText: "First week free.", ctaType: "call" }).expect(200);
      expect((await status(draft._id, "active").expect(400)).body.message).toMatch(/phone number/);
      await t.http.patch(`/api/admin/ads/${draft._id}`).set(admin()).send({ primaryText: "First week free.", ctaType: "call", ctaPhone: "+2348012345678" }).expect(200);
      expect((await status(draft._id, "active").expect(200)).body.effectiveStatus).toBe("active");
      const audit = await t.model<{ action: string; target: { id: string } }>("AuditEvent").find({ "target.id": draft._id }).lean();
      expect(audit.map((a) => a.action).sort()).toEqual(["ad_activate", "ad_create", "ad_update", "ad_update"]);
      await status(draft._id, "paused").expect(200);
    });

    it("checks each format's needs", async () => {
      const make = async (body: Record<string, unknown>) => (await create({ title: "x", advertiserName: "Shop", ...body }).expect(201)).body._id as string;
      expect((await status(await make({ format: "video", primaryText: "Watch", ctaType: "learn_more", ctaUrl: "https://a.example", media: [{ url: VIDEO, kind: "video" }] }), "active").expect(400)).body.message).toMatch(/poster/);
      expect((await status(await make({ format: "carousel", cards: [{ imageUrl: IMG, headline: "One", url: "https://a.example/1" }] }), "active").expect(400)).body.message).toMatch(/2 to 10/);
      expect((await status(await make({ format: "business", primaryText: "Fresh bread", ctaType: "directions", ctaUrl: "https://maps.example", media: [{ url: IMG, kind: "image" }] }), "active").expect(400)).body.message).toMatch(/logo/);
      await status(await make({ format: "announcement", primaryText: "Estate clean-up on Saturday", background: "green" }), "active").expect(200);
      await create({ title: "x", advertiserName: "Shop", format: "image", startsAt: "2026-12-02T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" }).expect(400);
      await pauseAll();
    });
  });

  describe("the feed", () => {
    let a1: string;
    let a2: string;

    beforeAll(async () => {
      a1 = (await create(imageAd).expect(201)).body._id;
      a2 = (await create({ ...imageAd, title: "Video", advertiserName: "Lekki Fitness", format: "video", media: [{ url: VIDEO, kind: "video", posterUrl: IMG }], ctaType: "sign_up", ctaUrl: "https://fit.example" }).expect(201)).body._id;
    });

    beforeEach(async () => {
      await pauseAll();
      await status(a1, "active").expect(200);
      await status(a2, "active").expect(200);
    });

    it("places the first ad after the third post, then every 6–8, never two together, and pages continue", async () => {
      const p1 = await feed("ada", lekki, "session=sessionAAA&limit=10");
      expect(shape(p1).startsWith("PPPA")).toBe(true);
      const p2 = await feed("ada", lekki, `session=sessionAAA&limit=10&cursor=${p1.nextCursor}`);
      const p3 = await feed("ada", lekki, `session=sessionAAA&limit=10&cursor=${p2.nextCursor}`);
      const all = shape(p1) + shape(p2) + shape(p3);
      expect(all).not.toContain("AA");
      for (const gap of all.split("A").slice(1, -1)) expect(gap.length).toBeGreaterThanOrEqual(6);
      // Every post once, in order, as the plain feed has them.
      const ids = [p1, p2, p3].flatMap((p) => p.items.filter((i) => i.type === "post").map((i) => i.data._id));
      expect(new Set(ids).size).toBe(30);
      // Slots are unique across pages.
      const slots = [p1, p2, p3].flatMap(ads).map((a) => a.slotId);
      expect(new Set(slots).size).toBe(slots.length);
      // The same page again: the same ads in the same places.
      expect(await feed("ada", lekki, "session=sessionAAA&limit=10")).toEqual(p1);
    });

    it("an ad says who it's from and why, and never its targeting, stats or staff title", async () => {
      const ad = ads(await feed("ada", lekki, "session=sessionBBB&limit=10"))[0]!;
      expect(ad.data.advertiser.name).toBeTruthy();
      expect(ad.data.why).toMatch(/You're seeing this because/);
      for (const key of ["title", "hoodIds", "cities", "priority", "dailyCapPerUser", "status", "createdBy", "stats"]) expect(ad.data).not.toHaveProperty(key);
    });

    it("older apps: the plain feed is unchanged, with no ads", async () => {
      const posts = (await t.http.get(`/api/posts/neighborhood/${lekki}?limit=10`).set(t.auth("ada")).expect(200)).body as { _id: string }[];
      expect(Array.isArray(posts)).toBe(true);
      expect(posts).toHaveLength(10);
    });

    it("no ads in a filtered feed, or when ads are turned off", async () => {
      expect(shape(await feed("ada", lekki, "session=sessionCCC&limit=10&category=general"))).not.toContain("A");
      await t.http.patch("/api/admin/ads/settings").set(admin()).send({ enabled: false }).expect(200);
      expect(shape(await feed("ada", lekki, "session=sessionCCC&limit=10"))).not.toContain("A");
      await t.http.patch("/api/admin/ads/settings").set(admin()).send({ enabled: true }).expect(200);
    });

    it("the placement rules are admin settings", async () => {
      await t.http.patch("/api/admin/ads/settings").set(admin()).send({ minGap: 9, maxGap: 8 }).expect(400);
      await t.http.patch("/api/admin/ads/settings").set(admin()).send({ firstAfter: 5 }).expect(200);
      expect(shape(await feed("ada", lekki, "session=sessionDDD&limit=10")).startsWith("PPPPPA")).toBe(true);
      await t.http.patch("/api/admin/ads/settings").set(admin()).send({ firstAfter: 3 }).expect(200);
    });

    it("a page link that was tampered with is refused, not trusted", async () => {
      await t.http.get(`/api/feed/hood/${lekki}?session=sessionEEE&cursor=bm90LWpzb24`).set(t.auth("ada")).expect(400);
      await t.http.get(`/api/feed/hood/${lekki}?session=bad`).set(t.auth("ada")).expect(400);
    });

    it("targeting: a neighbourhood, a city, or everywhere", async () => {
      await pauseAll();
      const forYaba = (await create({ ...imageAd, title: "Yaba only", hoodIds: [yaba] }).expect(201)).body._id;
      const forAbuja = (await create({ ...imageAd, title: "Abuja", cities: ["Abuja"] }).expect(201)).body._id;
      await status(forYaba, "active").expect(200);
      await status(forAbuja, "active").expect(200);
      expect(ads(await feed("ada", lekki, "session=sessionFFF&limit=10"))).toHaveLength(0);
      expect(ads(await feed("emeka", abuja, "session=sessionFFF&limit=10")).map((a) => a.data._id)).toEqual([forAbuja]);
      await status(forYaba, "paused").expect(200);
      await status(forAbuja, "paused").expect(200);
    });

    it("scheduled, paused, ended and deleted ads stay out", async () => {
      await pauseAll();
      const later = (await create({ ...imageAd, title: "Later", startsAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(201)).body._id;
      await status(later, "active").expect(200);
      expect(ads(await feed("ada", lekki, "session=sessionGGG&limit=10"))).toHaveLength(0);

      const gone = (await create({ ...imageAd, title: "Gone" }).expect(201)).body._id;
      await status(gone, "active").expect(200);
      expect(ads(await feed("ada", lekki, "session=sessionHHH&limit=10")).length).toBeGreaterThan(0);
      await t.http.delete(`/api/admin/ads/${gone}`).set(admin()).expect(204);
      expect(ads(await feed("ada", lekki, "session=sessionIII&limit=10"))).toHaveLength(0);
      await t.http.get(`/api/admin/ads/${gone}`).set(admin()).expect(404);
      // Its stats are kept.
      await t.http.get(`/api/admin/ads/${gone}/stats`).set(admin()).expect(200);
      await status(later, "paused").expect(200);
    });
  });

  describe("what neighbours do with an ad", () => {
    let ad: string;

    beforeAll(async () => {
      await pauseAll();
      ad = (await create({ ...imageAd, title: "Capped", dailyCapPerUser: 1 }).expect(201)).body._id;
      await status(ad, "active").expect(200);
    });

    const events = (uid: string, list: Record<string, unknown>[]) => t.http.post("/api/ads/events").set(t.auth(uid)).send({ events: list }).expect(200);

    it("impressions and clicks count once per ad, feed session and kind", async () => {
      expect((await events("bola", [{ adId: ad, type: "impression", sessionId: "session111" }, { adId: ad, type: "impression", sessionId: "session111" }])).body).toEqual({ recorded: 1 });
      expect((await events("bola", [{ adId: ad, type: "impression", sessionId: "session111" }])).body).toEqual({ recorded: 0 });
      expect((await events("bola", [{ adId: ad, type: "click", sessionId: "session111" }, { adId: ad, type: "click", sessionId: "session111" }])).body).toEqual({ recorded: 1 });
      expect((await events("chidi", [{ adId: ad, type: "impression", sessionId: "session222" }])).body).toEqual({ recorded: 1 });
      const stats = (await t.http.get(`/api/admin/ads/${ad}/stats`).set(admin()).expect(200)).body;
      expect(stats).toMatchObject({ impressions: 2, reach: 2, clicks: 1, ctr: 50 });
      expect(stats.daily.reduce((n: number, d: { impressions: number }) => n + d.impressions, 0)).toBe(2);
    });

    it("an unknown ad's events are ignored; a malformed batch is refused", async () => {
      expect((await events("bola", [{ adId: "64b7f0c2a1b2c3d4e5f60718", type: "impression", sessionId: "session111" }])).body).toEqual({ recorded: 0 });
      await t.http.post("/api/ads/events").set(t.auth("bola")).send({ events: [{ adId: ad, type: "hide", sessionId: "session111" }] }).expect(400);
    });

    it("once seen as often as its daily cap allows, it isn't placed again today", async () => {
      // bola saw it once (cap 1): a fresh feed session has no ad.
      expect(ads(await feed("bola", lekki, "session=session333&limit=10"))).toHaveLength(0);
      // ada hasn't: one slot, then capped for the rest of this session.
      const p1 = await feed("ada", lekki, "session=session444&limit=10");
      const p2 = await feed("ada", lekki, `session=session444&limit=10&cursor=${p1.nextCursor}`);
      expect(ads(p1).length + ads(p2).length).toBe(1);
    });

    it("hide removes it for good; report is counted and hides it too", async () => {
      await t.http.post(`/api/ads/${ad}/hide`).set(t.auth("ada")).send({ sessionId: "session555" }).expect(200, { hidden: true });
      await t.http.post(`/api/ads/${ad}/hide`).set(t.auth("ada")).send({}).expect(200);
      expect(ads(await feed("ada", lekki, "session=session666&limit=10"))).toHaveLength(0);

      await t.http.post(`/api/ads/${ad}/report`).set(t.auth("chidi")).send({ reason: "scam" }).expect(200, { reported: true });
      await t.http.post(`/api/ads/${ad}/report`).set(t.auth("chidi")).send({ reason: "spam" }).expect(200);
      await t.http.post(`/api/ads/${ad}/report`).set(t.auth("chidi")).send({ reason: "rude" }).expect(400);
      expect(ads(await feed("chidi", lekki, "session=session777&limit=10"))).toHaveLength(0);
      expect((await t.http.get(`/api/admin/ads/${ad}`).set(admin()).expect(200)).body.stats).toMatchObject({ hides: 2, reports: 1 });
    });
  });
});
