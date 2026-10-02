import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const group = (patch: Record<string, unknown> = {}) => ({ name: "Road 12 Parents", description: "School runs, playdates and tips.", category: "parents", privacy: "open", boundary: "neighbourhood", ...patch });

describe("Groups (contract §8)", () => {
  let t: TestApp;
  let lekki: string;
  let lekki2: string;
  let yaba: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    lekki2 = await t.hood("Lekki Phase 2", 3.5146, 6.4400, 1500); // ~4.5 km away, same city
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500); // ~13 km, same city
    for (const uid of ["ada", "bola", "chidi", "dayo"]) await t.member(uid, lekki);
    await t.member("emeka", lekki2);
    await t.member("tunde", yaba);
    await t.user("newbie");
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("verified neighbours create groups and become admin; names are unique per Hood", async () => {
    await t.http.post("/api/groups").set(t.auth("newbie")).send(group()).expect(403);
    const g = await t.http.post("/api/groups").set(t.auth("ada")).send(group()).expect(201);
    expect(g.body).toMatchObject({ membership: "member", isAdmin: true, memberCount: 1, neighborhoodId: lekki });
    ids.open = g.body._id;
    await t.http.post("/api/groups").set(t.auth("bola")).send(group({ name: "road 12 PARENTS" })).expect(409);
  });

  it("limits each neighbour to 3 new groups a day", async () => {
    for (const n of ["A", "B"]) await t.http.post("/api/groups").set(t.auth("dayo")).send(group({ name: `Dayo group ${n}` })).expect(201);
    ids.private = (await t.http.post("/api/groups").set(t.auth("dayo")).send(group({ name: "Estate security", privacy: "private", category: "safety", boundary: "nearby" })).expect(201)).body._id;
    await t.http.post("/api/groups").set(t.auth("dayo")).send(group({ name: "One too many" })).expect(429);
  });

  it("boundary controls who can find a group", async () => {
    ids.city = (await t.http.post("/api/groups").set(t.auth("chidi")).send(group({ name: "Lagos cyclists", category: "hobbies", boundary: "city" })).expect(201)).body._id;
    const nearby = (await t.http.get("/api/groups").set(t.auth("emeka")).expect(200)).body.map((g: { _id: string }) => g._id);
    expect(nearby).toEqual(expect.arrayContaining([ids.private, ids.city]));
    expect(nearby).not.toContain(ids.open);
    const far = (await t.http.get("/api/groups").set(t.auth("tunde")).expect(200)).body.map((g: { _id: string }) => g._id);
    expect(far).toContain(ids.city);
    expect(far).not.toContain(ids.private);
    await t.http.get(`/api/groups/${ids.open}`).set(t.auth("tunde")).expect(404);
  });

  it("open groups join instantly; private ones create a request the admins are told about", async () => {
    expect((await t.http.post(`/api/groups/${ids.open}/join`).set(t.auth("bola")).send({}).expect(200)).body.membership).toBe("member");
    expect((await t.http.post(`/api/groups/${ids.private}/join`).set(t.auth("emeka")).send({}).expect(200)).body.membership).toBe("requested");
    const notes = await t.http.get("/api/notifications").set(t.auth("dayo")).expect(200);
    expect(notes.body.some((n: { type: string; href: string }) => n.type === "group" && n.href === `/g/${ids.private}/manage`)).toBe(true);
    // Private content is members-only.
    await t.http.get(`/api/groups/${ids.private}/posts`).set(t.auth("emeka")).expect(403);
    await t.http.get(`/api/groups/${ids.private}/requests`).set(t.auth("bola")).expect(403);
    const reqs = await t.http.get(`/api/groups/${ids.private}/requests`).set(t.auth("dayo")).expect(200);
    expect(reqs.body.map((r: { uid: string }) => r.uid)).toEqual(["emeka"]);
    await t.http.post(`/api/groups/${ids.private}/requests/emeka/approve`).set(t.auth("dayo")).expect(204);
    expect((await t.http.get(`/api/groups/${ids.private}`).set(t.auth("emeka")).expect(200)).body).toMatchObject({ membership: "member", memberCount: 2 });
  });

  it("invite links: admins only for private groups; a valid token skips approval, even from further away", async () => {
    await t.http.post(`/api/groups/${ids.private}/invite-link`).set(t.auth("emeka")).send({}).expect(403);
    const { url } = (await t.http.post(`/api/groups/${ids.private}/invite-link`).set(t.auth("dayo")).send({}).expect(200)).body;
    const token = new URL(url).searchParams.get("invite")!;
    await t.http.get(`/api/groups/${ids.private}`).set(t.auth("tunde")).expect(404);
    await t.http.get(`/api/groups/${ids.private}?invite=${token}`).set(t.auth("tunde")).expect(200);
    expect((await t.http.post(`/api/groups/${ids.private}/join`).set(t.auth("tunde")).send({ inviteToken: token }).expect(200)).body.membership).toBe("member");
    // Resetting revokes the old link.
    await t.http.post(`/api/groups/${ids.private}/invite-link`).set(t.auth("dayo")).send({ reset: true }).expect(200);
    await t.http.post(`/api/groups/${ids.private}/join`).set(t.auth("chidi")).send({ inviteToken: token }).expect(200).expect((r) => expect(r.body.membership).toBe("requested"));
  });

  it("always keeps an admin", async () => {
    await t.http.delete(`/api/groups/${ids.open}/membership`).set(t.auth("ada")).expect(409);
    await t.http.patch(`/api/groups/${ids.open}/members/ada`).set(t.auth("ada")).send({ role: "member" }).expect(409);
    await t.http.patch(`/api/groups/${ids.open}/members/bola`).set(t.auth("ada")).send({ role: "admin" }).expect(204);
    await t.http.delete(`/api/groups/${ids.open}/membership`).set(t.auth("ada")).expect(204);
    expect((await t.http.get(`/api/groups/${ids.open}`).set(t.auth("bola")).expect(200)).body.memberCount).toBe(1);
  });

  it("can't be deleted once other members have posted", async () => {
    await t.http.post(`/api/groups/${ids.open}/join`).set(t.auth("chidi")).send({}).expect(200);
    const p = await t.http.post(`/api/groups/${ids.open}/posts`).set(t.auth("chidi")).send({ content: "Any recommendations for a lesson teacher?" }).expect(201);
    expect(p.body.author.displayName).toBe("chidi");
    await t.http.delete(`/api/groups/${ids.open}`).set(t.auth("bola")).expect(409);
    await t.http.delete(`/api/groups/${ids.open}/posts/${p.body._id}`).set(t.auth("bola")).expect(204); // group admin
    await t.http.delete(`/api/groups/${ids.open}`).set(t.auth("bola")).expect(204);
  });

  it("removing a member tells them why; opening a private group admits everyone waiting", async () => {
    await t.http.delete(`/api/groups/${ids.private}/members/emeka`).set(t.auth("dayo")).send({ reason: "Only for residents of Road 12" }).expect(204);
    const notes = await t.http.get("/api/notifications").set(t.auth("emeka")).expect(200);
    expect(notes.body.find((n: { title: string }) => n.title.startsWith("You were removed"))?.body).toContain("Only for residents of Road 12");
    await t.http.patch(`/api/groups/${ids.private}`).set(t.auth("dayo")).send({ privacy: "open" }).expect(200);
    expect((await t.http.get(`/api/groups/${ids.private}`).set(t.auth("chidi")).expect(200)).body.membership).toBe("member");
  });

  it("GET /users/search finds neighbours in your Hood to invite", async () => {
    const res = await t.http.get("/api/users/search?q=bo").set(t.auth("ada")).expect(200);
    expect(res.body.map((u: { uid: string }) => u.uid)).toEqual(["bola"]);
    expect((await t.http.get("/api/users/search?q=emeka").set(t.auth("ada")).expect(200)).body).toEqual([]);
  });

  it("staff can archive a group, which hides it", async () => {
    await t.member("mod", lekki, { role: "moderator" });
    await t.http.post(`/api/admin/groups/${ids.city}/actions`).set(t.auth("mod")).send({ action: "archive", reason: "Spam" }).expect(201);
    await t.http.get(`/api/groups/${ids.city}`).set(t.auth("chidi")).expect(404);
    const admin = await t.http.get("/api/admin/groups?status=archived").set(t.auth("mod")).expect(200);
    expect(admin.body.items.map((g: { id: string }) => g.id)).toEqual([ids.city]);
  });
});
