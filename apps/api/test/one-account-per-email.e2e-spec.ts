import { createTestApp, type TestApp } from "./helpers/app";
import { firebaseState } from "./helpers/firebase-mock";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * One account per email address. Someone whose Firebase sign-in was deleted by hand signs in again and
 * gets a new uid: they keep their account instead of getting a second, blank one. Test tokens carry the
 * address `<uid>@test.dev`, so an old account is given the new sign-in's address.
 */
describe("One account per email address", () => {
  let t: TestApp;
  let hood: string;
  const me = (uid: string, opts: { emailVerified?: boolean; provider?: string } = { emailVerified: true, provider: "google.com" }) => t.http.get("/api/users/me").set(t.auth(uid, opts));

  beforeAll(async () => {
    t = await createTestApp();
    hood = await t.hood();
  });
  afterAll(() => t.close());
  beforeEach(() => {
    t.resetThrottle();
    firebaseState.lookupDown = false;
  });

  it("a new sign-in with a confirmed address takes over the account whose Firebase sign-in was deleted", async () => {
    await t.member("old-dami", hood, { email: "new-dami@test.dev", displayName: "Dami Okoro", role: "admin" });
    firebaseState.deleted.add("old-dami");

    const res = await me("new-dami").expect(200);
    expect(res.body).toMatchObject({ uid: "new-dami", email: "new-dami@test.dev", displayName: "Dami Okoro", role: "admin" });
    expect(await t.users.countDocuments({ email: "new-dami@test.dev" })).toBe(1);
    expect(await t.users.countDocuments({ uid: "old-dami" })).toBe(0);
    const audit = await t.model<{ action: string; target: { id: string } }>("AuditEvent").findOne({ action: "account_relink" }).lean();
    expect(audit?.target.id).toBe("new-dami");
    // Signing in again is an ordinary sign-in.
    expect((await me("new-dami").expect(200)).body.displayName).toBe("Dami Okoro");
  });

  it("an unconfirmed address can't take an account over", async () => {
    await t.member("old-eko", hood, { email: "new-eko@test.dev", displayName: "Eko" });
    firebaseState.deleted.add("old-eko");
    await me("new-eko", { emailVerified: false }).expect(409);
    expect((await t.users.findOne({ email: "new-eko@test.dev" }).lean())?.uid).toBe("old-eko");
    expect(await t.users.countDocuments({ uid: "new-eko" })).toBe(0);
  });

  it("changes nothing while the old Firebase sign-in still exists, or when Firebase can't be reached", async () => {
    await t.member("old-femi", hood, { email: "new-femi@test.dev" });
    await me("new-femi").expect(409);
    firebaseState.lookupDown = true;
    await me("new-femi").expect(503);
    expect((await t.users.findOne({ email: "new-femi@test.dev" }).lean())?.uid).toBe("old-femi");
    expect(await t.users.countDocuments({ uid: "new-femi" })).toBe(0);
  });

  it("the database refuses a second account with the same address", async () => {
    await t.user("gbenga", { email: "same@test.dev" });
    await expect(t.user("gbenga-2", { email: "same@test.dev" })).rejects.toMatchObject({ code: 11000 });
  });
});
