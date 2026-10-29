import { STORAGE_PROVIDER } from "../src/storage/providers/storage-provider";
import type { StorageProvider } from "../src/storage/providers/storage-provider";
import { REMOTE_FILE_FETCHER } from "../src/storage/storage.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const MB = 1024 * 1024;

/**
 * Audit B12: the upload routes had no capability and no per-person allowance, so any account,
 * however new or restricted, could store 100 MB videos and make the server download files.
 */
describe("Who may upload what, and how much in a day", () => {
  let t: TestApp;
  let lekki: string;
  const stored: string[] = [];
  let downloads = 0;
  /** Each stored file reports this size, so a test can fill someone's day quickly. */
  let fileBytes = 68;
  const storage: StorageProvider = {
    name: "fake",
    upload: async (f) => {
      const providerId = `${f.folder}/f${stored.length}`;
      stored.push(providerId);
      return { providerId, url: `https://cdn.test/${providerId}.jpg`, resourceType: f.resourceType, format: "jpg", bytes: fileBytes, width: 1080, height: 1350 };
    },
    delete: async () => undefined,
    url: (providerId) => `https://cdn.test/${providerId}`,
  };

  beforeAll(async () => {
    // A small daily allowance, so the limit is reached in a handful of requests.
    process.env.STORAGE_DAILY_UPLOADS = "5";
    process.env.STORAGE_DAILY_UPLOAD_MB = "10";
    t = await createTestApp((b) =>
      b
        .overrideProvider(STORAGE_PROVIDER)
        .useValue(storage)
        .overrideProvider(REMOTE_FILE_FETCHER)
        .useValue(async () => {
          downloads++;
          throw new Error("a test must not download anything");
        }),
    );
    lekki = await t.hood("Lekki Phase 1");
    await t.member("ada", lekki);
    await t.user("newbie");
    await t.user("waiting", { verificationStatus: "pending_review" });
    await t.member("rex", lekki, { verificationStatus: "rejected" });
    await t.member("restricted", lekki, { accountStatus: "restricted", restrictedUntil: new Date(Date.now() + 86_400_000) });
  });
  afterAll(async () => {
    delete process.env.STORAGE_DAILY_UPLOADS;
    delete process.env.STORAGE_DAILY_UPLOAD_MB;
    await t.close();
  });
  beforeEach(async () => {
    t.resetThrottle();
    fileBytes = 68;
    await t.model("MediaAsset").deleteMany({});
  });

  const upload = (uid: string, purpose: string) => t.http.post("/api/media").set(t.auth(uid)).field("purpose", purpose).attach("file", JPEG, "photo.jpg");
  const importLink = (uid: string, purpose: string) => t.http.post("/api/media/import").set(t.auth(uid)).send({ url: "https://example.com/photo.jpg", purpose });
  const direct = (uid: string, purpose: string) => t.http.post("/api/media/direct").set(t.auth(uid)).send({ purpose, mimetype: "video/mp4", size: 5 * MB });
  const CONTENT = ["post", "listing", "group"] as const;

  describe("content media (post, listing, group) is for people who may post", () => {
    it.each(["newbie", "waiting", "rex", "restricted"])("%s can't upload, import or start a direct upload of it", async (uid) => {
      const before = stored.length;
      for (const purpose of CONTENT) {
        const res = await upload(uid, purpose).expect(403);
        expect(res.body.message).toEqual(expect.any(String));
        await importLink(uid, purpose).expect(403);
        await direct(uid, purpose).expect(403);
      }
      expect(stored.length).toBe(before);
      // Refused before the server went to fetch anything for them.
      expect(downloads).toBe(0);
      expect(await t.model("MediaAsset").countDocuments({ ownerUid: uid })).toBe(0);
    });

    it("tells someone unverified to verify, and someone restricted that they're restricted", async () => {
      expect((await upload("newbie", "post").expect(403)).body.message).toMatch(/verify your address/i);
      expect((await upload("restricted", "post").expect(403)).body.message).toMatch(/restricted/i);
    });

    it("a verified, active neighbour uploads all three", async () => {
      for (const purpose of CONTENT) await upload("ada", purpose).expect(201);
    });
  });

  describe("a profile photo is for anyone with an account", () => {
    it.each(["newbie", "waiting", "rex", "restricted", "ada"])("%s can set one (onboarding asks for it before verification)", async (uid) => {
      const res = await upload(uid, "avatar").expect(201);
      expect(res.body.url).toMatch(/\/avatar\//);
    });
  });

  describe("each person's daily allowance", () => {
    it("stops at the number of files allowed in 24 hours, with words that say so", async () => {
      for (let i = 0; i < 5; i++) await upload("ada", "post").expect(201);
      const res = await upload("ada", "post").expect(429);
      expect(res.body.message).toMatch(/upload limit/i);
      // A rule of ours, not the rate limiter: no Retry-After, so the web shows these words.
      expect(res.headers["retry-after"]).toBeUndefined();
      // Every way in counts against the same allowance.
      await importLink("ada", "post").expect(429);
      await direct("ada", "post").expect(429);
      await upload("ada", "avatar").expect(429);
      expect(downloads).toBe(0);
      // It is hers alone.
      await upload("newbie", "avatar").expect(201);
    });

    it("stops at the total size allowed in 24 hours", async () => {
      fileBytes = 4 * MB;
      await upload("ada", "post").expect(201);
      await upload("ada", "post").expect(201);
      // 8 MB kept so far; the allowance is 10 MB. A third 4 MB file is stored, then found to tip it over.
      await upload("ada", "post").expect(201);
      const res = await upload("ada", "post").expect(429);
      expect(res.body.message).toMatch(/upload limit/i);
      // A direct upload states its size up front, so it is refused before a ticket is issued.
      await direct("ada", "post").expect(429);
    });

    it("counts the last 24 hours only, and only files still kept", async () => {
      const assets = t.model<{ ownerUid: string; createdAt: Date }>("MediaAsset");
      for (let i = 0; i < 5; i++) await upload("ada", "post").expect(201);
      await upload("ada", "post").expect(429);
      // Yesterday's uploads no longer count…
      // (Through the driver: Mongoose won't change `createdAt`, which is the point of it.)
      await assets.collection.updateMany({ ownerUid: "ada" }, { $set: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
      const fresh = await upload("ada", "post").expect(201);
      // (This test is about the daily allowance, not the 10-a-second burst limit it would otherwise meet next.)
      t.resetThrottle();
      // …and neither does one she has deleted since.
      for (let i = 0; i < 4; i++) await upload("ada", "post").expect(201);
      await upload("ada", "post").expect(429);
      await t.http.delete(`/api/media/${fresh.body.id}`).set(t.auth("ada")).expect(204);
      await upload("ada", "post").expect(201);
    });

    it("finds a day's uploads through an index, not by reading every file anyone has stored", async () => {
      const plan = (await t.model("MediaAsset").find({ ownerUid: "ada", createdAt: { $gte: new Date(Date.now() - 86_400_000) } }).explain("queryPlanner")) as unknown as { queryPlanner: { winningPlan: unknown } };
      const stages = JSON.stringify(plan.queryPlanner.winningPlan);
      expect(stages).toContain('"indexName":"ownerUid_1_createdAt_-1"');
      expect(stages).not.toContain("COLLSCAN");
    });
  });
});
