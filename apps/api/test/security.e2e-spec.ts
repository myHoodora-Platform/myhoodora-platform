import { SessionRevocationService } from "../src/auth/session-revocation.service";
import { createTestApp, type TestApp } from "./helpers/app";
import { firebaseState } from "./helpers/firebase-mock";
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
      const eventDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const content = `<!--mh:{"category":"event","eventDate":"${eventDate}","eventLocation":"Road 12 park"}-->\nSanitation day`;
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

  it("suspended accounts are blocked except /users/me, their session and logout", async () => {
    await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("susp")).expect(403);
    const me = await t.http.get("/api/users/me").set(t.auth("susp")).expect(200);
    expect(me.body.accountStatus).toBe("suspended");
  });

  describe("web session cookie", () => {
    const session = (uid: string) => ({ Authorization: `Bearer s:${uid}` });

    it("POST /auth/session exchanges an ID token for a session cookie with the configured lifetime", async () => {
      const res = await t.http.post("/api/auth/session").set(t.auth("ada")).expect(200);
      expect(res.body).toEqual({ sessionCookie: "s:ada", expiresIn: 7 * 24 * 60 * 60 });
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    it("needs a valid ID token: none, garbage and a session cookie are all 401", async () => {
      await t.http.post("/api/auth/session").expect(401);
      await t.http.post("/api/auth/session").set({ Authorization: "Bearer nonsense" }).expect(401);
      await t.http.post("/api/auth/session").set(session("ada")).expect(401);
    });

    it("suspended people still get a session (to reach the page that explains it)", async () => {
      await t.http.post("/api/auth/session").set(t.auth("susp")).expect(200);
    });

    it("a session cookie is not accepted on data routes", async () => {
      await t.http.get("/api/users/me").set(session("ada")).expect(401);
      await t.http.get("/api/admin/me").set(session("admin1")).expect(401);
    });

    it("GET /auth/session/staff: 204 for staff, 403 for members, 401 for anything but a valid session cookie", async () => {
      for (const uid of ["mod1", "admin1", "owner1"]) await t.http.get("/api/auth/session/staff").set(session(uid)).expect(204);
      await t.http.get("/api/auth/session/staff").set(session("ada")).expect(403);
      await t.http.get("/api/auth/session/staff").expect(401);
      await t.http.get("/api/auth/session/staff").set(t.auth("admin1")).expect(401);
      await t.http.get("/api/auth/session/staff").set({ Authorization: "Bearer nonsense" }).expect(401);
    });

    it("GET /auth/session: 204 for a live session cookie (suspended included), 401 for anything else", async () => {
      await t.http.get("/api/auth/session").set(session("ada")).expect(204);
      await t.http.get("/api/auth/session").set(session("susp")).expect(204);
      await t.http.get("/api/auth/session").expect(401);
      await t.http.get("/api/auth/session").set(t.auth("ada")).expect(401);
      await t.http.get("/api/auth/session").set({ Authorization: "Bearer nonsense" }).expect(401);
    });

    it("suspended staff are refused at the gate", async () => {
      await t.member("suspmod", lekki, { role: "moderator", accountStatus: "suspended" });
      await t.http.get("/api/auth/session/staff").set(session("suspmod")).expect(403);
    });

    it("the session routes are rate-limited per credential, not per IP (the web server calls them for everyone)", async () => {
      t.resetThrottle();
      await t.member("busy", lekki);
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) statuses.push((await t.http.post("/api/auth/session").set(t.auth("busy"))).status);
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
      // Someone else, same IP, same second: unaffected.
      await t.http.post("/api/auth/session").set(t.auth("ada")).expect(200);
      t.resetThrottle();
    });

    it("logout-everywhere revokes the session cookie; there is no revoke-on-logout route any more", async () => {
      await t.member("mod2", lekki, { role: "moderator" });
      await t.http.get("/api/auth/session/staff").set(session("mod2")).expect(204);
      await t.http.post("/api/auth/logout").set(t.auth("mod2")).expect(404);
      await t.http.get("/api/auth/session").set(session("mod2")).expect(204);
      await t.http.post("/api/auth/logout-everywhere").set(t.auth("mod2")).expect(204);
      await t.http.get("/api/auth/session").set(session("mod2")).expect(401);
      await t.http.get("/api/auth/session/staff").set(session("mod2")).expect(401);
      await t.http.post("/api/auth/logout-everywhere").set(t.auth("susp")).expect(204);
    });
  });

  describe("revocation: checked without a call to Firebase on every request", () => {
    const service = () => t.app.get(SessionRevocationService);
    // These fire many requests in quick succession; this is about revocation, not the rate limit.
    beforeEach(() => t.resetThrottle());

    it("asks Firebase about a user once, not once per request", async () => {
      await t.member("fola", lekki);
      service().forget("fola");
      const before = firebaseState.getUserCalls;
      for (let i = 0; i < 6; i++) await t.http.get("/api/users/me").set(t.auth("fola")).expect(200);
      expect(firebaseState.getUserCalls - before).toBe(1);
    });

    it("sign out everywhere is immediate, even while Firebase's answer is still remembered; a new sign-in works", async () => {
      await t.member("gbenga", lekki);
      await t.http.get("/api/users/me").set(t.auth("gbenga")).expect(200); // "not revoked" is now remembered
      await t.http.post("/api/auth/logout-everywhere").set(t.auth("gbenga")).expect(204);

      // Refused from our own record. Put the remembered "not revoked" back to prove Firebase isn't what refuses it.
      const calls = firebaseState.getUserCalls;
      await t.http.get("/api/users/me").set(t.auth("gbenga")).expect(401);
      await t.http.post("/api/posts").set(t.auth("gbenga")).send({ message: "still here?" }).expect(401);
      await t.http.get("/api/auth/session").set({ Authorization: "Bearer s:gbenga" }).expect(401);
      expect(firebaseState.getUserCalls - calls).toBeLessThanOrEqual(1);
      expect((await t.users.findOne({ uid: "gbenga" }).lean())?.sessionsRevokedAt).toBeInstanceOf(Date);

      // Signing in again gives a token from after the revocation.
      const fresh = { Authorization: "Bearer t:gbenga:u:password:fresh" };
      await t.http.get("/api/users/me").set(fresh).expect(200);
      await t.http.get("/api/auth/session").set({ Authorization: "Bearer s:gbenga:fresh" }).expect(204);
    });

    it("an account disabled or deleted directly in Firebase is refused once the short memory lapses", async () => {
      await t.member("halima", lekki);
      await t.http.get("/api/users/me").set(t.auth("halima")).expect(200);
      firebaseState.disabled.add("halima");
      // Inside the window the last answer still stands…
      await t.http.get("/api/users/me").set(t.auth("halima")).expect(200);
      // …and when it lapses (forget() stands in for 30 seconds passing), they are out.
      service().forget("halima");
      await t.http.get("/api/users/me").set(t.auth("halima")).expect(401);
      firebaseState.disabled.delete("halima");

      await t.member("idris", lekki);
      firebaseState.deleted.add("idris");
      service().forget("idris");
      await t.http.get("/api/users/me").set(t.auth("idris")).expect(401);
      firebaseState.deleted.delete("idris");
    });
  });

  // A 401 makes the web app sign the person out of Firebase and drop their session cookie.
  // Google being unreachable must therefore never look like a bad token (audit B2).
  describe("a Firebase outage is 503 'try again', never 401 'signed out'", () => {
    const service = () => t.app.get(SessionRevocationService);
    /** Stands in for the 30-second memory lapsing: what we knew is still there, but too old to use without asking again. */
    const lapse = (uid: string) => {
      (service() as unknown as { states: Map<string, { until: number }> }).states.get(uid)!.until = 0;
    };
    beforeEach(() => t.resetThrottle());
    afterEach(() => {
      firebaseState.lookupDown = false;
      firebaseState.keysDown = false;
    });

    it("the revocation lookup failing for someone we know nothing about yet is 503 on every kind of route", async () => {
      await t.member("jide", lekki);
      service().forget("jide");
      firebaseState.lookupDown = true;
      const me = await t.http.get("/api/users/me").set(t.auth("jide")).expect(503);
      expect(me.body).toEqual({ statusCode: 503, message: expect.any(String) });
      await t.http.post("/api/posts").set(t.auth("jide")).send({ message: "hello?" }).expect(503);
      // The web's page gate and cookie exchange: 503 is "unknown" / "unavailable" there, and the cookie is kept.
      await t.http.get("/api/auth/session").set({ Authorization: "Bearer s:jide" }).expect(503);
      await t.http.post("/api/auth/session").set(t.auth("jide")).expect(503);

      // Google is back: the very next request works, nothing was remembered about the failure.
      firebaseState.lookupDown = false;
      await t.http.get("/api/users/me").set(t.auth("jide")).expect(200);
    });

    it("someone whose state was known a moment ago keeps working through the outage", async () => {
      await t.member("kemi", lekki);
      await t.http.get("/api/users/me").set(t.auth("kemi")).expect(200);
      firebaseState.lookupDown = true;
      lapse("kemi");
      await t.http.get("/api/users/me").set(t.auth("kemi")).expect(200);
      await t.http.get("/api/auth/session").set({ Authorization: "Bearer s:kemi" }).expect(204);
    });

    it("the outage doesn't loosen our own checks: sign out everywhere and suspension still apply at once", async () => {
      await t.member("lola", lekki);
      await t.http.get("/api/users/me").set(t.auth("lola")).expect(200);
      firebaseState.lookupDown = true;
      lapse("lola");
      await t.users.updateOne({ uid: "lola" }, { $set: { sessionsRevokedAt: new Date() } });
      await t.http.get("/api/users/me").set(t.auth("lola")).expect(401);

      firebaseState.lookupDown = false;
      await t.member("musa", lekki);
      await t.http.get("/api/users/me").set(t.auth("musa")).expect(200);
      firebaseState.lookupDown = true;
      lapse("musa");
      await t.users.updateOne({ uid: "musa" }, { $set: { accountStatus: "suspended" } });
      await t.http.post("/api/posts").set(t.auth("musa")).send({ message: "still here?" }).expect(403);
    });

    it("Google's signing keys being unfetchable is 503 too, while a genuinely bad token stays 401", async () => {
      firebaseState.keysDown = true;
      await t.http.get("/api/users/me").set(t.auth("ada")).expect(503);
      await t.http.get("/api/auth/session").set({ Authorization: "Bearer s:ada" }).expect(503);
      firebaseState.keysDown = false;
      await t.http.get("/api/users/me").set({ Authorization: "Bearer nonsense" }).expect(401);
      await t.http.get("/api/users/me").expect(401);
      await t.http.get("/api/users/me").set(t.auth("ada")).expect(200);
    });
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

    // Contract §13.3: a neighbour's home address is for admins only (audit B15).
    it("a neighbour's home address goes to admins and owners, not to moderators", async () => {
      await t.member("homer", lekki, { location: { address: "12 Admiralty Way, Lekki", lat: 6.4478, lng: 3.4746 } });
      for (const uid of ["admin1", "owner1"]) {
        const detail = (await t.http.get("/api/admin/neighbours/homer").set(t.auth(uid)).expect(200)).body;
        expect(detail.location).toEqual({ address: "12 Admiralty Way, Lekki", lat: 6.4478, lng: 3.4746 });
      }
      const forModerator = (await t.http.get("/api/admin/neighbours/homer").set(t.auth("mod1")).expect(200)).body;
      expect(forModerator.location).toBeUndefined();
      expect(JSON.stringify(forModerator)).not.toContain("Admiralty Way");
      // Everything else a moderator works with is still there.
      expect(forModerator).toMatchObject({ uid: "homer", verificationStatus: "verified", verificationAttempts: [], timeline: expect.any(Array) });

      // The same view comes back from an action, so the same rule applies there.
      const afterAction = (await t.http.post("/api/admin/neighbours/homer/actions").set(t.auth("mod1")).send({ action: "warn", reason: "Be kind" }).expect(201)).body;
      expect(afterAction.location).toBeUndefined();
      // The capability behind it is internal: it is not one of the contract's names sent to the web.
      expect((await t.http.get("/api/admin/me").set(t.auth("admin1")).expect(200)).body.can).not.toContain("neighbours.address");
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
