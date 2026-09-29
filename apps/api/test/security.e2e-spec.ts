import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

describe("Security & authorization (audit findings)", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1");
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    await t.member("ada", lekki);
    await t.member("tunde", yaba);
    await t.user("newbie");
    await t.member("admin1", lekki, { role: "admin" });
    await t.member("mod1", lekki, { role: "moderator" });
    await t.member("owner1", lekki, { role: "owner" });
    await t.member("susp", lekki, { accountStatus: "suspended" });
    await t.member("restr", lekki, { accountStatus: "restricted", restrictedUntil: new Date(Date.now() + 86_400_000) });
  });
  afterAll(() => t.close());

  it("rejects requests without a token (401)", async () => {
    await t.http.get("/api/users/me").expect(401);
    await t.http.get("/api/health").expect((r) => expect(r.status).not.toBe(401));
  });

  describe("F1: neighbourhood create/delete need hoods.manage", () => {
    it("members and moderators get 403", async () => {
      const body = { name: "Ikoyi", city: "Lagos", center: { lat: 6.4541, lng: 3.4336 }, radiusMeters: 1000 };
      await t.http.post("/api/neighborhoods").set(t.auth("ada")).send(body).expect(403);
      await t.http.post("/api/neighborhoods").set(t.auth("mod1")).send(body).expect(403);
      await t.http.delete(`/api/neighborhoods/${yaba}`).set(t.auth("ada")).expect(403);
    });

    it("admins can create; DELETE archives instead of hard-deleting", async () => {
      const res = await t.http.post("/api/neighborhoods").set(t.auth("admin1")).send({ name: "Ikoyi", city: "Lagos", center: { lat: 6.4541, lng: 3.4336 }, radiusMeters: 1000 }).expect(201);
      await t.http.delete(`/api/neighborhoods/${res.body._id}`).set(t.auth("admin1")).expect(204);
      const doc = await t.hoods.findById(res.body._id).lean();
      expect(doc?.status).toBe("archived");
    });

    it("refuses an overlapping Hood (409)", async () => {
      await t.http.post("/api/neighborhoods").set(t.auth("admin1")).send({ name: "Lekki Central", city: "Lagos", center: { lat: 6.448, lng: 3.475 }, radiusMeters: 1000 }).expect(409);
    });
  });

  describe("F2: posts can't be forged", () => {
    it("ignores a spoofed authorUid/likes/isActive (400: not whitelisted) and uses the token", async () => {
      await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "hi", authorUid: "tunde" }).expect(400);
      const ok = await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "Hello Lekki" }).expect(201);
      expect(ok.body.authorUid).toBe("ada");
      expect(ok.body.neighborhoodId).toBe(lekki);
    });

    it("can't post into another Hood", async () => {
      await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "sneaky", neighborhoodId: yaba }).expect(403);
    });

    it("unverified, restricted and suspended people can't post", async () => {
      await t.http.post("/api/posts").set(t.auth("newbie")).send({ message: "hi" }).expect(403);
      await t.http.post("/api/posts").set(t.auth("restr")).send({ message: "hi" }).expect(403);
      await t.http.post("/api/posts").set(t.auth("susp")).send({ message: "hi" }).expect(403);
    });

    it("accepts the current web payload (encoded content) and reads its fields", async () => {
      const content = '<!--mh:{"category":"event","eventDate":"2030-01-01T10:00:00.000Z","eventLocation":"Road 12 park"}-->\nSanitation day';
      const res = await t.http.post("/api/posts").set(t.auth("ada")).send({ content, type: "event" }).expect(201);
      expect(res.body).toMatchObject({ category: "event", message: "Sanitation day", eventLocation: "Road 12 park" });
    });
  });

  describe("F3: Hood changes only through verification or staff", () => {
    it("PATCH /users/me rejects neighborhoodId", async () => {
      await t.http.patch("/api/users/me").set(t.auth("ada")).send({ neighborhoodId: yaba }).expect(400);
      await t.http.patch("/api/users/me").set(t.auth("ada")).send({ bio: "Mum of two" }).expect(200);
    });
  });

  describe("F4: feeds are scoped to the caller's own Hood", () => {
    it("404s for another Hood's feed and a post outside it", async () => {
      const post = await t.post("tunde", { message: "Yaba only" });
      await t.http.get(`/api/posts/neighborhood/${yaba}`).set(t.auth("ada")).expect(404);
      await t.http.get(`/api/posts/${post._id}`).set(t.auth("ada")).expect(404);
      await t.http.get(`/api/posts/neighborhood/${yaba}`).set(t.auth("tunde")).expect(200);
    });

    it("caps limit and rejects malformed ids", async () => {
      await t.http.get(`/api/posts/neighborhood/${lekki}?limit=100000`).set(t.auth("ada")).expect(400);
      await t.http.get(`/api/posts/not-an-id`).set(t.auth("ada")).expect(400);
    });
  });

  it("suspended accounts are blocked except /users/me and logout", async () => {
    await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("susp")).expect(403);
    const me = await t.http.get("/api/users/me").set(t.auth("susp")).expect(200);
    expect(me.body.accountStatus).toBe("suspended");
  });

  it("deleting someone else's post is 403, your own is 204", async () => {
    const p = await t.post("ada", { message: "mine" });
    await t.member("chi", lekki);
    await t.http.delete(`/api/posts/${p._id}`).set(t.auth("chi")).expect(403);
    await t.http.delete(`/api/posts/${p._id}`).set(t.auth("ada")).expect(204);
    await t.http.get(`/api/posts/${p._id}`).set(t.auth("ada")).expect(404);
  });

  describe("admin API", () => {
    it("is closed to members; moderators can't reach admin-only areas", async () => {
      await t.http.get("/api/admin/overview").set(t.auth("ada")).expect(403);
      await t.http.get("/api/admin/overview").set(t.auth("mod1")).expect(200);
      await t.http.get("/api/admin/team").set(t.auth("mod1")).expect(403);
      await t.http.patch("/api/admin/settings").set(t.auth("mod1")).send({}).expect(403);
      const me = await t.http.get("/api/admin/me").set(t.auth("mod1")).expect(200);
      expect(me.body.can).toEqual(["moderation.act", "verification.review"]);
    });

    it("moderators can't suspend or reinstate; admins can", async () => {
      await t.member("target", lekki);
      await t.http.post("/api/admin/neighbours/target/actions").set(t.auth("mod1")).send({ action: "suspend", reason: "Scam" }).expect(403);
      await t.http.post("/api/admin/neighbours/target/actions").set(t.auth("admin1")).send({ action: "suspend", reason: "Scam" }).expect(201);
      expect((await t.users.findOne({ uid: "target" }).lean())?.accountStatus).toBe("suspended");
    });

    it("owner rules: admins can't grant admin; the last owner can't step down", async () => {
      await t.http.patch("/api/admin/team/ada").set(t.auth("admin1")).send({ role: "admin" }).expect(403);
      await t.http.patch("/api/admin/team/ada").set(t.auth("admin1")).send({ role: "moderator" }).expect(200);
      await t.http.patch("/api/admin/team/ada").set(t.auth("owner1")).send({ role: "admin" }).expect(200);
      await t.http.patch("/api/admin/team/owner1").set(t.auth("owner1")).send({ role: "admin" }).expect(400);
      await t.member("owner2", lekki, { role: "admin" });
      await t.http.patch("/api/admin/team/owner1").set(t.auth("ada")).send({ role: "member" }).expect(403);
    });
  });

  it("notifications are private to their owner", async () => {
    const p = await t.post("ada", { message: "comment on me" });
    await t.member("emeka", lekki);
    await t.http.post(`/api/posts/${p._id}/comments`).set(t.auth("emeka")).send({ content: "Nice!" }).expect(201);
    const mine = await t.http.get("/api/notifications").set(t.auth("ada")).expect(200);
    const n = mine.body.find((x: { type: string }) => x.type === "comment");
    expect(n).toBeTruthy();
    await t.http.patch(`/api/notifications/${n._id}`).set(t.auth("emeka")).send({ read: true }).expect(404);
    const ok = await t.http.patch(`/api/notifications/${n._id}`).set(t.auth("ada")).send({ read: true }).expect(200);
    expect(ok.body.read).toBe(true);
  });
});
