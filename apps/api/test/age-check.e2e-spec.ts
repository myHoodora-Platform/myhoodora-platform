import { AccountDeletionService } from "../src/users/account-deletion.service";
import { JobsService } from "../src/jobs/jobs.service";
import { createTestApp, type TestApp } from "./helpers/app";
import { firebaseState } from "./helpers/firebase-mock";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Years ago today, as "YYYY-MM-DD" (plus `days`: a positive number is a later date, so younger). */
function birthDate(years: number, days = 0): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** docs/compliance/ndpa.md §1: nobody takes part before the age check, and an under-18 account is closed and deleted at once. */
describe("The age check", () => {
  let t: TestApp;
  let lekki: string;
  const check = (uid: string, value: string) => t.http.post("/api/users/me/age").set(t.auth(uid)).send({ birthDate: value });

  beforeAll(async () => {
    process.env.DATA_DELETION_MODE = "live";
    t = await createTestApp();
    delete process.env.DATA_DELETION_MODE;
    lekki = await t.hood();
    for (const service of [AccountDeletionService, JobsService]) {
      const logger = (t.app.get(service) as unknown as { logger: Record<"log" | "warn", () => void> }).logger;
      jest.spyOn(logger, "log").mockImplementation(() => undefined);
      jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    }
  });
  afterAll(() => t.close());

  it("a new account starts unchecked, and can't onboard, give an address or post until it passes", async () => {
    const me = (await t.http.get("/api/users/me").set(t.auth("newbie")).expect(200)).body;
    expect(me.ageConfirmed).toBe(false);
    await t.http.patch("/api/users/me/onboarding").set(t.auth("newbie")).send({ displayName: "New Person" }).expect(403);
    await t.http.post("/api/users/me/verify-location/preview").set(t.auth("newbie")).send({ lat: 6.4478, lng: 3.4746 }).expect(403);

    // Someone verified before the check existed still can't post until they pass it.
    await t.member("legacy", lekki, { ageConfirmedAt: null });
    await t.http.post("/api/posts").set(t.auth("legacy")).send({ message: "Hello" }).expect(403);
  });

  it("18 today passes; the date of birth is not stored, only that and when they passed", async () => {
    const res = (await check("newbie", birthDate(18)).expect(200)).body;
    expect(res).toMatchObject({ adult: true, profile: { ageConfirmed: true } });
    const doc = await t.users.findOne({ uid: "newbie" }).lean().exec();
    expect(doc?.ageConfirmedAt).toBeInstanceOf(Date);
    expect(doc?.ageAssurance).toBe("self_declared_dob");
    expect(JSON.stringify(doc)).not.toContain(birthDate(18));
    await t.http.patch("/api/users/me/onboarding").set(t.auth("newbie")).send({ displayName: "New Person" }).expect(200);

    // Passing is final: a different answer later changes nothing.
    expect((await check("newbie", birthDate(12)).expect(200)).body.adult).toBe(true);
  });

  it("year first: a year settles it, except the year that turns 18 now, which needs the full date", async () => {
    const year = (ago: number) => String(new Date(Date.now() + 60 * 60 * 1000).getUTCFullYear() - ago);
    expect((await check("older", year(30)).expect(200)).body.adult).toBe(true);
    const doc = await t.users.findOne({ uid: "older" }).lean().exec();
    expect(JSON.stringify(doc)).not.toContain(`"${year(30)}"`);
    await check("borderline", year(18)).expect(400);
    expect((await check("borderline", birthDate(18)).expect(200)).body.adult).toBe(true);
    await check("future", year(-1)).expect(400);
  });

  it("refuses dates that aren't real", async () => {
    await check("typo", "2001-02-30").expect(400);
    await check("typo", "09/04/2001").expect(400);
    await check("typo", birthDate(-1)).expect(400);
  });

  it("under 18 (one day short): the account is closed, sign-in turned off, content hidden, and deleted without the 30 days", async () => {
    await t.member("teen", lekki, { ageConfirmedAt: null, displayName: "Teen Person" });
    await t.member("bola", lekki);
    // Content from before the check (an account from before it existed) goes too.
    await t.users.updateOne({ uid: "teen" }, { $set: { ageConfirmedAt: new Date() } });
    const postId = (await t.post("teen", { message: "My first post" }))._id as string;
    await t.users.updateOne({ uid: "teen" }, { $set: { ageConfirmedAt: null } });

    expect((await check("teen", birthDate(18, 1)).expect(200)).body).toEqual({ adult: false });
    expect(firebaseState.updates.get("teen")).toMatchObject({ disabled: true });
    // Every session from before is over…
    await t.http.get("/api/users/me").set(t.auth("teen")).expect(401);
    // …and a sign-in after it can't restore the account, as a deactivated one could.
    await t.http.get("/api/users/me").set({ Authorization: "Bearer t:teen:u:password:fresh" }).expect(410);
    await t.http.get(`/api/posts/${postId}`).set(t.auth("bola")).expect(404);

    const deletion = t.app.get(AccountDeletionService);
    const report = await deletion.purge("teen");
    expect(report).toMatchObject({ dryRun: false });
    const doc = await t.users.findOne({ uid: "teen" }).lean().exec();
    expect(doc?.purgedAt).toBeInstanceOf(Date);
    expect(doc?.displayName).toBeUndefined();
    expect(firebaseState.deleted.has("teen")).toBe(true);
    const audit = await t.model<{ action: string; target: { id: string } }>("AuditEvent").findOne({ action: "account_closed_under_age", "target.id": "teen" }).lean().exec();
    expect(audit).not.toBeNull();
  });
});
