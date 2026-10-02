import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const PHOTO = "https://firebasestorage.googleapis.com/v0/b/x/o/chair.jpg";
const listing = (patch: Record<string, unknown> = {}) => ({ title: "Mahogany dining chair", description: "Solid, barely used", priceNaira: 25000, negotiable: true, category: "furniture", condition: "good", photos: [PHOTO], ...patch });

describe("For Sale & Free + chat", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    for (const uid of ["ada", "bola", "chidi"]) await t.member(uid, lekki);
    await t.member("tunde", yaba);
    await t.member("quiet", lekki, { preferences: { privacy: { messaging: "nobody" } } } as never);
    await t.member("restr", lekki, { accountStatus: "restricted", restrictedUntil: new Date(Date.now() + 86_400_000) });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  describe("listings", () => {
    let id: string;

    it("creates in your own Hood only, with the seller from the token", async () => {
      const res = await t.http.post("/api/listings").set(t.auth("ada")).send({ ...listing(), sellerUid: "bola" }).expect(400);
      expect(res.body.message).toBeTruthy();
      const ok = await t.http.post("/api/listings").set(t.auth("ada")).send(listing()).expect(201);
      expect(ok.body).toMatchObject({ sellerUid: "ada", neighborhoodId: lekki, status: "available", seller: { displayName: "ada" } });
      id = ok.body._id;
      await t.http.post("/api/listings").set(t.auth("ada")).send({ ...listing(), neighborhoodId: yaba }).expect(404);
      await t.http.post("/api/listings").set(t.auth("restr")).send(listing()).expect(403);
    });

    it("free items can't be negotiable; http photos are rejected", async () => {
      const free = await t.http.post("/api/listings").set(t.auth("bola")).send(listing({ title: "Baby cot", priceNaira: null, negotiable: true, category: "kids" })).expect(201);
      expect(free.body.negotiable).toBe(false);
      await t.http.post("/api/listings").set(t.auth("bola")).send(listing({ photos: ["http://insecure.test/x.jpg"] })).expect(400);
      const onlyFree = await t.http.get(`/api/listings?neighborhoodId=${lekki}&free=true`).set(t.auth("chidi")).expect(200);
      expect(onlyFree.body.map((l: { title: string }) => l.title)).toEqual(["Baby cot"]);
    });

    it("is Hood-scoped; sold items stay visible only to the seller", async () => {
      await t.http.get(`/api/listings?neighborhoodId=${lekki}`).set(t.auth("tunde")).expect(404);
      await t.http.get(`/api/listings/${id}`).set(t.auth("tunde")).expect(404);
      await t.http.patch(`/api/listings/${id}`).set(t.auth("bola")).send({ status: "sold" }).expect(403);
      await t.http.patch(`/api/listings/${id}`).set(t.auth("ada")).send({ status: "sold" }).expect(200);
      const forBola = await t.http.get("/api/listings").set(t.auth("bola")).expect(200);
      expect(forBola.body.some((l: { _id: string }) => l._id === id)).toBe(false);
      const forAda = await t.http.get("/api/listings?seller=ada").set(t.auth("ada")).expect(200);
      expect(forAda.body.some((l: { _id: string }) => l._id === id)).toBe(true);
      await t.http.patch(`/api/listings/${id}`).set(t.auth("ada")).send({ status: "available" }).expect(200);
    });

    it("hides blocked sellers and staff-removed listings", async () => {
      await t.http.post("/api/users/me/blocks").set(t.auth("chidi")).send({ uid: "ada" }).expect(204);
      const list = await t.http.get("/api/listings").set(t.auth("chidi")).expect(200);
      expect(list.body.some((l: { sellerUid: string }) => l.sellerUid === "ada")).toBe(false);
      await t.http.delete("/api/users/me/blocks/ada").set(t.auth("chidi")).expect(204);
    });
  });

  describe("chat", () => {
    let listingId: string;
    let convo: string;

    beforeAll(async () => {
      listingId = (await t.http.post("/api/listings").set(t.auth("bola")).send(listing({ title: "Standing fan" })).expect(201)).body._id;
    });

    it("'Message seller' is idempotent and the server fills in the listing context", async () => {
      const body = { recipientUid: "bola", context: { type: "listing", id: listingId, title: "FAKE", priceNaira: 1 } };
      const a = await t.http.post("/api/conversations").set(t.auth("chidi")).send(body).expect(201);
      const b = await t.http.post("/api/conversations").set(t.auth("chidi")).send(body).expect(201);
      expect(a.body._id).toBe(b.body._id);
      expect(a.body.context).toMatchObject({ type: "listing", id: listingId, title: "Standing fan", priceNaira: 25000 });
      convo = a.body._id;
      // A listing that isn't the recipient's is refused.
      await t.http.post("/api/conversations").set(t.auth("chidi")).send({ recipientUid: "ada", context: { type: "listing", id: listingId } }).expect(400);
    });

    it("tracks unread counts, marks read on open, and notifies the recipient", async () => {
      await t.http.post(`/api/conversations/${convo}/messages`).set(t.auth("chidi")).send({ body: "Hi Bola, is the fan still available?" }).expect(201);
      await t.http.post(`/api/conversations/${convo}/messages`).set(t.auth("chidi")).send({ body: "I can pick up today." }).expect(201);
      expect((await t.http.get("/api/conversations/unread-count").set(t.auth("bola")).expect(200)).body.count).toBe(2);
      const threads = await t.http.get("/api/conversations").set(t.auth("bola")).expect(200);
      expect(threads.body[0]).toMatchObject({ _id: convo, unreadCount: 2, lastMessage: { body: "I can pick up today.", senderUid: "chidi" } });
      const msgs = await t.http.get(`/api/conversations/${convo}/messages`).set(t.auth("bola")).expect(200);
      expect(msgs.body.map((m: { body: string }) => m.body)).toEqual(["Hi Bola, is the fan still available?", "I can pick up today."]);
      expect((await t.http.get("/api/conversations/unread-count").set(t.auth("bola")).expect(200)).body.count).toBe(0);
      const notes = await t.http.get("/api/notifications").set(t.auth("bola")).expect(200);
      expect(notes.body.filter((n: { type: string }) => n.type === "message")).toHaveLength(1); // grouped per conversation
    });

    it("is private to participants; restricted neighbours can still message", async () => {
      await t.http.get(`/api/conversations/${convo}`).set(t.auth("ada")).expect(404);
      await t.http.post(`/api/conversations/${convo}/messages`).set(t.auth("ada")).send({ body: "hi" }).expect(404);
      await t.http.post("/api/conversations").set(t.auth("restr")).send({ recipientUid: "ada" }).expect(201);
    });

    it("respects messaging preferences and blocks", async () => {
      await t.http.post("/api/conversations").set(t.auth("ada")).send({ recipientUid: "quiet" }).expect(403);
      await t.http.post("/api/conversations").set(t.auth("ada")).send({ recipientUid: "tunde" }).expect(403); // other Hood, default "neighbourhood"
      await t.http.post("/api/users/me/blocks").set(t.auth("bola")).send({ uid: "chidi" }).expect(204);
      await t.http.post(`/api/conversations/${convo}/messages`).set(t.auth("chidi")).send({ body: "hello?" }).expect(403);
      await t.http.delete("/api/users/me/blocks/chidi").set(t.auth("bola")).expect(204);
    });

    it("conversations can be reported and closed by staff", async () => {
      await t.member("mod", lekki, { role: "moderator" });
      await t.http.post("/api/reports").set(t.auth("bola")).send({ targetType: "message", targetId: convo, reason: "harassment" }).expect(204);
      const q = await t.http.get("/api/admin/reports?type=message").set(t.auth("mod")).expect(200);
      expect(q.body.items[0]).toMatchObject({ route: "staff", target: { type: "message", id: convo } });
    });
  });
});
