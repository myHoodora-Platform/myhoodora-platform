import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const LEKKI = { lng: 3.4746, lat: 6.4478 };
const YABA = { lng: 3.3711, lat: 6.5095 };
const DAY = 86_400_000;

/** Seeds a Hood with one resident's post, listing and group, which is everything a neighbour can read there. */
async function seedHoodContent(t: TestApp, hood: string) {
  await t.member("ada", hood);
  const postId = (await t.post("ada", { message: "Water tanker on Admiralty Way at 4pm" }))._id;
  await t.http.post(`/api/posts/${postId}/comments`).set(t.auth("ada")).send({ content: "Bring your own kegs" }).expect(201);
  const listingId = (
    await t.http.post("/api/listings").set(t.auth("ada")).send({ title: "Standing fan", priceNaira: 20000, category: "home_appliances", condition: "good", photos: [] }).expect(201)
  ).body._id as string;
  const groupId = (
    await t.http.post("/api/groups").set(t.auth("ada")).send({ name: "Road 12 Parents", description: "School runs and playdates.", category: "parents", privacy: "open", boundary: "neighbourhood" }).expect(201)
  ).body._id as string;
  await t.http.post(`/api/groups/${groupId}/posts`).set(t.auth("ada")).send({ content: "PTA meeting on Friday" }).expect(201);
  return { postId, listingId, groupId };
}

/**
 * Audit B4 and B3: "posts are private to their Hood" has to hold for people who are not
 * (or no longer) verified neighbours, and a verified neighbour must not be able to hop between Hoods.
 */
describe("Who may read a Hood", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  let content: { postId: string; listingId: string; groupId: string };

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1", LEKKI.lng, LEKKI.lat, 2000);
    yaba = await t.hood("Yaba", YABA.lng, YABA.lat, 1500);
    content = await seedHoodContent(t, lekki);
    await t.member("tunde", yaba);
    await t.member("admin1", lekki, { role: "admin" });
    await t.member("mod1", lekki, { role: "moderator" });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const act = (uid: string, body: Record<string, unknown>, as = "admin1") => t.http.post(`/api/admin/neighbours/${uid}/actions`).set(t.auth(as)).send(body);

  /** Every route that serves a Hood's content, as this person. None may answer with any of it. */
  async function expectNoHoodContent(uid: string) {
    const as = t.auth(uid);
    await t.http.get(`/api/posts/neighborhood/${lekki}`).set(as).expect(404);
    await t.http.get(`/api/posts/${content.postId}`).set(as).expect(404);
    await t.http.get(`/api/posts/${content.postId}/comments`).set(as).expect(404);
    await t.http.get("/api/listings").set(as).expect(404);
    await t.http.get(`/api/listings/${content.listingId}`).set(as).expect(404);
    await t.http.get("/api/groups").set(as).expect(404);
    await t.http.get(`/api/groups/${content.groupId}`).set(as).expect(404);
    await t.http.get(`/api/groups/${content.groupId}/posts`).set(as).expect(404);
    await t.http.get(`/api/groups/${content.groupId}/members`).set(as).expect(404);
    await t.http.get("/api/users/ada/public").set(as).expect(404);
    expect((await t.http.get("/api/users/search").set(as).expect(200)).body).toEqual([]);
    expect((await t.http.get("/api/search?q=water").set(as).expect(200)).body).toMatchObject({ posts: [], listings: [], people: [] });
  }

  describe("B4: only verified neighbours read their Hood", () => {
    it("a verified neighbour reads everything in their own Hood (the control)", async () => {
      await t.member("bisi", lekki);
      const as = t.auth("bisi");
      expect((await t.http.get(`/api/posts/neighborhood/${lekki}`).set(as).expect(200)).body).toHaveLength(1);
      await t.http.get(`/api/posts/${content.postId}`).set(as).expect(200);
      expect((await t.http.get("/api/listings").set(as).expect(200)).body).toHaveLength(1);
      expect((await t.http.get("/api/groups").set(as).expect(200)).body).toHaveLength(1);
      expect((await t.http.get(`/api/groups/${content.groupId}/posts`).set(as).expect(200)).body).toHaveLength(1);
      await t.http.get("/api/users/ada/public").set(as).expect(200);
    });

    it("after staff reject someone's verification, they read nothing from the Hood they were in", async () => {
      await t.member("rex", lekki);
      // A member of a group there, too: membership must not outlive the rejection.
      await t.http.post(`/api/groups/${content.groupId}/join`).set(t.auth("rex")).send({}).expect(200);
      await t.http.get(`/api/groups/${content.groupId}/posts`).set(t.auth("rex")).expect(200);

      await act("rex", { action: "reject_verification", reason: "Address could not be confirmed" }).expect(201);

      await expectNoHoodContent("rex");
      // Writing was already closed to them; it still is.
      await t.http.post("/api/posts").set(t.auth("rex")).send({ message: "Still here" }).expect(403);

      const record = await t.users.findOne({ uid: "rex" }).lean();
      expect(record?.verificationStatus).toBe("rejected");
      expect(record?.neighborhoodId).toBeUndefined();
      // Kept for staff, and grants nothing.
      expect(record?.lastNeighborhoodId).toBe(lekki);
      const me = (await t.http.get("/api/users/me").set(t.auth("rex")).expect(200)).body;
      expect(me.neighborhoodId).toBeUndefined();
    });

    it("an account with a Hood on record but no verification (older data) reads nothing either", async () => {
      for (const [uid, verificationStatus] of [["old-unverified", "unverified"], ["old-pending", "pending_review"], ["old-rejected", "rejected"]] as const) {
        await t.user(uid, { neighborhoodId: lekki, verificationStatus });
        await expectNoHoodContent(uid);
      }
    });

    it("turning down a request to join leaves the person unverified and reading nothing", async () => {
      await t.user("asker", { verificationStatus: "pending_review", requestedHood: { id: lekki, name: "Lekki Phase 1", requestedAt: new Date() } });
      await act("asker", { action: "reject_verification", reason: "Too far from the estate" }, "mod1").expect(201);
      expect((await t.users.findOne({ uid: "asker" }).lean())?.verificationStatus).toBe("unverified");
      await expectNoHoodContent("asker");
    });

    it("staff verifying someone again gives the Hood back", async () => {
      await t.member("sola", lekki);
      await act("sola", { action: "reject_verification", reason: "Address could not be confirmed" }).expect(201);
      await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("sola")).expect(404);
      await act("sola", { action: "verify", hoodId: lekki, reason: "Utility bill checked" }).expect(201);
      expect((await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("sola")).expect(200)).body).toHaveLength(1);
    });

    it("staff can still move a verified neighbour; moving someone who isn't verified is refused (verify them instead)", async () => {
      await t.member("moved", lekki);
      await act("moved", { action: "change_hood", hoodId: yaba, reason: "Relocated to Yaba" }).expect(201);
      await t.http.get(`/api/posts/neighborhood/${yaba}`).set(t.auth("moved")).expect(200);
      await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("moved")).expect(404);

      await t.user("not-yet");
      const res = await act("not-yet", { action: "change_hood", hoodId: yaba, reason: "Relocated to Yaba" }).expect(400);
      expect(res.body.message).toMatch(/isn't verified/);
      expect((await t.users.findOne({ uid: "not-yet" }).lean())?.neighborhoodId).toBeUndefined();
    });

    it("staff still read any Hood", async () => {
      expect((await t.http.get(`/api/posts/neighborhood/${yaba}`).set(t.auth("mod1")).expect(200)).body).toEqual([]);
      await t.http.get(`/api/posts/${content.postId}`).set(t.auth("admin1")).expect(200);
    });
  });

  describe("B3: a verified neighbour can't hop between Hoods", () => {
    const verify = (uid: string, at: { lng: number; lat: number }) => t.http.post("/api/users/me/verify-location").set(t.auth(uid)).send({ ...at, address: "12 Test Road" });
    const audits = (uid: string) => t.model<{ action: string; reason?: string; target: { label: string } }>("AuditEvent").find({ action: "hood_self_change", "target.id": uid }).lean();

    it("a first address check still verifies someone into the Hood that covers it", async () => {
      await t.user("newbie");
      const res = await verify("newbie", LEKKI).expect(200);
      expect(res.body).toMatchObject({ verificationStatus: "verified", neighborhoodId: lekki });
      expect((await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("newbie")).expect(200)).body).toHaveLength(1);
      // Joining isn't a move: nothing for staff to review.
      expect(await audits("newbie")).toEqual([]);
    });

    it("posting another Hood's coordinates is refused, and the attempt is kept for staff", async () => {
      await t.member("hopper", lekki);
      const res = await verify("hopper", YABA).expect(409);
      expect(res.body.message).toMatch(/Lekki Phase 1/);
      expect(res.body.message).toMatch(/90 days/);

      const record = await t.users.findOne({ uid: "hopper" }).lean();
      expect(record?.neighborhoodId).toBe(lekki);
      expect(record?.verificationAttempts.at(-1)).toMatchObject({ lat: YABA.lat, lng: YABA.lng, result: "mismatch" });
      await t.http.get(`/api/posts/neighborhood/${yaba}`).set(t.auth("hopper")).expect(404);
      expect((await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("hopper")).expect(200)).body).toHaveLength(1);
    });

    it("checking an address in the Hood they already live in changes nothing", async () => {
      const verifiedAt = new Date(Date.now() - 10 * DAY);
      await t.member("settled", lekki, { verifiedAt });
      const res = await verify("settled", LEKKI).expect(200);
      expect(res.body).toMatchObject({ verificationStatus: "verified", neighborhoodId: lekki });
      expect((await t.users.findOne({ uid: "settled" }).lean())?.verifiedAt).toEqual(verifiedAt);
      expect(await audits("settled")).toEqual([]);
    });

    it("someone verified more than 90 days ago can move once, and the move is audited", async () => {
      await t.member("mover", lekki, { verifiedAt: new Date(Date.now() - 91 * DAY) });
      const res = await verify("mover", YABA).expect(200);
      expect(res.body).toMatchObject({ verificationStatus: "verified", neighborhoodId: yaba });

      const record = await t.users.findOne({ uid: "mover" }).lean();
      expect(record?.neighborhoodId).toBe(yaba);
      expect(Date.now() - record!.verifiedAt!.getTime()).toBeLessThan(60_000);
      expect(await audits("mover")).toEqual([expect.objectContaining({ target: expect.objectContaining({ label: "Yaba" }), reason: expect.stringContaining("Lekki Phase 1") })]);

      // The clock restarted: straight back is refused.
      await verify("mover", LEKKI).expect(409);
      expect(await audits("mover")).toHaveLength(1);
    });

    it("89 days is not enough", async () => {
      await t.member("early", lekki, { verifiedAt: new Date(Date.now() - 89 * DAY) });
      await verify("early", YABA).expect(409);
    });
  });

  describe("B3: Hood boundaries are not handed to people who could use them to get in", () => {
    type HoodBody = { _id: string; name: string; city: string; location?: unknown; radiusMeters?: number };
    const list = async (uid: string, path = "/api/neighborhoods") => (await t.http.get(path).set(t.auth(uid)).expect(200)).body as HoodBody[];
    const hasGeometry = (h: HoodBody) => h.location !== undefined || h.radiusMeters !== undefined;

    it("someone who isn't verified gets names and cities only, from every Hood route", async () => {
      await t.user("stranger");
      const all = await list("stranger");
      expect(all.map((h) => h.name).sort()).toEqual(["Lekki Phase 1", "Yaba"]);
      for (const h of all) {
        expect(hasGeometry(h)).toBe(false);
        expect(Object.keys(h).sort()).toEqual(["_id", "city", "country", "name"]);
      }
      const near = await list("stranger", `/api/neighborhoods/nearby?lng=${LEKKI.lng}&lat=${LEKKI.lat}`);
      expect(near).toHaveLength(1);
      expect(hasGeometry(near[0]!)).toBe(false);
      const one = (await t.http.get(`/api/neighborhoods/${lekki}`).set(t.auth("stranger")).expect(200)).body as HoodBody;
      expect(one).toEqual({ _id: lekki, name: "Lekki Phase 1", city: "Lagos", country: "Nigeria" });
    });

    it("a verified neighbour gets the boundary of their own Hood (the alerts map needs it) and of no other", async () => {
      const all = await list("ada");
      expect(hasGeometry(all.find((h) => h._id === lekki)!)).toBe(true);
      expect(hasGeometry(all.find((h) => h._id === yaba)!)).toBe(false);
      const own = (await t.http.get(`/api/neighborhoods/${lekki}`).set(t.auth("ada")).expect(200)).body as HoodBody;
      expect(own).toMatchObject({ _id: lekki, radiusMeters: 2000, location: { type: "Point", coordinates: [LEKKI.lng, LEKKI.lat] } });
      const other = (await t.http.get(`/api/neighborhoods/${yaba}`).set(t.auth("ada")).expect(200)).body as HoodBody;
      expect(hasGeometry(other)).toBe(false);
    });

    it("a rejected neighbour no longer gets the boundary of the Hood they were in", async () => {
      await t.member("ex", lekki);
      await act("ex", { action: "reject_verification", reason: "Address could not be confirmed" }).expect(201);
      expect((await list("ex")).some(hasGeometry)).toBe(false);
    });

    it("staff get every boundary", async () => {
      for (const uid of ["mod1", "admin1"]) expect((await list(uid)).every(hasGeometry)).toBe(true);
    });
  });
});

/** The rollback switch: HOOD_ACCESS_STRICT=false restores the behaviour from before the audit, without a deploy. */
describe("Who may read a Hood, with HOOD_ACCESS_STRICT=false", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;

  beforeAll(async () => {
    process.env.HOOD_ACCESS_STRICT = "false";
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1", LEKKI.lng, LEKKI.lat, 2000);
    yaba = await t.hood("Yaba", YABA.lng, YABA.lat, 1500);
    await seedHoodContent(t, lekki);
    await t.member("admin1", lekki, { role: "admin" });
  });
  afterAll(async () => {
    delete process.env.HOOD_ACCESS_STRICT;
    await t.close();
  });

  it("behaves as before: rejection keeps the Hood, a verified neighbour can re-verify elsewhere, and boundaries are listed", async () => {
    await t.member("rex", lekki);
    await t.http.post("/api/admin/neighbours/rex/actions").set(t.auth("admin1")).send({ action: "reject_verification", reason: "Address could not be confirmed" }).expect(201);
    expect((await t.users.findOne({ uid: "rex" }).lean())?.neighborhoodId).toBe(lekki);
    expect((await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("rex")).expect(200)).body).toHaveLength(1);

    await t.member("hopper", lekki);
    const moved = await t.http.post("/api/users/me/verify-location").set(t.auth("hopper")).send(YABA).expect(200);
    expect(moved.body.neighborhoodId).toBe(yaba);

    await t.user("stranger");
    const hoods = (await t.http.get("/api/neighborhoods").set(t.auth("stranger")).expect(200)).body as { radiusMeters?: number }[];
    expect(hoods.every((h) => typeof h.radiusMeters === "number")).toBe(true);
  });
});
