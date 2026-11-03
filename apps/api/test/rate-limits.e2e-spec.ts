import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * Audit B7: limits used to be counted per IP address, before authentication. Browsers call the API
 * directly, so everyone behind one address (a mobile carrier, an estate's Wi-Fi) shared one allowance.
 * Every request in this suite comes from the same address, which is exactly that situation.
 */
describe("Rate limits: per person once signed in, per address before that", () => {
  let t: TestApp;
  let lekki: string;
  const LAGOS = { lat: 6.4478, lng: 3.4746 };

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1", LAGOS.lng, LAGOS.lat, 2000);
    for (const uid of ["ada", "bola", "chidi"]) await t.member(uid, lekki);
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const header = (res: { headers: Record<string, string> }, name: string) => res.headers[name.toLowerCase()];

  it("one neighbour using up their allowance doesn't take a neighbour's on the same address", async () => {
    // verify-location allows 10 a minute.
    const check = (uid: string) => t.http.post("/api/users/me/verify-location").set(t.auth(uid)).send(LAGOS);
    for (let i = 0; i < 10; i++) await check("ada").expect(200);
    await check("ada").expect(429);
    await check("bola").expect(200);
    // …and it is the person who is limited, on that route: their other requests carry on.
    await t.http.get("/api/users/me").set(t.auth("ada")).expect(200);
  });

  it("says when to try again, in words a person can read", async () => {
    const check = () => t.http.post("/api/users/me/verify-location").set(t.auth("chidi")).send(LAGOS);
    for (let i = 0; i < 10; i++) await check().expect(200);
    const res = await check().expect(429);
    expect(res.body).toEqual({ statusCode: 429, message: "Too many requests. Please wait a moment and try again." });
    // The standard header, so a client needn't know which of our limits it met.
    expect(Number(header(res, "Retry-After"))).toBeGreaterThan(0);
    expect(Number(header(res, "Retry-After"))).toBeLessThanOrEqual(60);
  });

  it("a route with no sign-in is still limited per address", async () => {
    // Confirming an emailed token is public, and allows 10 a minute against guessing.
    const confirm = () => t.http.post("/api/auth/email-verification/confirm").send({ token: "x".repeat(40) });
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await confirm()).status);
    // Whatever the pace (it also allows only 3 a second), nothing gets through after the tenth.
    expect(statuses.slice(10)).toEqual([429, 429]);
    // Signing in doesn't lift it: nobody is identified on a public route, so it stays per address.
    expect((await confirm().set(t.auth("ada"))).status).toBe(429);
  });

  it("before sign-in is checked there is only a generous per-address flood limit; personal limits come after", async () => {
    // Refused for having no token: the flood limit had already counted it, the personal ones never ran.
    const refused = await t.http.get("/api/users/me").expect(401);
    expect(Number(header(refused, "X-RateLimit-Limit-flood"))).toBeGreaterThanOrEqual(500);
    expect(header(refused, "X-RateLimit-Limit-medium")).toBeUndefined();

    const ok = await t.http.get("/api/users/me").set(t.auth("ada")).expect(200);
    expect(header(ok, "X-RateLimit-Limit-flood")).toBeDefined();
    expect(header(ok, "X-RateLimit-Limit-medium")).toBe("60");
    expect(header(ok, "X-RateLimit-Remaining-medium")).toBe("59");
    // A second person starts from a full allowance, though the address is the same.
    const other = await t.http.get("/api/users/me").set(t.auth("bola")).expect(200);
    expect(header(other, "X-RateLimit-Remaining-medium")).toBe("59");
  });

  it("the web server's session checks, which all come from one address, are outside the flood limit", async () => {
    const res = await t.http.get("/api/auth/session").set({ Authorization: "Bearer s:ada" }).expect(204);
    expect(header(res, "X-RateLimit-Limit-flood")).toBeUndefined();
    // They keep their own limit per credential.
    expect(header(res, "X-RateLimit-Limit-medium")).toBe("30");
  });
});
