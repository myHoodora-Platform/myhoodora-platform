import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

describe("Hood Leads, appeals and kindness telemetry", () => {
  let t: TestApp;
  let lekki: string;
  const feed = async (uid: string) => ((await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth(uid)).expect(200)).body as { _id: string }[]).map((p) => p._id);
  const report = (uid: string, postId: string, reason = "spam") => t.http.post("/api/reports").set(t.auth(uid)).send({ targetType: "post", targetId: postId, reason }).expect(204);
  const caseOf = async (postId: string) => ((await t.http.get("/api/admin/reports?status=all").set(t.auth("admin1")).expect(200)).body.items as { id: string; route: string; status: string; target: { id: string } }[]).find((c) => c.target.id === postId)!;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    for (const uid of ["ada", "bola", "l1", "l2", "l3", "l4"]) await t.member(uid, lekki);
    await t.member("mod1", lekki, { role: "moderator" });
    await t.member("mod2", lekki, { role: "moderator" });
    await t.member("admin1", lekki, { role: "admin" });
    await t.user("outsider");
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  describe("appointing Leads", () => {
    it("admins only; Leads must be verified neighbours of the Hood", async () => {
      await t.http.put(`/api/admin/hoods/${lekki}/leads`).set(t.auth("mod1")).send({ uids: ["l1"] }).expect(403);
      await t.http.put(`/api/admin/hoods/${lekki}/leads`).set(t.auth("admin1")).send({ uids: ["l1", "outsider"] }).expect(400);
      const res = await t.http.put(`/api/admin/hoods/${lekki}/leads`).set(t.auth("admin1")).send({ uids: ["l1", "l2", "l3", "l4"] }).expect(200);
      expect(res.body.map((l: { uid: string }) => l.uid)).toEqual(["l1", "l2", "l3", "l4"]);
      expect((await t.http.get("/api/moderation/lead/status").set(t.auth("l1")).expect(200)).body).toMatchObject({ isLead: true });
      expect((await t.http.get("/api/moderation/lead/status").set(t.auth("ada")).expect(200)).body.isLead).toBe(false);
      await t.http.get("/api/moderation/lead/queue").set(t.auth("ada")).expect(403);
    });
  });

  describe("routing and voting", () => {
    let spamPost: string;

    it("low-risk content goes to the Leads; high-risk reasons go to staff", async () => {
      spamPost = (await t.post("ada", { message: "BUY FOLLOWERS CHEAP!!!" }))._id;
      await report("bola", spamPost);
      expect((await caseOf(spamPost)).route).toBe("leads");
      const scam = (await t.post("ada", { message: "Send ₦5k to unlock free generator" }))._id;
      await report("bola", scam, "scam");
      expect((await caseOf(scam)).route).toBe("staff");
    });

    it("Leads don't see their own reports or content", async () => {
      const q1 = await t.http.get("/api/moderation/lead/queue").set(t.auth("l1")).expect(200);
      expect(q1.body.map((c: { target: { id: string } }) => c.target.id)).toContain(spamPost);
      expect(JSON.stringify(q1.body)).not.toContain("bola"); // reporters are never shown
      const own = (await t.post("l4", { message: "My own post" }))._id;
      await report("bola", own);
      const q4 = await t.http.get("/api/moderation/lead/queue").set(t.auth("l4")).expect(200);
      expect(q4.body.map((c: { target: { id: string } }) => c.target.id)).not.toContain(own);
      const c = await caseOf(own);
      await t.http.post(`/api/moderation/cases/${c.id}/votes`).set(t.auth("l4")).send({ vote: "keep" }).expect(403);
    });

    it("three votes with a two-thirds majority decide, through the normal enforcement path", async () => {
      const c = await caseOf(spamPost);
      await t.http.post(`/api/moderation/cases/${c.id}/votes`).set(t.auth("l1")).send({ vote: "remove" }).expect(200);
      expect((await t.http.post(`/api/moderation/cases/${c.id}/votes`).set(t.auth("l2")).send({ vote: "remove" }).expect(200)).body.decided).toBe(false);
      const third = await t.http.post(`/api/moderation/cases/${c.id}/votes`).set(t.auth("l3")).send({ vote: "maybe_remove" }).expect(200);
      expect(third.body.decided).toBe(true);
      expect(await feed("bola")).not.toContain(spamPost);
      const detail = await t.http.get(`/api/admin/reports/${c.id}`).set(t.auth("admin1")).expect(200);
      expect(detail.body).toMatchObject({ status: "resolved", resolution: { action: "remove_content", by: "Hood Leads (consensus)" }, leadVotes: { total: 3, remove: 2 } });
      await t.http.post(`/api/moderation/cases/${c.id}/votes`).set(t.auth("l4")).send({ vote: "keep" }).expect(409);
    });

    it("no consensus within 48 h escalates to staff", async () => {
      const p = (await t.post("ada", { message: "Selling puppies, DM" }))._id;
      await report("bola", p);
      const c = await caseOf(p);
      await t.model("ModerationCase").updateOne({ _id: c.id }, { $set: { routedToLeadsAt: new Date(Date.now() - 49 * 3_600_000) } });
      await t.http.get("/api/moderation/lead/queue").set(t.auth("l1")).expect(200);
      expect(await caseOf(p)).toMatchObject({ route: "staff", status: "escalated" });
    });
  });

  describe("appeals", () => {
    let caseId: string;
    let postId: string;

    it("the author sees the decision and can appeal once, within 30 days", async () => {
      postId = (await t.post("ada", { message: "Honest review of the estate plumber" }))._id;
      await t.http.put(`/api/admin/hoods/${lekki}/leads`).set(t.auth("admin1")).send({ uids: [] }).expect(200); // staff route
      await report("bola", postId, "misinformation");
      caseId = (await caseOf(postId)).id;
      await t.http.post(`/api/admin/reports/${caseId}/actions`).set(t.auth("mod1")).send({ action: "remove_content", reason: "Misinformation" }).expect(201);
      const mine = await t.http.get("/api/moderation/my-decisions").set(t.auth("ada")).expect(200);
      expect(mine.body.find((d: { caseId: string }) => d.caseId === caseId)).toMatchObject({ role: "author", action: "remove_content", canAppeal: true });
      await t.http.post(`/api/moderation/cases/${caseId}/appeals`).set(t.auth("l1")).send({ reason: "I think this is unfair to her." }).expect(404);
      await t.http.post(`/api/moderation/cases/${caseId}/appeals`).set(t.auth("ada")).send({ reason: "It was a genuine review, not misinformation." }).expect(201);
      await t.http.post(`/api/moderation/cases/${caseId}/appeals`).set(t.auth("ada")).send({ reason: "It was a genuine review, not misinformation." }).expect(409);
    });

    it("is reviewed by someone else, and an overturn restores the content", async () => {
      const list = await t.http.get("/api/admin/appeals?status=open").set(t.auth("mod2")).expect(200);
      const appeal = list.body.items.find((a: { caseId: string }) => a.caseId === caseId);
      expect(appeal).toMatchObject({ party: "author", by: { uid: "ada" }, decision: { action: "remove_content" } });
      await t.http.post(`/api/admin/appeals/${appeal.id}/decide`).set(t.auth("mod1")).send({ outcome: "overturned", reason: "Fair review" }).expect(403);
      await t.http.post(`/api/admin/appeals/${appeal.id}/decide`).set(t.auth("mod2")).send({ outcome: "overturned", reason: "It's a fair review." }).expect(200);
      expect(await feed("bola")).toContain(postId);
      const mine = await t.http.get("/api/moderation/my-decisions").set(t.auth("ada")).expect(200);
      expect(mine.body.find((d: { caseId: string }) => d.caseId === caseId).appeal).toMatchObject({ status: "overturned" });
    });

    it("reporters can appeal a 'keep'", async () => {
      const p = (await t.post("ada", { message: "Fuel scarcity again, abeg" }))._id;
      await report("bola", p, "not_local");
      const c = (await caseOf(p)).id;
      await t.http.post(`/api/admin/reports/${c}/actions`).set(t.auth("mod1")).send({ action: "keep", reason: "Relevant to the Hood" }).expect(201);
      const mine = await t.http.get("/api/moderation/my-decisions").set(t.auth("bola")).expect(200);
      expect(mine.body.find((d: { caseId: string }) => d.caseId === c)).toMatchObject({ role: "reporter", action: "keep", canAppeal: true });
      await t.http.post(`/api/moderation/cases/${c}/appeals`).set(t.auth("bola")).send({ reason: "It's about Abuja, not our Hood." }).expect(201);
    });
  });

  it("kindness reminders are counted anonymously for insights", async () => {
    await t.http.post("/api/telemetry/kindness").set(t.auth("ada")).send({}).expect(204);
    await t.http.post("/api/telemetry/kindness").set(t.auth("ada")).send({ outcome: "edited" }).expect(204);
    const insights = await t.http.get("/api/admin/insights").set(t.auth("admin1")).expect(200);
    expect(insights.body.kindnessPrompts).toBe(1);
  });
});
