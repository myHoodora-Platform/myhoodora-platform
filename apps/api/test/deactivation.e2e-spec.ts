import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * Audit B5, first step: the settings dialog promises "your profile and posts will be hidden from
 * neighbours". Deactivating used to hide the profile only: posts, listings and the name on every
 * comment stayed up.
 */
describe("Deactivating an account hides the person from their neighbours", () => {
  let t: TestApp;
  let lekki: string;
  let postId: string;
  let listingId: string;
  let groupId: string;
  let bolaPostId: string;
  let conversationId: string;

  /** A sign-in from after the deactivation (which ends every earlier session). */
  const fresh = (uid: string) => ({ Authorization: `Bearer t:${uid}:u:password:fresh` });
  const feed = async (uid: string) => (await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth(uid)).expect(200)).body as { _id: string; author: { displayName: string } }[];
  const deactivate = (uid: string, body: Record<string, unknown> = { reason: "privacy" }) => t.http.post("/api/users/me/deactivate").set(t.auth(uid)).send(body);

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    await t.member("ada", lekki, { displayName: "Ada Okafor", photoURL: "https://cdn.test/ada.jpg" });
    await t.member("bola", lekki, { displayName: "Bola Ade" });
    await t.member("admin1", lekki, { role: "admin" });

    postId = (await t.post("ada", { message: "Selling my generator, moving out soon" }))._id;
    listingId = (await t.http.post("/api/listings").set(t.auth("ada")).send({ title: "Standing fan", priceNaira: 20000, category: "home_appliances", condition: "good", photos: [] }).expect(201)).body._id;
    bolaPostId = (await t.post("bola", { message: "Anyone know a good plumber?" }))._id;
    await t.http.post(`/api/posts/${bolaPostId}/comments`).set(t.auth("ada")).send({ content: "Try Musa on Road 4" }).expect(201);
    groupId = (await t.http.post("/api/groups").set(t.auth("bola")).send({ name: "Road 12 Parents", description: "School runs and playdates.", category: "parents", privacy: "open", boundary: "neighbourhood" }).expect(201)).body._id;
    await t.http.post(`/api/groups/${groupId}/join`).set(t.auth("ada")).send({}).expect(200);
    await t.http.post(`/api/groups/${groupId}/posts`).set(t.auth("ada")).send({ content: "Who is doing the Friday run?" }).expect(201);
    conversationId = (await t.http.post("/api/conversations").set(t.auth("bola")).send({ recipientUid: "ada" }).expect(201)).body._id;
    await t.http.post(`/api/conversations/${conversationId}/messages`).set(t.auth("bola")).send({ body: "Is the fan still available?" }).expect(201);
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("before: neighbours see her posts, her listing and her name", async () => {
    expect((await feed("bola")).find((p) => p._id === postId)?.author.displayName).toBe("Ada Okafor");
    await t.http.get(`/api/listings/${listingId}`).set(t.auth("bola")).expect(200);
  });

  describe("once she deactivates", () => {
    beforeAll(async () => {
      await deactivate("ada", { reason: "privacy", details: "Too many strangers can see my street." }).expect(204);
    });

    it("her posts are gone from the feed, from search and by link", async () => {
      expect((await feed("bola")).map((p) => p._id)).toEqual([bolaPostId]);
      await t.http.get(`/api/posts/${postId}`).set(t.auth("bola")).expect(404);
      await t.http.get(`/api/posts/${postId}/comments`).set(t.auth("bola")).expect(404);
      expect((await t.http.get("/api/search?q=generator").set(t.auth("bola")).expect(200)).body.posts).toEqual([]);
    });

    it("her listings are gone from For Sale & Free and by link", async () => {
      expect((await t.http.get("/api/listings").set(t.auth("bola")).expect(200)).body).toEqual([]);
      await t.http.get(`/api/listings/${listingId}`).set(t.auth("bola")).expect(404);
      expect((await t.http.get("/api/search?q=fan").set(t.auth("bola")).expect(200)).body.listings).toEqual([]);
    });

    it("what she wrote in other people's threads stays, without her name or photo", async () => {
      const comments = (await t.http.get(`/api/posts/${bolaPostId}/comments`).set(t.auth("bola")).expect(200)).body as { content: string; author: Record<string, unknown> }[];
      expect(comments).toHaveLength(1);
      expect(comments[0]).toMatchObject({ content: "Try Musa on Road 4", author: { displayName: "Former neighbour" } });
      expect(comments[0]!.author.photoURL).toBeUndefined();

      const groupPosts = (await t.http.get(`/api/groups/${groupId}/posts`).set(t.auth("bola")).expect(200)).body as { author: Record<string, unknown> }[];
      expect(groupPosts[0]!.author).toMatchObject({ displayName: "Former neighbour" });
      expect(groupPosts[0]!.author.photoURL).toBeUndefined();

      const conversation = (await t.http.get(`/api/conversations/${conversationId}`).set(t.auth("bola")).expect(200)).body as { participants: { uid: string; displayName: string; photoURL?: string }[] };
      const her = conversation.participants.find((p) => p.uid === "ada")!;
      expect(her.displayName).toBe("Former neighbour");
      expect(her.photoURL).toBeUndefined();
      // Nothing a neighbour can fetch still carries her name.
      for (const path of [`/api/posts/${bolaPostId}/comments`, `/api/groups/${groupId}/posts`, `/api/groups/${groupId}/members`, "/api/conversations", `/api/posts/neighborhood/${lekki}`]) {
        expect(JSON.stringify((await t.http.get(path).set(t.auth("bola")).expect(200)).body)).not.toContain("Ada Okafor");
      }
    });

    it("her profile can't be opened and she can't be found or messaged", async () => {
      const gone = await t.http.get("/api/users/ada/public").set(t.auth("bola")).expect(410);
      expect(gone.body.message).toMatch(/deactivated/);
      const refused = await t.http.post("/api/conversations").set(t.auth("bola")).send({ recipientUid: "ada" }).expect(410);
      expect(refused.body.message).toMatch(/deactivated/);
      expect((await t.http.get("/api/users/search?q=Ada").set(t.auth("bola")).expect(200)).body).toEqual([]);
    });

    it("staff can still see the post and who wrote it (moderation doesn't stop because someone left)", async () => {
      const post = (await t.http.get(`/api/posts/${postId}`).set(t.auth("admin1")).expect(200)).body;
      expect(post.message).toBe("Selling my generator, moving out soon");
      const neighbour = (await t.http.get("/api/admin/neighbours/ada").set(t.auth("admin1")).expect(200)).body;
      expect(neighbour.displayName).toBe("Ada Okafor");
    });

    it("what she told us about leaving is kept, not thrown away", async () => {
      const record = await t.users.findOne({ uid: "ada" }).lean();
      expect(record?.deactivatedAt).toBeInstanceOf(Date);
      expect(record?.deactivation).toEqual({ reason: "privacy", details: "Too many strangers can see my street." });
    });

    it("every session she had is ended", async () => {
      await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("ada")).expect(401);
    });
  });

  describe("when she signs in again", () => {
    beforeAll(async () => {
      await t.http.get("/api/users/me").set(fresh("ada")).expect(200);
    });

    it("everything is back as it was, under her name", async () => {
      const posts = await feed("bola");
      expect(posts.find((p) => p._id === postId)?.author.displayName).toBe("Ada Okafor");
      await t.http.get(`/api/listings/${listingId}`).set(t.auth("bola")).expect(200);
      const comments = (await t.http.get(`/api/posts/${bolaPostId}/comments`).set(t.auth("bola")).expect(200)).body as { author: { displayName: string; photoURL?: string } }[];
      expect(comments[0]!.author).toMatchObject({ displayName: "Ada Okafor", photoURL: "https://cdn.test/ada.jpg" });
      await t.http.get("/api/users/ada/public").set(t.auth("bola")).expect(200);
    });

    it("the record no longer says she left", async () => {
      const record = await t.users.findOne({ uid: "ada" }).lean();
      expect(record?.deactivatedAt).toBeNull();
      expect(record?.deactivation ?? null).toBeNull();
    });

    it("she can post again, and that post is visible", async () => {
      const again = await t.http.post("/api/posts").set(fresh("ada")).send({ message: "Back in the neighbourhood" }).expect(201);
      expect((await feed("bola")).map((p) => p._id)).toContain(again.body._id);
    });
  });

  it("deactivating twice, or with nothing to hide, is fine", async () => {
    await t.member("quiet", lekki);
    await deactivate("quiet").expect(204);
    await t.http.post("/api/users/me/deactivate").set(fresh("quiet")).send({ reason: "other" }).expect(204);
  });
});
