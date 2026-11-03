import { CURRENT_LEGAL } from "../src/users/domain/legal";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** docs/compliance/legal-versions.md: which Terms and Privacy Policy each member agreed to, and when. */
describe("Agreeing to the Terms and Privacy Policy", () => {
  let t: TestApp;
  let lekki: string;
  const accept = (uid: string, body: Record<string, unknown>) => t.http.post("/api/users/me/legal").set(t.auth(uid)).send(body);

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("a new account hasn't agreed to anything yet, and can agree straight after sign-up", async () => {
    expect((await t.http.get("/api/users/me").set(t.auth("newbie")).expect(200)).body.legal).toEqual({ terms: null, privacy: null });
    const me = (await accept("fresh", { ...CURRENT_LEGAL, via: "signup" }).expect(200)).body;
    expect(me.legal).toEqual({ terms: CURRENT_LEGAL.terms, privacy: CURRENT_LEGAL.privacy });
    const record = await t.users.findOne({ uid: "fresh" }).lean();
    expect(record?.legalAcceptances).toEqual([
      { doc: "terms", version: CURRENT_LEGAL.terms, at: expect.any(Date), via: "signup" },
      { doc: "privacy", version: CURRENT_LEGAL.privacy, at: expect.any(Date), via: "signup" },
    ]);
  });

  it("only the current versions can be agreed to", async () => {
    await t.member("ada", lekki);
    const stale = await accept("ada", { terms: "2026-09-28", privacy: CURRENT_LEGAL.privacy }).expect(409);
    expect(stale.body.message).toMatch(/changed while you were reading/);
    await accept("ada", { terms: "not-a-date", privacy: CURRENT_LEGAL.privacy }).expect(400);
    expect((await t.users.findOne({ uid: "ada" }).lean())?.legalAcceptances ?? []).toEqual([]);
  });

  it("every agreement is kept as a record, newest counted, the oldest dropped past 20", async () => {
    await t.member("bola", lekki, { legalAcceptances: [{ doc: "terms", version: "2026-09-28", at: new Date("2026-10-01"), via: "signup" }] } as never);
    expect((await t.http.get("/api/users/me").set(t.auth("bola")).expect(200)).body.legal).toEqual({ terms: "2026-09-28", privacy: null });
    for (let i = 0; i < 11; i++) {
      // The general 10-a-second limit, not the point here.
      t.resetThrottle();
      await accept("bola", CURRENT_LEGAL).expect(200);
    }
    const record = await t.users.findOne({ uid: "bola" }).lean();
    expect(record?.legalAcceptances).toHaveLength(20);
    expect(record?.legalAcceptances?.every((a) => a.version === CURRENT_LEGAL[a.doc])).toBe(true);
    expect(record?.legalAcceptances?.[19]?.via).toBe("prompt");
  });
});
