import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * Audit B23: two privacy settings were saved and shown, and did nothing.
 * "Who can see your full profile" had no effect at all, and "Only people I've messaged" behaved
 * exactly like "No one".
 */
describe("Privacy settings do what they say", () => {
  let t: TestApp;
  let lekki: string;
  let lekki2: string;
  let yaba: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1", 3.4746, 6.4478, 2000);
    lekki2 = await t.hood("Lekki Phase 2", 3.5146, 6.44, 1500); // about 4.5 km away: a nearby Hood
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500); // about 13 km away: not nearby
    await t.member("ada", lekki, { displayName: "Ada Okafor", bio: "Road 12" });
    for (const uid of ["bola", "chidi", "dayo"]) await t.member(uid, lekki);
    await t.member("emeka", lekki2);
    await t.member("tunde", yaba);
    await t.user("stranger", { neighborhoodId: lekki2 });
    await t.member("admin1", yaba, { role: "admin" });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const setPrivacy = (uid: string, privacy: Record<string, unknown>) => t.http.patch("/api/users/me/preferences").set(t.auth(uid)).send({ privacy }).expect(200);
  const profile = (viewer: string, uid = "ada") => t.http.get(`/api/users/${uid}/public`).set(t.auth(viewer));

  describe("who can see your full profile", () => {
    it("\"My neighbourhood\" (the default): neighbours in your Hood, and nobody from another", async () => {
      expect((await profile("bola").expect(200)).body).toMatchObject({ uid: "ada", displayName: "Ada Okafor", bio: "Road 12" });
      const restricted = await profile("emeka").expect(403);
      expect(restricted.body.message).toMatch(/Ada Okafor has restricted who can see their profile/);
      // Out of coverage altogether: not Ada's restriction, so it must not be described as one.
      const far = await profile("tunde").expect(404);
      expect(far.body.message).toMatch(/outside your neighbourhood coverage/);
    });

    it("\"Nearby neighbourhoods too\": verified neighbours of a nearby Hood as well, and still nobody further away", async () => {
      await setPrivacy("ada", { profileVisibility: "nearby" });
      const seen = (await profile("emeka").expect(200)).body;
      expect(seen).toMatchObject({ uid: "ada", displayName: "Ada Okafor", neighborhoodName: "Lekki Phase 1" });
      // Never the address, whoever is looking.
      expect(JSON.stringify(seen)).not.toMatch(/location|email|lat|lng/);
      await profile("bola").expect(200);
      await profile("tunde").expect(404);
      // Someone merely recorded in a nearby Hood, not verified there, is not a neighbour of anywhere.
      await profile("stranger").expect(404);
    });

    it("it is the profile owner's choice, not the viewer's", async () => {
      // emeka opens his own profile up; that doesn't let him see someone who hasn't.
      await setPrivacy("emeka", { profileVisibility: "nearby" });
      await profile("emeka", "bola").expect(403);
      await profile("bola", "emeka").expect(200);
    });

    it("a block still hides a profile, either way round", async () => {
      await t.http.post("/api/users/me/blocks").set(t.auth("ada")).send({ uid: "emeka" }).expect(204);
      await profile("emeka").expect(404);
      await profile("ada", "emeka").expect(404);
      await t.http.delete("/api/users/me/blocks/emeka").set(t.auth("ada")).expect(204);
      await profile("emeka").expect(200);
    });

    it("going back to \"My neighbourhood\" closes it again; staff see profiles regardless", async () => {
      await setPrivacy("ada", { profileVisibility: "neighbourhood" });
      await profile("emeka").expect(403);
      await profile("admin1").expect(200);
    });
  });

  describe("who can message you", () => {
    const start = (from: string, to: string, context?: Record<string, unknown>) => t.http.post("/api/conversations").set(t.auth(from)).send({ recipientUid: to, ...(context && { context }) });

    it("\"Only people I've messaged\": someone you have written to can start a new conversation; someone you haven't can't", async () => {
      // chidi writes to ada, and she replies: he is now someone she has messaged.
      const direct = (await start("chidi", "ada").expect(201)).body._id as string;
      await t.http.post(`/api/conversations/${direct}/messages`).set(t.auth("chidi")).send({ body: "Is the fan still available?" }).expect(201);
      await t.http.post(`/api/conversations/${direct}/messages`).set(t.auth("ada")).send({ body: "Yes, come by tomorrow." }).expect(201);
      // bola writes to her too, and gets no reply.
      const unanswered = (await start("bola", "ada").expect(201)).body._id as string;
      await t.http.post(`/api/conversations/${unanswered}/messages`).set(t.auth("bola")).send({ body: "Hello?" }).expect(201);
      const listing = (await t.http.post("/api/listings").set(t.auth("ada")).send({ title: "Standing fan", priceNaira: 20000, category: "home_appliances", condition: "good", photos: [] }).expect(201)).body._id as string;

      await setPrivacy("ada", { messaging: "contacts" });

      // A new conversation (about her listing) from each of them, and from someone she has never heard from.
      await start("chidi", "ada", { type: "listing", id: listing }).expect(201);
      const refused = await start("bola", "ada", { type: "listing", id: listing }).expect(403);
      expect(refused.body.message).toMatch(/has restricted who can message them and isn't accepting new messages/);
      await start("dayo", "ada").expect(403);
      // Conversations that already exist carry on, as they always have.
      await t.http.post(`/api/conversations/${unanswered}/messages`).set(t.auth("bola")).send({ body: "Never mind." }).expect(201);
    });

    it("\"No one\": no new conversations at all, even from someone you have messaged", async () => {
      await setPrivacy("ada", { messaging: "nobody" });
      const other = (await t.http.post("/api/listings").set(t.auth("ada")).send({ title: "Office chair", priceNaira: 15000, category: "furniture", condition: "good", photos: [] }).expect(201)).body._id as string;
      await start("chidi", "ada", { type: "listing", id: other }).expect(403);
    });

    it("\"Anyone in my neighbourhood\": neighbours of the same Hood, as before", async () => {
      await setPrivacy("ada", { messaging: "neighbourhood" });
      await start("dayo", "ada").expect(201);
      await start("tunde", "ada").expect(403);
    });
  });
});
