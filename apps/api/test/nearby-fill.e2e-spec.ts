import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

type Item = { _id: string; message: string; neighborhoodId: string; nearby?: { hoodName: string }; pinned?: boolean };

/** Nearby fill (plan WP-G, contract §44): a quiet Hood's feed shows what the Hoods next door opened up. */
describe("Nearby fill", () => {
  let t: TestApp;
  let busy: string;
  let quiet: string;
  let far: string;
  const v = { emailVerified: true };
  const feed = async (uid: string, hood: string, qs = "") => (await t.http.get(`/api/posts/neighborhood/${hood}?limit=10${qs}`).set(t.auth(uid, v)).expect(200)).body as Item[];

  beforeAll(async () => {
    t = await createTestApp();
    busy = await t.hood("Lekki Phase 1", 3.4746, 6.4478, 1500);
    quiet = await t.hood("Lekki Phase 2", 3.5, 6.44, 1500);
    far = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    await t.member("ada", busy, { displayName: "Ada" });
    await t.member("kemi", quiet);
    await t.member("tunde", far);
    await t.member("blocker", busy, { blockedUids: ["kemi"] } as never);
    await t.users.insertMany(Array.from({ length: 100 }, (_, i) => ({ uid: `n${i}`, email: `n${i}@t.dev`, displayName: `N ${i}`, neighborhoodId: busy, verificationStatus: "verified", ageConfirmedAt: new Date(), emailVerifiedAt: new Date() })));
    for (let i = 0; i < 6; i++) await t.post(`n${i}`, { message: `Lekki for everyone ${i}`, visibility: "anyone" });
    await t.post("ada", { message: "Lekki and next door only", visibility: "nearby" });
    await t.post("ada", { message: "Lekki only", visibility: "neighbourhood" });
    await t.post("ada", { message: "Robbery near the gate", category: "alert", alertCategory: "security", visibility: "anyone" });
    await t.post("blocker", { message: "From someone who blocked Kemi", visibility: "anyone" });
    await t.post("kemi", { message: "Hello Phase 2" });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  it("fills a quiet Hood with Anyone and Nearby posts from next door, labelled; never Hood-only posts, alerts or blocked people", async () => {
    const items = await feed("kemi", quiet);
    expect(items[0]!.message).toBe("Hello Phase 2");
    const filled = items.filter((i) => i.nearby);
    expect(filled.length).toBeGreaterThanOrEqual(5);
    expect(items.length).toBeLessThan(10); // under a page: paging stays on the Hood's own posts
    expect(filled.every((i) => i.nearby!.hoodName === "Lekki Phase 1" && i.neighborhoodId === busy)).toBe(true);
    const text = JSON.stringify(items);
    expect(text).not.toMatch(/Lekki only|Robbery|blocked Kemi/);
    expect(text).toMatch(/Lekki and next door only/);
  });

  it("not for a far-away Hood, a busy Hood, later pages, a category or a Hood they only follow", async () => {
    expect((await feed("tunde", far)).some((i) => i.nearby)).toBe(false);
    expect((await feed("ada", busy)).some((i) => i.nearby)).toBe(false);
    expect((await feed("kemi", quiet, `&before=${encodeURIComponent(new Date().toISOString())}`)).some((i) => i.nearby)).toBe(false);
    expect((await feed("kemi", quiet, "&category=general")).some((i) => i.nearby)).toBe(false);
    await t.users.updateOne({ uid: "tunde" }, { $set: { secondaryHoods: [{ id: quiet, name: "Lekki Phase 2", since: new Date() }] } });
    expect((await feed("tunde", quiet)).some((i) => i.nearby)).toBe(false);
  });

  it("the app's feed (with ads) pages the same way", async () => {
    const page = (await t.http.get(`/api/feed/hood/${quiet}?limit=10&session=nearbytest01`).set(t.auth("kemi", v)).expect(200)).body as { items: { type: string; data: Item }[]; nextCursor: string | null };
    expect(page.nextCursor).toBeNull();
    expect(page.items.some((i) => i.type === "post" && i.data.nearby)).toBe(true);
  });
});
