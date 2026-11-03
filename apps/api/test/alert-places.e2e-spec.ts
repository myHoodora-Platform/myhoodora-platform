import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Alerts can say where (2026-10-28): a pin or a typed area, near the neighbourhood, shown on the Alerts map. */
describe("Alert places", () => {
  let t: TestApp;
  let yaba: string;
  const post = (body: Record<string, unknown>) => t.http.post("/api/posts").set(t.auth("ada")).send(body);
  const alert = (extra: Record<string, unknown> = {}) => ({ message: "No light on Herbert Macaulay since 6pm", category: "alert", alertCategory: "power", ...extra });

  beforeAll(async () => {
    t = await createTestApp();
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    await t.member("ada", yaba);
    await t.member("bola", yaba);
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("keeps a nearby place, rounded to about 10 m, with its name, and neighbours see it", async () => {
    const res = await post(alert({ location: { lat: 6.512345678, lng: 3.372345678, label: "  Herbert   Macaulay junction " } })).expect(201);
    expect(res.body.location).toEqual({ lat: 6.5123, lng: 3.3723, label: "Herbert Macaulay junction" });
    const seen = await t.http.get(`/api/posts/${res.body._id}`).set(t.auth("bola")).expect(200);
    expect(seen.body.location).toEqual({ lat: 6.5123, lng: 3.3723, label: "Herbert Macaulay junction" });
  });

  it("a pin is optional, and a name without one isn't needed", async () => {
    const res = await post(alert()).expect(201);
    expect(res.body.location).toBeUndefined();
    const pinOnly = await post(alert({ location: { lat: 6.51, lng: 3.371 } })).expect(201);
    expect(pinOnly.body.location).toEqual({ lat: 6.51, lng: 3.371 });
  });

  it("refuses a pin across town", async () => {
    // Ikeja is about 12 km from Yaba.
    const res = await post(alert({ location: { lat: 6.6018, lng: 3.3515 } })).expect(400);
    expect(res.body.message).toMatch(/too far from your neighbourhood/);
  });

  it("only alerts carry a place", async () => {
    const res = await post({ message: "Lovely evening", category: "general", location: { lat: 6.51, lng: 3.371, label: "My street" } }).expect(201);
    expect(res.body.location).toBeUndefined();
  });

  it("checks the name and the coordinates", async () => {
    await post(alert({ location: { lat: 95, lng: 3.37 } })).expect(400);
    await post(alert({ location: { lat: 6.51, lng: 3.37, label: "x".repeat(121) } })).expect(400);
  });
});
