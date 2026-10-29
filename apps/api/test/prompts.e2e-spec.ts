import { JobsService } from "../src/jobs/jobs.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

interface Signal {
  prompt: { _id: string; kind: string; question: string; contextKey?: string; thanksMessage: string } | null;
  storeReview: boolean;
}

describe("Feedback prompts and store reviews", () => {
  let t: TestApp;
  let lekki: string;
  let wuse: string;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    wuse = await t.hood("Wuse", 7.4613, 9.0765);
    await t.hoods.updateOne({ _id: wuse }, { $set: { city: "Abuja" } });
    const longAgo = new Date(Date.now() - 60 * 86_400_000);
    await t.member("boss", lekki, { role: "admin" });
    await t.member("mod", lekki, { role: "moderator" });
    for (const uid of ["ada", "bola", "chidi", "dayo", "efe", "fola"]) await t.member(uid, lekki, { createdAt: longAgo } as never);
    await t.member("emeka", wuse, { createdAt: longAgo } as never);
    // No store reviews in these tests unless a test turns them on.
    await t.http.patch("/api/admin/prompts/settings").set(t.auth("boss")).send({ storeReviewEnabled: false, cooldownDays: 0 }).expect(200);
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const admin = () => t.auth("boss");
  const create = (body: Record<string, unknown>) => t.http.post("/api/admin/prompts").set(admin()).send(body);
  const live = async (body: Record<string, unknown>) => {
    const id = (await create(body).expect(201)).body._id as string;
    await t.http.put(`/api/admin/prompts/${id}/status`).set(admin()).send({ status: "active" }).expect(200);
    return id;
  };
  const pause = (id: string) => t.http.put(`/api/admin/prompts/${id}/status`).set(admin()).send({ status: "paused" }).expect(200);
  const signal = async (uid: string, key: string, subjectId?: string) => (await t.http.post("/api/engagement/signal").set(t.auth(uid)).send({ key, subjectId }).expect(200)).body as Signal;
  const respond = (uid: string, id: string, body: Record<string, unknown>) => t.http.post(`/api/prompts/${id}/respond`).set(t.auth(uid)).send(body);
  const stars = { title: "Selling", kind: "stars", question: "How was selling on For Sale?", triggerType: "action", triggerKey: "listing_sold" };

  it("only admins write prompts or change the settings (403)", async () => {
    for (const uid of ["ada", "mod"]) {
      await t.http.get("/api/admin/prompts").set(t.auth(uid)).expect(403);
      await t.http.post("/api/admin/prompts").set(t.auth(uid)).send(stars).expect(403);
      await t.http.patch("/api/admin/prompts/settings").set(t.auth(uid)).send({ cooldownDays: 1 }).expect(403);
    }
  });

  it("checks what a prompt needs", async () => {
    await create({ ...stars, triggerKey: undefined }).expect(400);
    await create({ ...stars, triggerKey: "search" }).expect(400);
    await create({ title: "Poll", kind: "poll", question: "Next?", triggerType: "open", options: [{ id: "a", label: "Only one" }] }).expect(400);
    await create({ ...stars, push: true }).expect(400);
  });

  it("shows after the action, once answered never again; answers are checked against the kind", async () => {
    const id = await live({ ...stars, thanksMessage: "Thanks for selling with neighbours!" });
    const s = await signal("ada", "listing_sold", "listing-1");
    expect(s.prompt).toMatchObject({ _id: id, kind: "stars", contextKey: "listing_sold" });
    expect(s.prompt).not.toHaveProperty("hoodIds");
    await t.http.post(`/api/prompts/${id}/shown`).set(t.auth("ada")).expect(200);
    await respond("ada", id, { value: 6 }).expect(400);
    expect((await respond("ada", id, { value: 4, comment: "Quick and easy", contextKey: "listing_sold", subjectId: "listing-1" }).expect(200)).body).toEqual({ thanks: "Thanks for selling with neighbours!" });
    await respond("ada", id, { value: 5 }).expect(409);
    expect((await signal("ada", "listing_sold")).prompt).toBeNull();
    await pause(id);
  });

  it("after the Nth use of a feature; a closed prompt comes back at most maxShows times", async () => {
    const id = await live({ title: "Search", kind: "thumbs", question: "Did search find what you wanted?", triggerType: "feature", triggerKey: "search", triggerCount: 3, maxShows: 2, commentMode: "off" });
    expect((await signal("bola", "search")).prompt).toBeNull();
    expect((await signal("bola", "search")).prompt).toBeNull();
    for (let i = 0; i < 2; i++) {
      expect((await signal("bola", "search")).prompt?._id).toBe(id);
      await t.http.post(`/api/prompts/${id}/shown`).set(t.auth("bola")).expect(200);
      await t.http.post(`/api/prompts/${id}/dismiss`).set(t.auth("bola")).expect(200);
    }
    expect((await signal("bola", "search")).prompt).toBeNull();
    await respond("chidi", id, { value: 1, comment: "no comments here" }).expect(400);
    await pause(id);
  });

  it("the cooldown spaces prompts out for each person", async () => {
    await t.http.patch("/api/admin/prompts/settings").set(admin()).send({ cooldownDays: 14 }).expect(200);
    const a = await live({ ...stars, title: "A", triggerKey: "post_created" });
    const b = await live({ ...stars, title: "B", triggerKey: "comment_created" });
    expect((await signal("chidi", "post_created")).prompt?._id).toBe(a);
    await t.http.post(`/api/prompts/${a}/shown`).set(t.auth("chidi")).expect(200);
    expect((await signal("chidi", "comment_created")).prompt).toBeNull();
    await t.http.patch("/api/admin/prompts/settings").set(admin()).send({ cooldownDays: 0 }).expect(200);
    expect((await signal("chidi", "comment_created")).prompt?._id).toBe(b);
    await pause(a);
    await pause(b);
  });

  it("audience: neighbourhoods and cities", async () => {
    const id = await live({ title: "Abuja", kind: "open", question: "What would help your estate?", triggerType: "open", cities: ["Abuja"] });
    expect((await signal("dayo", "app_open")).prompt).toBeNull();
    expect((await signal("emeka", "app_open")).prompt?._id).toBe(id);
    await respond("emeka", id, {}).expect(400);
    await respond("emeka", id, { comment: "Street lights on Road 2" }).expect(200);
    await pause(id);
  });

  it("a manual prompt shows on the next app open once sent (skipping the cooldown), with a push to its audience", async () => {
    await t.http.patch("/api/admin/prompts/settings").set(admin()).send({ cooldownDays: 30 }).expect(200);
    const id = (await create({ title: "NPS", kind: "nps", question: "How likely are you to recommend myHoodora to a neighbour?", triggerType: "manual", push: true, hoodIds: [lekki] }).expect(201)).body._id as string;
    await t.http.put(`/api/admin/prompts/${id}/status`).set(admin()).send({ status: "active" }).expect(200);
    expect((await signal("dayo", "app_open")).prompt).toBeNull();
    await t.http.post(`/api/admin/prompts/${id}/send`).set(admin()).expect(200);
    await t.http.post(`/api/admin/prompts/${id}/send`).set(admin()).expect(409);
    // dayo was shown another prompt recently: a manual one still comes through.
    expect((await signal("dayo", "app_open")).prompt?._id).toBe(id);
    expect((await t.http.get(`/api/prompts/${id}`).set(t.auth("efe")).expect(200)).body.kind).toBe("nps");
    for (const [uid, v] of [["dayo", 10], ["efe", 9], ["fola", 3], ["bola", 7]] as const) await respond(uid, id, { value: v }).expect(200);
    await t.http.get(`/api/prompts/${id}`).set(t.auth("efe")).expect(409);
    // The push reached Lekki's neighbours (opening the prompt), not Wuse's.
    await t.app.get(JobsService).drain();
    const pushed = await t.model<{ uid: string }>("Notification").find({ href: `/feedback/${id}` }).lean();
    expect(pushed.map((n) => n.uid)).toContain("dayo");
    expect(pushed.map((n) => n.uid)).not.toContain("emeka");
    const results = (await t.http.get(`/api/admin/prompts/${id}/results`).set(admin()).expect(200)).body;
    expect(results).toMatchObject({ responses: 4, nps: { promoters: 2, passives: 1, detractors: 1, score: 25 } });
    await t.http.patch("/api/admin/prompts/settings").set(admin()).send({ cooldownDays: 0 }).expect(200);
  });

  it("results: average, distribution, comments with who and where; CSV export", async () => {
    const id = await live({ ...stars, title: "Events", triggerKey: "event_rsvp" });
    await respond("bola", id, { value: 5, comment: "=SUM(A1)" }).expect(200);
    await respond("chidi", id, { value: 3 }).expect(200);
    const r = (await t.http.get(`/api/admin/prompts/${id}/results`).set(admin()).expect(200)).body;
    expect(r).toMatchObject({ responses: 2, average: 4, distribution: { "5": 1, "3": 1 } });
    expect(r.comments).toEqual([expect.objectContaining({ comment: "=SUM(A1)", name: "bola", hood: "Lekki Phase 1", value: 5 })]);
    const csv = (await t.http.get(`/api/admin/prompts/${id}/export.csv`).set(admin()).expect(200)).text;
    expect(csv.split("\n")).toHaveLength(3);
    expect(csv).toContain(`"'=SUM(A1)"`);
    await pause(id);
  });

  it("once answered, the question can't be changed (results must mean one thing)", async () => {
    const id = await live({ ...stars, title: "Fixed", triggerKey: "message_sent" });
    await respond("dayo", id, { value: 4 }).expect(200);
    await t.http.patch(`/api/admin/prompts/${id}`).set(admin()).send({ question: "Something else?" }).expect(409);
    await t.http.patch(`/api/admin/prompts/${id}`).set(admin()).send({ thanksMessage: "Cheers" }).expect(200);
    await pause(id);
  });

  it("asks for a store review exactly at a milestone, once settled in, and not again for months", async () => {
    await t.http.patch("/api/admin/prompts/settings").set(admin()).send({ storeReviewEnabled: true, storeReviewMilestones: [{ key: "post_created", count: 2 }], storeReviewMinDaysSinceJoin: 7 }).expect(200);
    expect((await signal("fola", "post_created")).storeReview).toBe(false);
    expect((await signal("fola", "post_created")).storeReview).toBe(true);
    expect((await signal("fola", "post_created")).storeReview).toBe(false);
    await t.http.patch("/api/admin/prompts/settings").set(admin()).send({ storeReviewEnabled: false }).expect(200);
  });
});
