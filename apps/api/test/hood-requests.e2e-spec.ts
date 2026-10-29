import { JobsService } from "../src/jobs/jobs.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const LEKKI = { lng: 3.4746, lat: 6.4478 };
const YABA = { lng: 3.3711, lat: 6.5095 };

/**
 * Neighbourhood requests (contract §31): secondary Hoods are read and alerts only, at most two, and
 * only staff add them, move anyone, or take them away.
 */
describe("Secondary neighbourhoods and move requests", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  let ikeja: string;
  let surulere: string;
  let yabaPost: string;

  const as = (uid: string) => t.auth(uid);
  const ask = (uid: string, body: Record<string, unknown>) => t.http.post("/api/users/me/hood-requests").set(as(uid)).send(body);
  const queue = async (by = "admin1", query = "") => (await t.http.get(`/api/admin/hood-requests${query}`).set(as(by)).expect(200)).body as { items: { id: string; neighbour: { uid: string }; kind: string; address?: string; hood: { id: string } | null }[] };
  const requestOf = async (uid: string, kind = "secondary") => (await queue("admin1", `?kind=${kind}`)).items.find((r) => r.neighbour.uid === uid)!;
  const approve = (id: string, body: Record<string, unknown> = {}, by = "admin1") => t.http.post(`/api/admin/hood-requests/${id}/approve`).set(as(by)).send(body);
  const notes = (uid: string) => t.model<{ uid: string; title: string }>("Notification").find({ uid }).lean();

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1", LEKKI.lng, LEKKI.lat, 2000);
    yaba = await t.hood("Yaba", YABA.lng, YABA.lat, 1500);
    ikeja = await t.hood("Ikeja", 3.3515, 6.6018, 1500);
    surulere = await t.hood("Surulere", 3.3582, 6.5005, 1000);
    for (const uid of ["ada", "bola", "chidi", "dayo"]) await t.member(uid, lekki);
    await t.member("yemi", yaba);
    await t.member("admin1", lekki, { role: "admin" });
    await t.member("mod1", lekki, { role: "moderator" });
    await t.user("newbie");
    yabaPost = (await t.post("yemi", { message: "Market day on Herbert Macaulay" }))._id;
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("is for verified neighbours only, with a reason", async () => {
    await ask("newbie", { kind: "secondary", hoodId: yaba, reason: "I work at the tech hub there." }).expect(403);
    await ask("ada", { kind: "secondary", hoodId: yaba, reason: "short" }).expect(400);
    await ask("ada", { kind: "secondary", hoodId: lekki, reason: "That's where I already live, oops." }).expect(400);
  });

  it("approved: reads the Hood and its comments, hears its alerts, but can't write there", async () => {
    await ask("ada", { kind: "secondary", hoodId: yaba, reason: "I work at the tech hub in Yaba." }).expect(201);
    // Not before staff say yes.
    await t.http.get(`/api/posts/neighborhood/${yaba}`).set(as("ada")).expect(404);

    const req = await requestOf("ada");
    // Moderators review requests too.
    await approve(req.id, { note: "Welcome!" }, "mod1").expect(204);

    expect((await t.http.get(`/api/posts/neighborhood/${yaba}`).set(as("ada")).expect(200)).body).toHaveLength(1);
    await t.http.get(`/api/posts/${yabaPost}`).set(as("ada")).expect(200);
    await t.http.get(`/api/posts/${yabaPost}/comments`).set(as("ada")).expect(200);
    // Writing stays at home.
    await t.http.post(`/api/posts/${yabaPost}/comments`).set(as("ada")).send({ content: "Nice" }).expect(404);
    await t.http.put(`/api/posts/${yabaPost}/reaction`).set(as("ada")).send({ type: "like" }).expect(404);
    await t.http.post("/api/posts").set(as("ada")).send({ message: "Hello Yaba", neighborhoodId: yaba }).expect(403);

    const me = (await t.http.get("/api/users/me").set(as("ada")).expect(200)).body;
    expect(me.secondaryHoods).toEqual([expect.objectContaining({ id: yaba, name: "Yaba" })]);
    expect(me.neighborhoodId).toBe(lekki);
    expect((await notes("ada")).map((n) => n.title)).toContain("You can now follow Yaba");

    // A Yaba alert reaches them.
    const alert = (await t.post("yemi", { message: "Flooding on Montgomery Road", category: "alert", alertCategory: "flooding", urgent: true }))._id;
    await t.app.get(JobsService).drain();
    expect(await t.model<{ uid: string; href: string }>("Notification").exists({ uid: "ada", href: `/p/${alert}` })).toBeTruthy();
  });

  it("at most two besides home, pending ones included", async () => {
    await ask("bola", { kind: "secondary", hoodId: yaba, reason: "My parents live in Yaba." }).expect(201);
    await ask("bola", { kind: "secondary", hoodId: ikeja, reason: "My office is in Ikeja GRA." }).expect(201);
    const res = await ask("bola", { kind: "secondary", hoodId: surulere, reason: "My gym is in Surulere." }).expect(409);
    expect(res.body.message).toMatch(/up to 2/);
    await ask("bola", { kind: "secondary", hoodId: yaba, reason: "Asking twice for the same one." }).expect(409);
  });

  it("declined: the neighbour is told why", async () => {
    await ask("chidi", { kind: "secondary", hoodId: ikeja, reason: "I just like Ikeja a lot." }).expect(201);
    const req = await requestOf("chidi");
    await t.http.post(`/api/admin/hood-requests/${req.id}/decline`).set(as("admin1")).send({ reason: "We need a link to the area, like work or family." }).expect(204);
    const mine = (await t.http.get("/api/users/me/hoods").set(as("chidi")).expect(200)).body;
    expect(mine.requests[0]).toMatchObject({ status: "declined", decisionNote: "We need a link to the area, like work or family." });
    await t.http.get(`/api/posts/neighborhood/${ikeja}`).set(as("chidi")).expect(404);
  });

  it("staff can ask for more in a support conversation the neighbour sees", async () => {
    await ask("dayo", { kind: "secondary", hoodId: surulere, reason: "I volunteer at the Surulere clinic." }).expect(201);
    const req = await requestOf("dayo");
    const first = (await t.http.post(`/api/admin/hood-requests/${req.id}/chat`).set(as("admin1")).send({ body: "Which clinic, and how often?" }).expect(201)).body;
    const again = (await t.http.post(`/api/admin/hood-requests/${req.id}/chat`).set(as("admin1")).send({ body: "Any update?" }).expect(201)).body;
    // One conversation per request.
    expect(again.threadId).toBe(first.threadId);
    const thread = (await t.http.get(`/api/support/threads/${first.threadId}`).set(as("dayo")).expect(200)).body;
    expect(thread.messages.map((m: { body: string }) => m.body)).toEqual(["Which clinic, and how often?", "Any update?"]);
    expect((await t.http.get("/api/users/me/hoods").set(as("dayo")).expect(200)).body.requests[0].threadId).toBe(first.threadId);
  });

  it("staff can remove a secondary Hood later; the neighbour can also leave one", async () => {
    await t.http.post(`/api/admin/neighbours/ada/secondary-hoods/${yaba}/remove`).set(as("admin1")).send({ reason: "You've moved jobs." }).expect(204);
    await t.http.get(`/api/posts/neighborhood/${yaba}`).set(as("ada")).expect(404);

    const req = await requestOf("bola");
    await approve(req.id).expect(204);
    await t.http.delete(`/api/users/me/secondary-hoods/${yaba}`).set(as("bola")).expect(204);
    await t.http.get(`/api/posts/neighborhood/${yaba}`).set(as("bola")).expect(404);
  });

  it("a move is a request: approved, staff move them and keep the new address (admins see it, moderators don't)", async () => {
    await ask("chidi", { kind: "move", address: "4 Herbert Macaulay Way, Yaba, Lagos", ...YABA, reason: "We moved house last month." }).expect(201);
    await ask("chidi", { kind: "move", address: "Somewhere else, Lagos", ...YABA, reason: "Asking twice while one waits." }).expect(409);

    const forAdmin = await requestOf("chidi", "move");
    expect(forAdmin).toMatchObject({ kind: "move", address: "4 Herbert Macaulay Way, Yaba, Lagos", hood: expect.objectContaining({ id: yaba }) });
    const forMod = (await queue("mod1", "?kind=move")).items.find((r) => r.neighbour.uid === "chidi")!;
    expect(forMod.address).toBeUndefined();

    await approve(forAdmin.id).expect(204);
    const record = await t.users.findOne({ uid: "chidi" }).lean();
    expect(record).toMatchObject({ neighborhoodId: yaba, location: expect.objectContaining({ address: "4 Herbert Macaulay Way, Yaba, Lagos" }) });
    expect(await t.model("AuditEvent").exists({ action: "change_hood", "target.id": "chidi" })).toBeTruthy();
  });

  it("members can't use the review routes", async () => {
    await t.http.get("/api/admin/hood-requests").set(as("dayo")).expect(403);
  });

  it("a neighbour can withdraw a pending request", async () => {
    await ask("dayo", { kind: "move", address: "12 Allen Avenue, Ikeja, Lagos", lat: 6.6018, lng: 3.3515, reason: "Moving in with family." }).expect(201);
    const pending = (await t.http.get("/api/users/me/hoods").set(as("dayo")).expect(200)).body.requests.find((r: { kind: string; status: string }) => r.kind === "move" && r.status === "pending");
    await t.http.delete(`/api/users/me/hood-requests/${pending.id}`).set(as("dayo")).expect(204);
    await t.http.delete(`/api/users/me/hood-requests/${pending.id}`).set(as("dayo")).expect(404);
  });
});
