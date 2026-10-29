import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

interface View { _id: string; message: string; saved: boolean; following: boolean; shareCount: number; editedAt: string | null; savedAt?: string }

describe("Post menu: save, follow or mute, share, edit", () => {
  let t: TestApp;
  let hood: string;
  let other: string;
  let postId: string;

  beforeAll(async () => {
    t = await createTestApp();
    hood = await t.hood();
    other = await t.hood("Yaba", 3.3792, 6.5095);
    for (const uid of ["ada", "bola", "chidi", "dayo"]) await t.member(uid, hood);
    await t.member("emeka", other);
    postId = (await t.post("ada", { message: "Who fixes inverters?" }))._id;
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const get = async (uid: string, id = postId) => (await t.http.get(`/api/posts/${id}`).set(t.auth(uid)).expect(200)).body as View;
  const comment = (uid: string, content: string) => t.http.post(`/api/posts/${postId}/comments`).set(t.auth(uid)).send({ content }).expect(201);
  const notes = async (uid: string) => ((await t.http.get("/api/notifications").set(t.auth(uid)).expect(200)).body as { title: string }[]).map((n) => n.title);
  const saved = async (uid: string, q = "") => (await t.http.get(`/api/posts/saved${q}`).set(t.auth(uid)).expect(200)).body as View[];

  describe("save", () => {
    it("saves and unsaves, repeat-safe, and the post says so to its saver only", async () => {
      await t.http.put(`/api/posts/${postId}/save`).set(t.auth("bola")).expect(200, { saved: true });
      await t.http.put(`/api/posts/${postId}/save`).set(t.auth("bola")).expect(200, { saved: true });
      expect((await get("bola")).saved).toBe(true);
      expect((await get("chidi")).saved).toBe(false);
      expect((await saved("bola")).map((p) => p._id)).toEqual([postId]);

      await t.http.delete(`/api/posts/${postId}/save`).set(t.auth("bola")).expect(200, { saved: false });
      await t.http.delete(`/api/posts/${postId}/save`).set(t.auth("bola")).expect(200, { saved: false });
      expect(await saved("bola")).toEqual([]);
    });

    it("lists newest saved first, pages by savedAt, and leaves out posts that are gone", async () => {
      const a = (await t.post("chidi", { message: "First" }))._id;
      const b = (await t.post("chidi", { message: "Second" }))._id;
      const c = (await t.post("chidi", { message: "Third" }))._id;
      for (const id of [a, b, c]) await t.http.put(`/api/posts/${id}/save`).set(t.auth("dayo")).expect(200);

      const page1 = await saved("dayo", "?limit=2");
      expect(page1.map((p) => p._id)).toEqual([c, b]);
      expect((await saved("dayo", `?limit=2&before=${encodeURIComponent(page1[1]!.savedAt!)}`)).map((p) => p._id)).toEqual([a]);

      await t.http.delete(`/api/posts/${b}`).set(t.auth("chidi")).expect(204);
      expect((await saved("dayo")).map((p) => p._id)).toEqual([c, a]);
    });

    it("can't save a post outside your neighbourhoods", async () => {
      await t.http.put(`/api/posts/${postId}/save`).set(t.auth("emeka")).expect(404);
    });
  });

  describe("follow and mute", () => {
    it("the author follows their own post by default; others don't", async () => {
      expect((await get("ada")).following).toBe(true);
      expect((await get("chidi")).following).toBe(false);
    });

    it("followers hear about new comments, bundled per post", async () => {
      await t.http.put(`/api/posts/${postId}/follow`).set(t.auth("chidi")).send({ on: true }).expect(200, { following: true });
      expect((await get("chidi")).following).toBe(true);
      await comment("bola", "Musa on Road 4");
      await comment("dayo", "Emeka is good too");
      const mine = (await notes("chidi")).filter((n) => n.endsWith("commented on a post you follow"));
      expect(mine).toEqual(["dayo and bola commented on a post you follow"]);
      // The author still gets their own notice, not the follower one.
      expect(await notes("ada")).toContain("bola commented on your post");
    });

    it("a muted post tells its author nothing more; turning it back on resumes", async () => {
      await t.http.put(`/api/posts/${postId}/follow`).set(t.auth("ada")).send({ on: false }).expect(200, { following: false });
      expect((await get("ada")).following).toBe(false);
      const before = (await notes("ada")).length;
      await comment("chidi", "Bump");
      expect((await notes("ada")).length).toBe(before);

      await t.http.put(`/api/posts/${postId}/follow`).set(t.auth("ada")).send({ on: true }).expect(200);
      await comment("dayo", "Still need one?");
      expect(await notes("ada")).toContain("dayo commented on your post");
    });

    it("rejects a body without on, and posts outside your neighbourhoods", async () => {
      await t.http.put(`/api/posts/${postId}/follow`).set(t.auth("bola")).send({}).expect(400);
      await t.http.put(`/api/posts/${postId}/follow`).set(t.auth("emeka")).send({ on: true }).expect(404);
    });
  });

  describe("share", () => {
    it("counts each neighbour once, however often they share", async () => {
      const share = (uid: string) => t.http.post(`/api/posts/${postId}/share`).set(t.auth(uid)).expect(200);
      expect((await share("bola")).body).toEqual({ shareCount: 1 });
      expect((await share("bola")).body).toEqual({ shareCount: 1 });
      expect((await share("chidi")).body).toEqual({ shareCount: 2 });
      expect((await get("dayo")).shareCount).toBe(2);
    });
  });

  describe("edit", () => {
    it("the author changes the text; it's marked edited and the details stay", async () => {
      const event = (await t.post("ada", { message: "Street party", category: "event", eventDate: new Date(Date.now() + 86_400_000).toISOString(), eventLocation: "Road 4" }))._id;
      const res = (await t.http.patch(`/api/posts/${event}`).set(t.auth("ada")).send({ message: "  Street party, bring a dish  " }).expect(200)).body as View & { category: string; eventLocation: string; content: string };
      expect(res).toMatchObject({ message: "Street party, bring a dish", category: "event", eventLocation: "Road 4" });
      expect(res.editedAt).not.toBeNull();
      // Older clients decode `content`: it carries the new text too.
      expect(res.content).toContain("Street party, bring a dish");
      expect((await get("bola", event)).message).toBe("Street party, bring a dish");
    });

    it("unchanged text isn't an edit", async () => {
      const id = (await t.post("ada", { message: "Same words" }))._id;
      expect((await t.http.patch(`/api/posts/${id}`).set(t.auth("ada")).send({ message: "Same words" }).expect(200)).body.editedAt).toBeNull();
    });

    it("only the author, never empty or too long, and not once deleted", async () => {
      const id = (await t.post("ada", { message: "Mine" }))._id;
      await t.http.patch(`/api/posts/${id}`).set(t.auth("bola")).send({ message: "Hijacked" }).expect(403);
      await t.http.patch(`/api/posts/${id}`).set(t.auth("ada")).send({ message: "   " }).expect(400);
      await t.http.patch(`/api/posts/${id}`).set(t.auth("ada")).send({ message: "x".repeat(8193) }).expect(400);
      await t.http.patch(`/api/posts/${id}`).set(t.auth("ada")).send({ message: "Hi", category: "alert" }).expect(400);
      await t.http.delete(`/api/posts/${id}`).set(t.auth("ada")).expect(204);
      await t.http.patch(`/api/posts/${id}`).set(t.auth("ada")).send({ message: "Back" }).expect(404);
    });
  });
});
