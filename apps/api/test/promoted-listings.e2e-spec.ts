import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

interface Promo {
  _id: string;
  format: string;
  advertiser: { name: string; logoUrl?: string };
  cta: { type: string; label: string; url?: string } | null;
  seller?: { uid: string; name: string };
  listings?: { _id: string; title: string; priceNaira: number | null; photoUrl?: string }[];
}
type Item = { type: "post"; data: { _id: string } } | { type: "ad"; slotId: string; data: Promo };

const PHOTO = (n: number) => `https://res.cloudinary.com/test/image/upload/item-${n}.jpg`;

/**
 * Admins promote a seller: their For Sale items appear as a sponsored card in the neighbourhoods the
 * ad reaches, and neighbours there may open those items and see all of the seller's items.
 */
describe("Promoted listings (a seller's items as an ad)", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  let wuse: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    t = await createTestApp();
    lekki = await t.hood();
    yaba = await t.hood("Yaba", 3.3792, 6.5095);
    wuse = await t.hood("Wuse", 7.4613, 9.0765);
    await t.member("boss", lekki, { role: "admin" });
    await t.member("ada", lekki);
    await t.member("emeka", wuse);
    await t.member("sade", yaba, { displayName: "Sade Bello" });
    await t.member("tunde", yaba, { displayName: "Tunde Ojo" });

    const now = Date.now();
    const listing = (sellerUid: string, title: string, minsAgo: number, extra: Record<string, unknown> = {}) => ({
      sellerUid,
      neighborhoodId: yaba,
      title,
      description: "",
      priceNaira: 25000,
      negotiable: false,
      category: "furniture",
      condition: "good",
      photos: [PHOTO(minsAgo)],
      status: "available",
      createdAt: new Date(now - minsAgo * 60_000),
      ...extra,
    });
    const rows = await t.model<{ _id: unknown; title: string }>("Listing").insertMany([
      listing("sade", "Office chair", 10),
      listing("sade", "Bookshelf", 5),
      listing("sade", "Old fan", 1, { status: "sold" }),
      listing("tunde", "Bicycle", 3, { status: "sold" }),
    ]);
    for (const r of rows) ids[r.title] = String(r._id);

    // Enough posts in Lekki for ads to be placed.
    const post = (i: number) => ({ authorUid: "ada", neighborhoodId: lekki, type: "text", category: "general", content: `Post ${i}`, message: `Post ${i}`, createdAt: new Date(now - (100 - i) * 60_000) });
    await t.model("FeedPost").insertMany(Array.from({ length: 20 }, (_, i) => post(i)));
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const admin = () => t.auth("boss");
  const create = (body: Record<string, unknown>) => t.http.post("/api/admin/ads").set(admin()).send(body);
  const status = (id: string, s: string) => t.http.put(`/api/admin/ads/${id}/status`).set(admin()).send({ status: s });
  const promos = async (uid: string, hood: string) =>
    ((await t.http.get(`/api/feed/hood/${hood}?session=promoSession1&limit=20&supports=listings`).set(t.auth(uid)).expect(200)).body.items as Item[]).flatMap((i) => (i.type === "ad" && i.data.format === "listings" ? [i.data] : []));
  const promo = { title: "Sade's furniture, October", advertiserName: "Sade", format: "listings", hoodIds: [] as string[] };

  it("needs a seller with an account, and no uploaded photos; the text is optional", async () => {
    const draft = (await create({ ...promo }).expect(201)).body as { _id: string };
    expect((await status(draft._id, "active").expect(400)).body.message).toMatch(/seller/);
    expect((await create({ ...promo, sellerUid: "nobody" }).expect(400)).body.message).toMatch(/doesn't have an account/);
    const ok = (await create({ ...promo, sellerUid: "sade" }).expect(201)).body as { _id: string; seller: { displayName: string } };
    expect(ok.seller.displayName).toBe("Sade Bello");
    await status(ok._id, "active").expect(200);
    await status(ok._id, "paused").expect(200);
  });

  it("before any promotion, another neighbourhood's items stay out of reach", async () => {
    await t.http.get(`/api/listings/${ids["Office chair"]}`).set(t.auth("ada")).expect(404);
    expect((await t.http.get(`/api/listings?neighborhoodId=${lekki}&seller=sade`).set(t.auth("ada")).expect(200)).body).toEqual([]);
  });

  describe("while promoted to Lekki", () => {
    let adId: string;
    beforeAll(async () => {
      adId = (await create({ ...promo, sellerUid: "sade", hoodIds: [lekki] }).expect(201)).body._id;
    });
    beforeEach(async () => {
      await status(adId, "active").expect(200);
    });

    it("Lekki's feed shows the seller's available items, newest first, under the seller's name", async () => {
      const [card] = await promos("ada", lekki);
      expect(card).toBeDefined();
      expect(card!.advertiser.name).toBe("Sade Bello");
      expect(card!.seller).toEqual(expect.objectContaining({ uid: "sade", name: "Sade Bello" }));
      expect(card!.listings!.map((l) => l.title)).toEqual(["Bookshelf", "Office chair"]);
      expect(card!.listings![0]!.photoUrl).toBe(PHOTO(5));
      expect(card!.cta).toEqual({ type: "shop", label: "See all from Sade" });
    });

    it("Lekki neighbours may open her items and see all of them", async () => {
      await t.http.get(`/api/listings/${ids["Bookshelf"]}`).set(t.auth("ada")).expect(200);
      const all = (await t.http.get(`/api/listings?neighborhoodId=${lekki}&seller=sade`).set(t.auth("ada")).expect(200)).body as { title: string }[];
      expect(all.map((l) => l.title)).toEqual(["Bookshelf", "Office chair"]);
      // Only hers: someone else in her neighbourhood stays out of reach.
      await t.http.get(`/api/listings/${ids["Bicycle"]}`).set(t.auth("ada")).expect(404);
    });

    it("an older app that doesn't ask for them isn't sent them", async () => {
      const items = (await t.http.get(`/api/feed/hood/${lekki}?session=promoSession2&limit=20`).set(t.auth("ada")).expect(200)).body.items as Item[];
      expect(items.some((i) => i.type === "ad" && i.data.format === "listings")).toBe(false);
    });

    it("a neighbourhood it doesn't reach sees nothing of it", async () => {
      expect(await promos("emeka", wuse)).toEqual([]);
      await t.http.get(`/api/listings/${ids["Bookshelf"]}`).set(t.auth("emeka")).expect(404);
    });

    it("someone who blocked the seller isn't shown it", async () => {
      await t.model("User").updateOne({ uid: "ada" }, { $addToSet: { blockedUids: "sade" } });
      try {
        expect(await promos("ada", lekki)).toEqual([]);
      } finally {
        await t.model("User").updateOne({ uid: "ada" }, { $pull: { blockedUids: "sade" } });
      }
    });

    it("paused, it's gone and so is the access", async () => {
      await status(adId, "paused").expect(200);
      expect(await promos("ada", lekki)).toEqual([]);
      await t.http.get(`/api/listings/${ids["Bookshelf"]}`).set(t.auth("ada")).expect(404);
    });
  });

  it("a seller with nothing available isn't shown", async () => {
    const id = (await create({ ...promo, title: "Tunde", sellerUid: "tunde", hoodIds: [lekki] }).expect(201)).body._id as string;
    await status(id, "active").expect(200);
    expect(await promos("ada", lekki)).toEqual([]);
    await status(id, "paused").expect(200);
  });
});
