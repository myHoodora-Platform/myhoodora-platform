import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Audit B8, B9, B11 and B20: four places where moderation quietly failed the person it was for. */
describe("Moderation: reports and appeals reach the people they are meant to", () => {
  let t: TestApp;
  let lekki: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    for (const uid of ["ada", "bola", "chidi", "dayo", "emeka"]) await t.member(uid, lekki);
    await t.member("mod1", lekki, { role: "moderator" });
    await t.member("mod2", lekki, { role: "moderator" });
    await t.member("admin1", lekki, { role: "admin" });
    await t.member("admin2", lekki, { role: "admin" });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  type Case = { id: string; status: string; route: string; reporterCount: number; resolution?: { action: string }; reopenedAt?: string; target: { id: string; authorUid?: string } };
  const report = (uid: string, targetType: string, targetId: string, reason = "spam") => t.http.post("/api/reports").set(t.auth(uid)).send({ targetType, targetId, reason });
  const caseFor = async (targetId: string, status = "all") =>
    ((await t.http.get(`/api/admin/reports?status=${status}`).set(t.auth("admin1")).expect(200)).body.items as Case[]).find((c) => c.target.id === targetId);
  const decide = (caseId: string, body: Record<string, unknown>, as = "mod1") => t.http.post(`/api/admin/reports/${caseId}/actions`).set(t.auth(as)).send(body);
  const notificationsOf = (uid: string) => t.model<{ uid: string; title: string; body?: string }>("Notification").find({ uid }).sort({ createdAt: -1 }).lean();

  describe("B8: a new report on something already decided comes back to the queue", () => {
    it("after the author was warned and the post stayed up, the next report reopens the case for staff", async () => {
      const post = await t.post("ada", { message: "Buy followers cheap, DM me" });
      await report("bola", "post", post._id).expect(204);
      const first = (await caseFor(post._id))!;
      await decide(first.id, { action: "warn_author", reason: "Advertising" }).expect(201);
      expect(await caseFor(post._id, "active")).toBeUndefined();

      // A week later someone else reports the same post, which is still up.
      await report("chidi", "post", post._id, "scam").expect(204);
      const reopened = (await caseFor(post._id, "active"))!;
      expect(reopened).toMatchObject({ id: first.id, status: "open", route: "staff", reporterCount: 2 });
      expect(reopened.reopenedAt).toEqual(expect.any(String));
      // The earlier decision is still on record…
      expect(reopened.resolution).toMatchObject({ action: "warn_author" });
      // …so the author can still see and appeal it while the case is open again.
      const mine = (await t.http.get("/api/moderation/my-decisions").set(t.auth("ada")).expect(200)).body as { caseId: string; action: string; canAppeal: boolean }[];
      expect(mine.find((d) => d.caseId === first.id)).toMatchObject({ action: "warn_author", canAppeal: true });
      await t.http.post(`/api/moderation/cases/${first.id}/appeals`).set(t.auth("ada")).send({ reason: "It was a joke between friends." }).expect(201);

      // And staff can decide it afresh.
      await decide(first.id, { action: "remove_content", reason: "Scam" }, "mod2").expect(201);
      expect((await caseFor(post._id))!).toMatchObject({ status: "resolved", resolution: { action: "remove_content" } });
    });

    it("content that was removed and later restored can be reported again", async () => {
      const post = await t.post("ada", { message: "The council is poisoning the water" });
      await report("bola", "post", post._id, "misinformation").expect(204);
      const kase = (await caseFor(post._id))!;
      await decide(kase.id, { action: "remove_content", reason: "Misinformation" }).expect(201);
      await t.http.post(`/api/admin/posts/${post._id}/actions`).set(t.auth("admin1")).send({ action: "restore", reason: "Reviewed again" }).expect(201);

      await report("chidi", "post", post._id, "misinformation").expect(204);
      expect(await caseFor(post._id, "active")).toMatchObject({ id: kase.id, status: "open" });
    });

    it("content that is still removed stays decided, and the same person reporting twice changes nothing", async () => {
      const post = await t.post("ada", { message: "Miracle cure, cash only" });
      await report("bola", "post", post._id, "scam").expect(204);
      const kase = (await caseFor(post._id))!;
      await decide(kase.id, { action: "remove_content", reason: "Scam" }).expect(201);
      // It is already down: another report (from someone who had it open) has nothing left to ask for.
      await report("chidi", "post", post._id, "scam").expect(204);
      expect((await caseFor(post._id))!.status).toBe("resolved");

      const other = await t.post("ada", { message: "Cheap generators" });
      await report("bola", "post", other._id).expect(204);
      await decide((await caseFor(other._id))!.id, { action: "warn_author", reason: "Advertising" }).expect(201);
      await report("bola", "post", other._id).expect(204);
      expect((await caseFor(other._id))!.status).toBe("resolved");
    });
  });

  describe("B9: someone who is suspended can see why, and appeal", () => {
    it("reads the decision and their notifications, files an appeal, and an admin overturning it reinstates them", async () => {
      const post = await t.post("dayo", { message: "I know where you live" });
      await report("bola", "post", post._id, "harassment").expect(204);
      const kase = (await caseFor(post._id))!;
      await decide(kase.id, { action: "suspend_author", reason: "Threatening a neighbour" }, "admin1").expect(201);
      expect((await t.users.findOne({ uid: "dayo" }).lean())?.accountStatus).toBe("suspended");

      // Still shut out of the app itself.
      await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("dayo")).expect(403);
      await t.http.post("/api/posts").set(t.auth("dayo")).send({ message: "hello" }).expect(403);

      const notes = (await t.http.get("/api/notifications").set(t.auth("dayo")).expect(200)).body as { title: string }[];
      expect(notes.some((n) => /suspended/i.test(n.title))).toBe(true);
      expect((await t.http.get("/api/notifications/unread-count").set(t.auth("dayo")).expect(200)).body).toEqual(expect.objectContaining({ count: expect.any(Number) }));

      const mine = (await t.http.get("/api/moderation/my-decisions").set(t.auth("dayo")).expect(200)).body as { caseId: string; action: string; canAppeal: boolean }[];
      expect(mine).toEqual([expect.objectContaining({ caseId: kase.id, action: "suspend_author", canAppeal: true })]);
      await t.http.post(`/api/moderation/cases/${kase.id}/appeals`).set(t.auth("dayo")).send({ reason: "It was a quote from a film, taken out of context." }).expect(201);
      // Only their own case: someone else's is still not theirs to appeal.
      await t.http.post(`/api/moderation/cases/${kase.id}/appeals`).set(t.auth("emeka")).send({ reason: "Let him back in, he is harmless." }).expect(404);

      const appeal = ((await t.http.get("/api/admin/appeals?status=open").set(t.auth("admin2")).expect(200)).body.items as { id: string; caseId: string }[]).find((a) => a.caseId === kase.id)!;
      await t.http.post(`/api/admin/appeals/${appeal.id}/decide`).set(t.auth("admin2")).send({ outcome: "overturned", reason: "Context checks out." }).expect(200);
      expect((await t.users.findOne({ uid: "dayo" }).lean())?.accountStatus).toBe("active");
      await t.http.get(`/api/posts/neighborhood/${lekki}`).set(t.auth("dayo")).expect(200);
    });
  });

  describe("B11: either person in a conversation can report it; nobody else can", () => {
    let conversationId: string;
    beforeAll(async () => {
      conversationId = (await t.http.post("/api/conversations").set(t.auth("bola")).send({ recipientUid: "emeka" }).expect(201)).body._id;
      await t.http.post(`/api/conversations/${conversationId}/messages`).set(t.auth("bola")).send({ body: "Is the fridge still for sale?" }).expect(201);
      await t.http.post(`/api/conversations/${conversationId}/messages`).set(t.auth("emeka")).send({ body: "Send your bank PIN and I'll hold it for you." }).expect(201);
    });
    const reportsOn = () => t.model<{ reporterUid: string; reportedUid?: string }>("Report").find({ targetType: "message", targetId: conversationId }).lean();

    it("an outsider who has learned the conversation's id can't report it (and so can't expose it to staff)", async () => {
      await report("chidi", "message", conversationId, "scam").expect(404);
      expect(await reportsOn()).toEqual([]);
      expect(await caseFor(conversationId)).toBeUndefined();
    });

    it("the person who started it can report it, and the report is about the other person", async () => {
      await report("bola", "message", conversationId, "scam").expect(204);
      expect(await reportsOn()).toEqual([expect.objectContaining({ reporterUid: "bola", reportedUid: "emeka" })]);
      // The case is about the person reported, so "warn the author" reaches the right one.
      expect((await caseFor(conversationId))!.target.authorUid).toBe("emeka");
    });

    it("the other person can report it too; each report records who it is about, and staff see that", async () => {
      await report("emeka", "message", conversationId, "harassment").expect(204);
      const rows = await reportsOn();
      expect(rows.map((r) => [r.reporterUid, r.reportedUid]).sort()).toEqual([["bola", "emeka"], ["emeka", "bola"]]);

      const kase = (await caseFor(conversationId))!;
      const detail = (await t.http.get(`/api/admin/reports/${kase.id}`).set(t.auth("mod1")).expect(200)).body as { reports: { reporter: { uid: string }; reported?: { uid: string } }[] };
      expect(detail.reports.map((r) => [r.reporter.uid, r.reported?.uid]).sort()).toEqual([["bola", "emeka"], ["emeka", "bola"]]);
    });

    it("reporting your own post is still refused", async () => {
      const post = await t.post("bola", { message: "My own words" });
      await report("bola", "post", post._id).expect(400);
    });
  });

  describe("B20: overturning a 'keep' tells the author and gives them something to appeal", () => {
    it("the case records the removal, the author is told, and can appeal it to someone who didn't remove it", async () => {
      const post = await t.post("chidi", { message: "Abuja house prices are falling fast" });
      await report("bola", "post", post._id, "not_local").expect(204);
      const kase = (await caseFor(post._id))!;
      await decide(kase.id, { action: "keep", reason: "Relevant to the Hood" }, "mod1").expect(201);
      await t.http.post(`/api/moderation/cases/${kase.id}/appeals`).set(t.auth("bola")).send({ reason: "It's about Abuja, not our Hood." }).expect(201);
      const appeal = ((await t.http.get("/api/admin/appeals?status=open").set(t.auth("mod2")).expect(200)).body.items as { id: string; caseId: string }[]).find((a) => a.caseId === kase.id)!;
      await t.model("Notification").deleteMany({ uid: "chidi" });

      await t.http.post(`/api/admin/appeals/${appeal.id}/decide`).set(t.auth("mod2")).send({ outcome: "overturned", reason: "Not about this neighbourhood." }).expect(200);

      // The post is gone for neighbours…
      await t.http.get(`/api/posts/${post._id}`).set(t.auth("bola")).expect(404);
      // …the case now says what was done, by whom…
      expect((await caseFor(post._id))!).toMatchObject({ status: "resolved", resolution: { action: "remove_content" } });
      // …the author is told, in the usual words…
      const told = await notificationsOf("chidi");
      expect(told).toEqual([expect.objectContaining({ title: "Your post was removed", body: expect.stringMatching(/appeal within 30 days/) })]);
      // …and has a decision of their own to appeal.
      const mine = (await t.http.get("/api/moderation/my-decisions").set(t.auth("chidi")).expect(200)).body as { caseId: string; action: string; canAppeal: boolean }[];
      expect(mine.find((d) => d.caseId === kase.id)).toMatchObject({ action: "remove_content", canAppeal: true });
      await t.http.post(`/api/moderation/cases/${kase.id}/appeals`).set(t.auth("chidi")).send({ reason: "Plenty of us here own property in Abuja." }).expect(201);

      // Reviewed by someone other than the person who removed it.
      const authorAppeal = ((await t.http.get("/api/admin/appeals?status=open").set(t.auth("mod1")).expect(200)).body.items as { id: string; caseId: string; party: string }[]).find((a) => a.caseId === kase.id && a.party === "author")!;
      await t.http.post(`/api/admin/appeals/${authorAppeal.id}/decide`).set(t.auth("mod2")).send({ outcome: "overturned", reason: "Changed my mind." }).expect(403);
      await t.http.post(`/api/admin/appeals/${authorAppeal.id}/decide`).set(t.auth("mod1")).send({ outcome: "overturned", reason: "On reflection it is relevant." }).expect(200);
      await t.http.get(`/api/posts/${post._id}`).set(t.auth("bola")).expect(200);
    });
  });
});
