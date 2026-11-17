import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

type View = { _id: string; access?: string; message: string; mediaUrls: string[]; authorUid: string; author: { displayName: string } };

/**
 * Who sees and takes part in a post, by its audience (Your Hood / Nearby Hoods / Anyone), and what a
 * shared link shows before signing in. The table: posts/domain/visibility.ts and the plan's WP-G.
 */
describe("Post audiences and shared links", () => {
  let t: TestApp;
  let lekki: string;
  let phase2: string;
  let yaba: string;
  const CROWD = 100;
  const v = { emailVerified: true };

  const get = (uid: string, id: string) => t.http.get(`/api/posts/${id}`).set(t.auth(uid, v));
  const react = (uid: string, id: string) => t.http.put(`/api/posts/${id}/reaction`).set(t.auth(uid, v)).send({ type: "like" });
  const reply = (uid: string, id: string, content = "Count me in") => t.http.post(`/api/posts/${id}/comments`).set(t.auth(uid, v)).send({ content });
  const publicView = (id: string) => t.http.get(`/api/public/posts/${id}`);
  const create = async (uid: string, body: Record<string, unknown>) => (await t.http.post("/api/posts").set(t.auth(uid, v)).send(body).expect(201)).body as View;

  let mine: View;
  let nearbyPost: View;
  let anyonePost: View;
  let alert: View;

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1", 3.4746, 6.4478, 1500);
    phase2 = await t.hood("Lekki Phase 2", 3.5, 6.44, 1500); // ~3 km away: nearby
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500); // ~13 km away
    await t.member("ada", lekki, { displayName: "Adaeze Okafor" });
    await t.member("kemi", phase2);
    await t.member("tunde", yaba);
    await t.member("ngozi", yaba, { neighborhoodId: yaba });
    await t.users.updateOne({ uid: "ngozi" }, { $set: { secondaryHoods: [{ id: lekki, name: "Lekki Phase 1" }] } });
    await t.user("newbie"); // signed up, no Hood yet
    await t.member("blocker", lekki, { blockedUids: ["tunde"] } as never);
    await t.member("boss", yaba, { role: "admin" });
    await t.users.insertMany(
      Array.from({ length: CROWD }, (_, i) => ({ uid: `n${i}`, email: `n${i}@test.dev`, displayName: `Neighbour ${i}`, neighborhoodId: i % 2 ? lekki : yaba, verificationStatus: "verified", verifiedAt: new Date(), emailVerifiedAt: new Date(), ageConfirmedAt: new Date() })),
    );

    mine = await create("ada", { message: "Who fixed your generator? Mine is acting up on Admiralty Way.", category: "recommendation" });
    nearbyPost = await create("ada", { message: "Lekki side car boot sale on Saturday", visibility: "nearby" });
    anyonePost = await create("ada", { message: "Lost black cat near the roundabout, answers to Bisi", visibility: "anyone", mediaUrls: [] });
    alert = await create("ada", { message: "Robbery at the junction, avoid it", category: "alert", alertCategory: "security", visibility: "anyone" });
    // Lots of neighbours replying from everywhere they may.
    for (let i = 1; i < CROWD; i += 2) await reply(`n${i}`, anyonePost._id, `Seen it ${i}`).expect(201);
    for (let i = 0; i < CROWD; i += 2) await reply(`n${i}`, anyonePost._id, `From Yaba ${i}`).expect(201);
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("Your Hood: full for its neighbours and followers; a teaser with nothing written for everyone else", async () => {
    expect((await get("ada", mine._id).expect(200)).body.access).toBeUndefined();
    expect((await get("ngozi", mine._id).expect(200)).body.access).toBeUndefined(); // follows Lekki: reads, reacts, replies
    await reply("ngozi", mine._id).expect(201);
    for (const outsider of ["kemi", "tunde", "newbie"]) {
      const body = (await get(outsider, mine._id).expect(200)).body as View;
      expect(body).toMatchObject({ access: "teaser", message: "", mediaUrls: [], authorUid: "" });
      expect(JSON.stringify(body)).not.toMatch(/generator|Admiralty|Adaeze|Okafor/);
      expect(body.author.displayName).toBe("A neighbour in Lekki Phase 1");
    }
    await react("kemi", mine._id).expect(404);
    await reply("tunde", mine._id).expect(404);
    await t.http.get(`/api/posts/${mine._id}/comments`).set(t.auth("tunde", v)).expect(404);
  });

  it("Nearby Hoods: full for the Hood next door, teaser further away", async () => {
    expect((await get("kemi", nearbyPost._id).expect(200)).body.message).toContain("car boot sale");
    await react("kemi", nearbyPost._id).expect(200);
    await reply("kemi", nearbyPost._id).expect(201);
    expect((await get("tunde", nearbyPost._id).expect(200)).body.access).toBe("teaser");
    await reply("tunde", nearbyPost._id).expect(404);
  });

  it("Anyone: verified neighbours anywhere read, react and reply; not-yet-verified can only read", async () => {
    expect((await get("tunde", anyonePost._id).expect(200)).body.access).toBeUndefined();
    await react("tunde", anyonePost._id).expect(200);
    const fromNewbie = (await get("newbie", anyonePost._id).expect(200)).body as View;
    expect(fromNewbie).toMatchObject({ access: "read_only" });
    expect(fromNewbie.message).toContain("Bisi");
    await reply("newbie", anyonePost._id).expect(403);
    const thread = (await t.http.get(`/api/posts/${anyonePost._id}/comments?limit=50`).set(t.auth("tunde", v)).expect(200)).body as unknown[];
    expect(thread.length).toBeGreaterThan(0);
  });

  it("safety alerts never leave their Hood, whatever was asked for", async () => {
    expect((await get("kemi", alert._id).expect(200)).body).toMatchObject({ access: "teaser", message: "" });
    const pub = (await publicView(alert._id).expect(200)).body;
    expect(pub).toMatchObject({ mode: "teaser", category: "alert", alertCategory: "security" });
    expect(JSON.stringify(pub)).not.toMatch(/Robbery|junction/);
  });

  it("a block hides the post completely, no teaser", async () => {
    const theirs = await create("blocker", { message: "Estate meeting", visibility: "anyone" });
    await get("tunde", theirs._id).expect(404);
  });

  it("shared link, signed out: Anyone in full with initials only; Your Hood as a teaser; gone = 410", async () => {
    const full = (await publicView(anyonePost._id).expect(200)).body;
    expect(full).toMatchObject({ mode: "full", hood: { name: "Lekki Phase 1", city: "Lagos" }, author: { name: "A. O." }, commentCount: CROWD });
    expect(full.message).toContain("Bisi");
    expect(full.replies).toHaveLength(2);
    expect(full.replies[0].name).toMatch(/^[A-Z]\. [A-Z0-9]\.$/);
    expect(JSON.stringify(full)).not.toMatch(/Adaeze|Okafor|Neighbour \d/);

    const teaser = (await publicView(mine._id).expect(200)).body;
    expect(teaser).toMatchObject({ mode: "teaser", category: "recommendation", hood: { name: "Lekki Phase 1" } });
    expect(teaser.message).toBeUndefined();
    expect(teaser.author).toEqual({ name: "A neighbour" });
    expect(JSON.stringify(teaser)).not.toMatch(/generator|Admiralty|Adaeze/);

    await publicView("6afc34d12644cd9c608d32ed").expect(404);
    await publicView("not-an-id").expect(404);
    const gone = await create("ada", { message: "Temporary", visibility: "anyone" });
    await t.http.delete(`/api/posts/${gone._id}`).set(t.auth("ada", v)).expect(204);
    await publicView(gone._id).expect(410);
  });

  it("an author can narrow the audience, never widen it; alerts stay in the Hood", async () => {
    const p = await create("ada", { message: "Selling a fridge", visibility: "anyone" });
    await t.http.patch(`/api/posts/${p._id}`).set(t.auth("ada", v)).send({ visibility: "nearby" }).expect(200);
    expect((await get("tunde", p._id).expect(200)).body.access).toBe("teaser");
    await t.http.patch(`/api/posts/${p._id}`).set(t.auth("ada", v)).send({ visibility: "anyone" }).expect(400);
    await t.http.patch(`/api/posts/${p._id}`).set(t.auth("ada", v)).send({ visibility: "neighbourhood", message: "Fridge sold, thanks" }).expect(200);
    expect((await get("kemi", p._id).expect(200)).body.access).toBe("teaser");
    expect((await publicView(p._id).expect(200)).body).toMatchObject({ mode: "teaser" });
    await t.http.patch(`/api/posts/${alert._id}`).set(t.auth("ada", v)).send({ visibility: "anyone" }).expect(400);
  });

  it("staff see everything in full", async () => {
    expect((await get("boss", mine._id).expect(200)).body.access).toBeUndefined();
  });
});
