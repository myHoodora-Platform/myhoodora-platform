import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const REFUSED = "Please rephrase: this contains words that aren't allowed on myHoodora. See the Community Guidelines.";

/**
 * Content filter (App Store guideline 1.2): objectionable text is refused wherever people write
 * something others see, with a message the apps show as written; admins add their own words.
 */
describe("Content filter", () => {
  let t: TestApp;
  let postId: string;
  const refused = (res: { status: number; body: { message?: unknown } }) => {
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain(REFUSED);
  };

  beforeAll(async () => {
    t = await createTestApp();
    const hood = await t.hood();
    await t.member("ada", hood);
    await t.member("bola", hood);
    await t.member("filter-admin", hood, { role: "admin" });
    postId = (await t.post("ada", { message: "Generator repair on Road 5 tomorrow" }))._id;
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("refuses posts, edits, comments, poll options, profile names and chat messages that break the rules", async () => {
    refused(await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "Selling p0rn DVDs, DM me" }));
    refused(await t.http.patch(`/api/posts/${postId}`).set(t.auth("ada")).send({ message: "send nudes" }));
    refused(await t.http.post(`/api/posts/${postId}/comments`).set(t.auth("bola")).send({ content: "If you block my gate again I will kill you" }));
    refused(
      await t.http
        .post("/api/posts")
        .set(t.auth("ada"))
        .send({ message: "Which day?", poll: { options: [{ id: "a", text: "Monday" }, { id: "b", text: "c.u.n.t" }] } }),
    );
    refused(await t.http.patch("/api/users/me").set(t.auth("bola")).send({ displayName: "Motherfucker" }));
    const convo = (await t.http.post("/api/conversations").set(t.auth("ada")).send({ recipientUid: "bola" }).expect(201)).body._id;
    refused(await t.http.post(`/api/conversations/${convo}/messages`).set(t.auth("ada")).send({ body: "you faggot" }));
  });

  it("lets ordinary neighbourhood posts through", async () => {
    await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "Welcome to Nigeria Day party at the Essex Close clubhouse, 5pm" }).expect(201);
    await t.http.post(`/api/posts/${postId}/comments`).set(t.auth("bola")).send({ content: "Robbers said they will kill anyone who resists, stay safe" }).expect(201);
  });

  it("admins add their own words, which take effect at once; the built-in ones always stay", async () => {
    await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "That man na olosho" }).expect(201);
    const saved = await t.http.patch("/api/admin/settings").set(t.auth("filter-admin")).send({ blockedTerms: ["  Olosho* ", "olosho*", "ashawo"] }).expect(200);
    expect(saved.body.blockedTerms).toEqual(["olosho*", "ashawo"]);
    refused(await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "That man na olosho" }));
    refused(await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "oloshos everywhere" }));
    await t.http.patch("/api/admin/settings").set(t.auth("filter-admin")).send({ blockedTerms: [] }).expect(200);
    await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "That man na olosho" }).expect(201);
    refused(await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "send nudes" }));
    await t.http.patch("/api/admin/settings").set(t.auth("filter-admin")).send({ blockedTerms: ["x".repeat(61)] }).expect(400);
    await t.http.patch("/api/admin/settings").set(t.auth("ada")).send({ blockedTerms: ["ashawo"] }).expect(403);
  });
});
