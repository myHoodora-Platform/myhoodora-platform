import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const BODIJA = { lng: 3.9017, lat: 7.4306 };
/** A point `m` metres due east of Bodija's centre, in the metres MongoDB measures with. */
const east = (m: number) => ({ lng: BODIJA.lng + m / (111_319.5 * Math.cos((BODIJA.lat * Math.PI) / 180)), lat: BODIJA.lat });

/**
 * Hoods may overlap, and every address still belongs to one Hood. Bodija (3,000 m) and Agodi (1,000 m,
 * 3,500 m east) share the ground from 2,500 m to 3,000 m east. Power distance (d² − r²) splits it along
 * the line through the two points where the circles cross: here, 2,893 m east of Bodija's centre.
 */
describe("Overlapping Hoods", () => {
  let t: TestApp;
  let bodija: string;
  let agodi: string;

  beforeAll(async () => {
    t = await createTestApp();
    bodija = await t.hood("Bodija", BODIJA.lng, BODIJA.lat, 3000);
    await t.member("admin1", bodija, { role: "admin" });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const create = (name: string, center: { lng: number; lat: number }, radiusMeters: number) =>
    t.http.post("/api/admin/hoods").set(t.auth("admin1")).send({ name, city: "Ibadan", center, radiusMeters });
  const verify = (uid: string, at: { lng: number; lat: number }) => t.http.post("/api/users/me/verify-location").set(t.auth(uid)).send({ ...at, address: "4 Test Close" });

  it("a Hood may overlap another, as long as neither holds the other's centre", async () => {
    agodi = (await create("Agodi", east(3500), 1000).expect(201)).body.id as string;
    expect(agodi).toBeTruthy();
  });

  it("refuses a centre inside another Hood, and a radius that takes in another's centre", async () => {
    expect((await create("Bodija North", east(2000), 500).expect(409)).body.message).toMatch(/centre is inside Bodija/);
    // 4 km west: outside Bodija, but 4,500 m reaches its centre.
    expect((await create("Eleyele", east(-4000), 4500).expect(409)).body.message).toMatch(/cover the centre of Bodija/);
    expect(await t.hoods.countDocuments({ name: { $in: ["Bodija North", "Eleyele"] } })).toBe(0);
  });

  it("an address in the shared ground goes to the Hood on its side of the dividing line, not the nearer centre", async () => {
    for (const uid of ["near-agodi", "past-line", "agodi-only"]) await t.user(uid);
    // 800 m from Agodi's centre and 2,700 m from Bodija's, but on Bodija's side of the line.
    expect((await verify("near-agodi", east(2700)).expect(200)).body).toMatchObject({ verificationStatus: "verified", neighborhoodId: bodija });
    expect((await verify("past-line", east(2950)).expect(200)).body).toMatchObject({ verificationStatus: "verified", neighborhoodId: agodi });
    expect((await verify("agodi-only", east(3200)).expect(200)).body).toMatchObject({ verificationStatus: "verified", neighborhoodId: agodi });
  });

  it("each Hood keeps its own centre", async () => {
    for (const uid of ["at-bodija", "at-agodi"]) await t.user(uid);
    expect((await verify("at-bodija", BODIJA).expect(200)).body.neighborhoodId).toBe(bodija);
    expect((await verify("at-agodi", east(3500)).expect(200)).body.neighborhoodId).toBe(agodi);
  });

  describe("GET /admin/hoods/near: what the admin map draws", () => {
    const near = (at: { lng: number; lat: number }, uid = "admin1") => t.http.get("/api/admin/hoods/near").query(at).set(t.auth(uid));

    it("every Hood a Hood centred here could overlap, nearest first, whatever its city or status; not out of reach ones", async () => {
      // t.hood files these under Lagos: a different city from Bodija's Ibadan, and still shown.
      await t.hood("Moniya", east(-10_000).lng, east(-10_000).lat, 1000);
      // 30 km away, but 12 km across: a 20 km Hood here could reach it.
      await t.hood("Iseyin Road", east(-30_000).lng, east(-30_000).lat, 12_000);
      // 30 km away and 1 km across: out of reach of any Hood here.
      await t.hood("Oyo Road", east(30_000).lng, east(30_000).lat, 1000);
      await t.hoods.updateOne({ _id: await t.hood("Old Bodija", east(-6000).lng, east(-6000).lat, 1000) }, { $set: { status: "archived" } });

      const body = (await near(BODIJA).expect(200)).body as { name: string }[];
      expect(body.map((h) => h.name)).toEqual(["Bodija", "Agodi", "Old Bodija", "Moniya", "Iseyin Road"]);
      expect(body[1]).toEqual({ id: agodi, name: "Agodi", city: "Ibadan", status: "active", center: east(3500), radiusMeters: 1000 });
      // Archived Hoods are drawn so a new one can keep clear of them, in case they reopen.
      expect(body[2]).toMatchObject({ name: "Old Bodija", status: "archived" });
    });

    it("needs a valid point, and staff", async () => {
      await near({ lng: BODIJA.lng, lat: 91 }).expect(400);
      await t.member("resident", bodija);
      await near(BODIJA, "resident").expect(403);
    });
  });

  describe("PATCH /admin/hoods/:id with a centre: moving a Hood", () => {
    const patch = (id: string, body: object) => t.http.patch(`/api/admin/hoods/${id}`).set(t.auth("admin1")).send(body);

    it("checks the new centre like a new Hood's, and leaves the Hood where it was when refused", async () => {
      expect((await patch(agodi, { center: east(2000) }).expect(409)).body.message).toMatch(/centre is inside Bodija/);
      // 5 km east is outside Bodija, but 5,500 m from there reaches its centre.
      expect((await patch(agodi, { center: east(5000), radiusMeters: 5500 }).expect(409)).body.message).toMatch(/cover the centre of Bodija/);
      const stored = await t.hoods.findById(agodi).lean().exec();
      expect(stored).toMatchObject({ radiusMeters: 1000, location: { coordinates: [east(3500).lng, east(3500).lat] } });
    });

    it("moves the boundary for address checks from then on", async () => {
      await t.user("east-of-agodi");
      // 1,300 m from Agodi's centre: outside every Hood until Agodi moves 500 m east.
      expect((await verify("east-of-agodi", east(4800)).expect(200)).body).toMatchObject({ verificationStatus: "unverified", reason: "outside_coverage" });
      expect((await patch(agodi, { center: east(4000) }).expect(200)).body).toMatchObject({ center: east(4000), radiusMeters: 1000 });
      expect((await verify("east-of-agodi", east(4800)).expect(200)).body).toMatchObject({ verificationStatus: "verified", neighborhoodId: agodi });
    });
  });

  // Agodi is now 4,000 m east of Bodija's centre, 1,000 m across.
  describe("Seeing the Hood before joining it", () => {
    const preview = (uid: string, at: { lng: number; lat: number }) => t.http.post("/api/users/me/verify-location/preview").set(t.auth(uid)).send(at);
    const confirm = (uid: string, at: { lng: number; lat: number }, neighborhoodId: string) =>
      t.http.post("/api/users/me/verify-location").set(t.auth(uid)).send({ ...at, address: "4 Test Close", neighborhoodId });
    const record = (uid: string) => t.users.findOne({ uid }).lean();

    it("the preview says which Hood a point would join, and changes and records nothing", async () => {
      await t.user("previewer");
      expect((await preview("previewer", east(1000)).expect(200)).body).toMatchObject({ hood: { id: bodija, name: "Bodija" }, distanceMeters: 1000, nearbyHoods: [] });
      // 1,600 m from Agodi's centre: outside every Hood, close enough to ask to join.
      const outside = (await preview("previewer", east(5600)).expect(200)).body as { hood: null; nearbyHoods: { id: string }[] };
      expect(outside.hood).toBeNull();
      expect(outside.nearbyHoods[0]?.id).toBe(agodi);
      expect(await record("previewer")).toMatchObject({ verificationStatus: "unverified", verificationAttempts: [] });
    });

    it("the preview tells a verified neighbour that moving is a request (contract §31)", async () => {
      await t.member("settler", bodija);
      expect((await preview("settler", east(4000)).expect(200)).body).toMatchObject({ hood: { id: agodi }, cannotJoin: expect.stringMatching(/Bodija.*ask us to move you/) });
    });

    it("verifies only into the Hood the neighbour confirmed", async () => {
      await t.user("confirmer");
      expect((await confirm("confirmer", east(4200), bodija).expect(409)).body.message).toBe("That pin is in Agodi, not Bodija. Check it and confirm again.");
      expect((await confirm("confirmer", east(5600), bodija).expect(409)).body.message).toBe("That pin isn't in Bodija any more. Check it and confirm again.");
      expect(await record("confirmer")).toMatchObject({ verificationStatus: "unverified", verificationAttempts: [] });
      expect((await confirm("confirmer", east(1000), bodija).expect(200)).body).toMatchObject({ verificationStatus: "verified", neighborhoodId: bodija });
    });

    it("needs a valid point", async () => {
      await preview("previewer", { lng: BODIJA.lng, lat: 91 }).expect(400);
    });
  });
});
