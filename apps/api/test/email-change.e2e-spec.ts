import { createTestApp, type TestApp } from "./helpers/app";
import { firebaseState } from "./helpers/firebase-mock";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * POST /users/me/email (contract §31): an address that was never confirmed can be corrected; a
 * confirmed one can't. Sign-in and the account change together, and links to the old address die.
 */
describe("Changing an unconfirmed email", () => {
  let t: TestApp;
  const change = (uid: string, email: string, auth = t.auth(uid)) => t.http.post("/api/users/me/email").set(auth).send({ email });
  const links = (uid: string) => t.model<{ uid: string }>("EmailVerification").countDocuments({ uid });

  beforeAll(async () => {
    t = await createTestApp();
    const hood = await t.hood();
    await t.member("ada", hood, { emailVerifiedAt: null });
    await t.member("bola", hood, { emailVerifiedAt: null });
    await t.member("chidi", hood);
    await t.member("gina", hood, { emailVerifiedAt: null });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("updates sign-in and the account, replaces the old links, and emails the new address", async () => {
    // A link already sent to the old address.
    await t.http.post("/api/auth/email-verification/resend").set(t.auth("ada")).expect((r) => expect([200, 202, 204]).toContain(r.status));
    const sentBefore = t.outbox.length;

    const res = await change("ada", "  Ada.Okafor@Example.com ").expect(200);
    expect(res.body).toMatchObject({ email: "ada.okafor@example.com", emailVerified: false });
    expect((await t.users.findOne({ uid: "ada" }).lean())?.email).toBe("ada.okafor@example.com");
    expect(firebaseState.updates.get("ada")).toMatchObject({ email: "ada.okafor@example.com", emailVerified: false });
    // Only the new link exists, and it went to the new address.
    expect(await links("ada")).toBe(1);
    expect(t.outbox.slice(sentBefore).map((m) => m.to)).toEqual(["ada.okafor@example.com"]);
  });

  it("a confirmed address can't be changed", async () => {
    const res = await change("chidi", "new@example.com").expect(409);
    expect(res.body.message).toMatch(/confirmed/);
    // Nor when Firebase says it's confirmed (a Google sign-in).
    await change("bola", "new2@example.com", t.auth("bola", { emailVerified: true })).expect(409);
  });

  it("an address from Google can't be changed here", async () => {
    await change("bola", "new3@example.com", t.auth("bola", { provider: "google.com" })).expect(400);
  });

  it("needs a recent sign-in, so an unlocked phone can't be used to take the account", async () => {
    const res = await change("bola", "new4@example.com", t.auth("bola", { provider: "password:old" })).expect(403);
    expect(res.body.message).toMatch(/password again/);
    expect((await t.users.findOne({ uid: "bola" }).lean())?.email).toBe("bola@test.dev");
  });

  it("an address someone else uses is refused, here or in Firebase", async () => {
    await change("bola", "chidi@test.dev").expect(409);
    // However it's typed.
    await change("bola", "  Chidi@TEST.dev ").expect(409);
    firebaseState.takenEmails.add("taken@example.com");
    await change("bola", "taken@example.com").expect(409);
    expect((await t.users.findOne({ uid: "bola" }).lean())?.email).toBe("bola@test.dev");
  });

  it("rejects something that isn't an email, and the same address", async () => {
    await change("gina", "not-an-email").expect(400);
    await change("gina", "gina@test.dev").expect(400);
  });
});
