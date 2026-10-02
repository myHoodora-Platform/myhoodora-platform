import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

describe("Moderation & engagement", () => {
  let t: TestApp;
  let lekki: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    for (const uid of ["ada", "bola", "chidi", "dayo"]) await t.member(uid, lekki);
    await t.member("mod1", lekki, { role: "moderator" });
    await t.member("mod2", lekki, { role: "moderator" });
    await t.member("admin1", lekki, { role: "admin" });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const feedIds = async (uid: string) =>
    ((await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth(uid)).expect(200)).body as { _id: string }[]).map((p) => p._id);

  it("posts carry each media item's shape, so the feed can frame it before it loads", async () => {
    const portraitVideo = "https://res.cloudinary.com/demo/video/upload/v1/myhoodora/test/post/clip.mp4";
    await t.model("MediaAsset").create({ ownerUid: "ada", provider: "cloudinary", providerId: "myhoodora/test/post/clip", resourceType: "video", purpose: "post", url: portraitVideo, bytes: 10, width: 1080, height: 1920 });
    const video = await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "A clip", mediaUrls: [portraitVideo] }).expect(201);
    expect(video.body.mediaAspects).toEqual([0.5625]);

    // A pasted link we never stored: shape unknown, the client measures it on load.
    const pasted = await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "A photo", mediaUrls: ["https://images.unsplash.com/photo-1.jpg"] }).expect(201);
    expect(pasted.body.mediaAspects).toEqual([null]);

    const feed = (await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("bola")).expect(200)).body as { _id: string; mediaAspects: unknown }[];
    expect(feed.find((p) => p._id === video.body._id)?.mediaAspects).toEqual([0.5625]);
    expect((await t.post("ada", { message: "No media" }) as unknown as { mediaAspects: unknown }).mediaAspects).toEqual([]);
  });

  describe("report → case → decision", () => {
    let postId: string;
    let caseId: string;

    it("reports are idempotent per reporter and grouped into one case", async () => {
      postId = (await t.post("ada", { message: "Buy cheap generators, DM me" }))._id;
      const report = (uid: string, reason = "scam") => t.http.post("/api/reports").set(t.auth(uid)).send({ targetType: "post", targetId: postId, reason });
      await report("bola").expect(204);
      await report("bola").expect(204);
      await report("chidi", "spam").expect(204);
      await t.http.post("/api/reports").set(t.auth("ada")).send({ targetType: "post", targetId: postId, reason: "spam" }).expect(400);

      const list = await t.http.get("/api/admin/reports?status=active").set(t.auth("mod1")).expect(200);
      const kase = list.body.items.find((r: { target: { id: string } }) => r.target.id === postId);
      expect(kase).toMatchObject({ reporterCount: 2, severity: "high", status: "open" });
      caseId = kase.id;
    });

    it("only one moderator can hold a claim", async () => {
      await t.http.post(`/api/admin/reports/${caseId}/claim`).set(t.auth("mod1")).expect(201);
      await t.http.post(`/api/admin/reports/${caseId}/claim`).set(t.auth("mod2")).expect(409);
    });

    it("moderators can't suspend from a report", async () => {
      await t.http.post(`/api/admin/reports/${caseId}/actions`).set(t.auth("mod1")).send({ action: "suspend_author", reason: "Scam" }).expect(403);
    });

    it("removing content hides it, audits it, notifies author and reporters, and can't be decided twice", async () => {
      expect(await feedIds("bola")).toContain(postId);
      const res = await t.http.post(`/api/admin/reports/${caseId}/actions`).set(t.auth("mod1")).send({ action: "remove_content", reason: "Scam", note: "internal" }).expect(201);
      expect(res.body.status).toBe("resolved");

      expect(await feedIds("bola")).not.toContain(postId);
      await t.http.get(`/api/posts/${postId}`).set(t.auth("bola")).expect(404);

      const audit = await t.http.get("/api/admin/audit").set(t.auth("admin1")).expect(200);
      expect(audit.body.items.some((e: { target: { id: string } }) => e.target.id === postId)).toBe(true);

      const authorNotes = (await t.http.get("/api/notifications").set(t.auth("ada")).expect(200)).body as { type: string; body: string }[];
      const note = authorNotes.find((n) => n.type === "moderation");
      expect(note).toBeTruthy();
      expect(note!.body).not.toContain("internal");
      const reporterNotes = (await t.http.get("/api/notifications").set(t.auth("bola")).expect(200)).body as { type: string }[];
      expect(reporterNotes.some((n) => n.type === "moderation")).toBe(true);

      await t.http.post(`/api/admin/reports/${caseId}/actions`).set(t.auth("admin1")).send({ action: "keep", reason: "Oops" }).expect(409);
    });

    it("admins can restore removed content", async () => {
      await t.http.post(`/api/admin/posts/${postId}/actions`).set(t.auth("admin1")).send({ action: "restore", reason: "Appeal upheld" }).expect(201);
      expect(await feedIds("bola")).toContain(postId);
    });
  });

  describe("reactions", () => {
    it("one reaction per person, switching type moves the count", async () => {
      const p = await t.post("ada", { message: "Who has a ladder?" });
      await t.http.put(`/api/posts/${p._id}/reaction`).set(t.auth("bola")).send({ type: "like" }).expect(200);
      await t.http.put(`/api/posts/${p._id}/reaction`).set(t.auth("bola")).send({ type: "like" }).expect(200);
      await t.http.put(`/api/posts/${p._id}/reaction`).set(t.auth("chidi")).send({ type: "helpful" }).expect(200);
      await t.http.put(`/api/posts/${p._id}/reaction`).set(t.auth("bola")).send({ type: "helpful" }).expect(200);

      const view = (await t.http.get(`/api/posts/${p._id}`).set(t.auth("bola")).expect(200)).body;
      expect(view.reactionCounts).toMatchObject({ helpful: 2 });
      expect(view.reactionCounts.like ?? 0).toBe(0);
      expect(view.myReaction).toBe("helpful");

      await t.http.delete(`/api/posts/${p._id}/reaction`).set(t.auth("bola")).expect((r) => expect([200, 204]).toContain(r.status));
      const after = (await t.http.get(`/api/posts/${p._id}`).set(t.auth("bola")).expect(200)).body;
      expect(after.reactionCounts.helpful).toBe(1);
      expect(after.myReaction ?? null).toBeNull();
    });

    it("concurrent likes don't lose updates", async () => {
      const p = await t.post("ada", { message: "Race me" });
      await Promise.all(["bola", "chidi", "dayo"].map((uid) => t.http.put(`/api/posts/${p._id}/reaction`).set(t.auth(uid)).send({ type: "like" })));
      const view = (await t.http.get(`/api/posts/${p._id}`).set(t.auth("ada")).expect(200)).body;
      expect(view.reactionCounts.like).toBe(3);
    });
  });

  describe("polls", () => {
    it("counts one vote per person and closes with 410", async () => {
      const closesAt = new Date(Date.now() + 86_400_000).toISOString();
      const p = await t.post("ada", { message: "Best time for the estate meeting?", category: "poll", poll: { options: [{ id: "a", text: "Sat" }, { id: "b", text: "Sun" }], closesAt } });
      await t.http.put(`/api/posts/${p._id}/poll/vote`).set(t.auth("bola")).send({ optionId: "a" }).expect(200);
      const r = await t.http.put(`/api/posts/${p._id}/poll/vote`).set(t.auth("bola")).send({ optionId: "b" }).expect(200);
      expect(r.body).toMatchObject({ total: 1, myVote: "b", counts: { b: 1 } });
      await t.http.put(`/api/posts/${p._id}/poll/vote`).set(t.auth("bola")).send({ optionId: "zzz" }).expect(400);

      await t.model("FeedPost").updateOne({ _id: p._id }, { $set: { "poll.closesAt": new Date(Date.now() - 1000).toISOString() } });
      await t.http.put(`/api/posts/${p._id}/poll/vote`).set(t.auth("chidi")).send({ optionId: "a" }).expect(410);
    });
  });

  describe("comments & blocks", () => {
    it("keeps commentCount in step and hides blocked people's comments", async () => {
      const p = await t.post("ada", { message: "Generator noise after 11pm" });
      const c = await t.http.post(`/api/posts/${p._id}/comments`).set(t.auth("bola")).send({ content: "Same here" }).expect(201);
      await t.http.post(`/api/posts/${p._id}/comments`).set(t.auth("chidi")).send({ content: "Talk to the chairman" }).expect(201);
      expect((await t.http.get(`/api/posts/${p._id}`).set(t.auth("ada")).expect(200)).body.commentCount).toBe(2);

      await t.http.delete(`/api/comments/${c.body._id}`).set(t.auth("chidi")).expect(403);
      await t.http.delete(`/api/comments/${c.body._id}`).set(t.auth("bola")).expect(204);
      expect((await t.http.get(`/api/posts/${p._id}`).set(t.auth("ada")).expect(200)).body.commentCount).toBe(1);

      await t.http.post("/api/users/me/blocks").set(t.auth("ada")).send({ uid: "chidi" }).expect((r) => expect([200, 201, 204]).toContain(r.status));
      const list = (await t.http.get(`/api/posts/${p._id}/comments`).set(t.auth("ada")).expect(200)).body as { authorUid: string }[];
      expect(list.some((x) => x.authorUid === "chidi")).toBe(false);
    });
  });

  describe("urgent alerts", () => {
    it("limits a neighbour to one urgent alert per 6 hours", async () => {
      const alert = { message: "Armed robbery reported on Admiralty Way", category: "alert", alertCategory: "security", urgent: true };
      await t.http.post("/api/posts").set(t.auth("dayo")).send(alert).expect(201);
      await t.http.post("/api/posts").set(t.auth("dayo")).send(alert).expect(429);
    });
  });
});
