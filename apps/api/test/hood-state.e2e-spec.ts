import { getConnectionToken } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * A Hood has a city (Lagos, Ibadan, Abeokuta) and the state it's in (Lagos, Oyo, Ogun), kept apart so
 * a state is never filed as a city.
 */
describe("Hood states", () => {
  let t: TestApp;
  let lekki: string;
  let db: Connection["db"];

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood("Lekki Phase 1");
    await t.member("admin1", lekki, { role: "admin" });
    db = t.app.get<Connection>(getConnectionToken()).db;
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const create = (body: Record<string, unknown>) => t.http.post("/api/admin/hoods").set(t.auth("admin1")).send(body);
  const patch = (id: string, body: Record<string, unknown>) => t.http.patch(`/api/admin/hoods/${id}`).set(t.auth("admin1")).send(body);

  it("a new Hood needs a real state", async () => {
    const base = { name: "Takie", city: "Ogbomoso", center: { lat: 8.1335, lng: 4.2403 }, radiusMeters: 1500 };
    await create(base).expect(400);
    await create({ ...base, state: "Ogbomoso" }).expect(400);
    const res = await create({ ...base, state: "Oyo" }).expect(201);
    expect(res.body).toMatchObject({ name: "Takie", city: "Ogbomoso", state: "Oyo" });
  });

  it("lists Hoods by state, and says which states and cities have Hoods", async () => {
    const oyo = (await t.http.get("/api/admin/hoods").query({ state: "Oyo" }).set(t.auth("admin1")).expect(200)).body;
    expect(oyo.items.map((h: { name: string }) => h.name)).toEqual(["Takie"]);
    await t.http.get("/api/admin/hoods").query({ state: "Ibadan" }).set(t.auth("admin1")).expect(400);

    const places = (await t.http.get("/api/admin/hoods/places").set(t.auth("admin1")).expect(200)).body;
    expect(places).toEqual([
      { state: "Lagos", city: "Lagos", hoods: 1 },
      { state: "Oyo", city: "Ogbomoso", hoods: 1 },
    ]);
  });

  it("staff can move a Hood to its right city and state, and the copies of its city follow", async () => {
    // Filed the old way: an Ogun town under the city "Lagos".
    const mowe = (await create({ name: "Mowe", city: "Lagos", state: "Lagos", center: { lat: 6.811, lng: 3.437 }, radiusMeters: 1500 }).expect(201)).body.id as string;
    await db!.collection("groups").insertOne({ name: "Mowe Mums", neighborhoodId: mowe, city: "Lagos" });
    await t.user("visitor", { secondaryHoods: [{ id: mowe, name: "Mowe", city: "Lagos", since: new Date() }, { id: lekki, name: "Lekki Phase 1", city: "Lagos", since: new Date() }] });

    await patch(mowe, { state: "Lagoss" }).expect(400);
    const res = await patch(mowe, { city: "Mowe", state: "Ogun", reason: "Mowe is in Ogun State" }).expect(200);
    expect(res.body).toMatchObject({ city: "Mowe", state: "Ogun" });

    expect(await db!.collection("groups").findOne({ name: "Mowe Mums" })).toMatchObject({ city: "Mowe" });
    const visitor = await t.users.findOne({ uid: "visitor" }).lean().exec();
    expect(visitor!.secondaryHoods.map((h) => h.city)).toEqual(["Mowe", "Lagos"]);
  });
});
