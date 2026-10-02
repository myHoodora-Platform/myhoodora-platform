import type { AddressInfo } from "node:net";
import { STORAGE_PROVIDER } from "../src/storage/providers/storage-provider";
import type { StorageProvider } from "../src/storage/providers/storage-provider";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Leading bytes are what the API reads the type from, whatever the file is called. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(64)]);
const PDF = Buffer.from("%PDF-1.7 not a photo");

describe("Media, search and the live stream (wired through the real guards)", () => {
  let t: TestApp;
  let lekki: string;
  let yaba: string;
  const stored: string[] = [];
  const deleted: string[] = [];
  const storage: StorageProvider = {
    name: "fake",
    upload: async (f) => {
      const providerId = `${f.folder}/f${stored.length}`;
      stored.push(providerId);
      return { providerId, url: `https://cdn.test/${providerId}.${f.resourceType === "video" ? "mp4" : "jpg"}`, resourceType: f.resourceType, format: f.resourceType === "video" ? "mp4" : "jpg", bytes: 68, width: 1080, height: 1350, ...(f.resourceType === "video" && { durationSeconds: 12 }) };
    },
    delete: async (providerId) => void deleted.push(providerId),
    url: (providerId) => `https://cdn.test/${providerId}`,
  };

  beforeAll(async () => {
    t = await createTestApp((b) => b.overrideProvider(STORAGE_PROVIDER).useValue(storage));
    lekki = await t.hood("Lekki Phase 1");
    yaba = await t.hood("Yaba", 3.3711, 6.5095, 1500);
    await t.member("ada", lekki, { displayName: "Ada Plumbing" });
    await t.member("bola", lekki);
    await t.member("tunde", yaba);
    await t.user("newbie");
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  describe("POST /media", () => {
    const upload = (uid: string | null, file: Buffer, name: string, purpose = "post") => {
      const req = t.http.post("/api/media");
      if (uid) void req.set(t.auth(uid));
      return req.field("purpose", purpose).attach("file", file, name);
    };

    it("stores a photo for its owner and returns the url, id and dimensions", async () => {
      const res = await upload("ada", JPEG, "street.jpg").expect(201);
      expect(res.body).toMatchObject({ resourceType: "image", width: 1080, height: 1350, bytes: 68 });
      expect(res.body.url).toMatch(/^https:\/\/cdn\.test\/myhoodora\/test\/post\//);
      expect(res.body.id).toMatch(/^[a-f0-9]{24}$/);
      expect(await t.model("MediaAsset").countDocuments({ ownerUid: "ada", url: res.body.url })).toBe(1);

      // The stored shape then travels with the post, so the feed can frame it before it loads.
      const post = await t.http.post("/api/posts").set(t.auth("ada")).send({ message: "My street", mediaUrls: [res.body.url] }).expect(201);
      expect(post.body.mediaAspects).toEqual([0.8]);
    });

    it("a listing's photos carry their shape too", async () => {
      const photo = (await upload("ada", JPEG, "chair.jpg", "listing").expect(201)).body as { url: string };
      const listing = await t.http
        .post("/api/listings")
        .set(t.auth("ada"))
        .send({ title: "Office chair", priceNaira: 25000, category: "furniture", condition: "good", photos: [photo.url, "https://images.unsplash.com/photo-1.jpg"] })
        .expect(201);
      expect(listing.body.photoAspects).toEqual([0.8, null]);
      const fetched = await t.http.get(`/api/listings/${listing.body._id}`).set(t.auth("bola")).expect(200);
      expect(fetched.body.photoAspects).toEqual([0.8, null]);
    });

    it("needs a signed-in person, a file and a known purpose", async () => {
      await upload(null, JPEG, "a.jpg").expect(401);
      await t.http.post("/api/media").set(t.auth("ada")).field("purpose", "post").expect(400);
      await upload("ada", JPEG, "a.jpg", "anything").expect(400);
    });

    it("reads the type from the bytes: a PDF named .jpg is refused", async () => {
      await upload("ada", PDF, "holiday.jpg").expect(400);
    });

    it("takes video for posts only", async () => {
      const ok = await upload("ada", MP4, "clip.mp4").expect(201);
      expect(ok.body).toMatchObject({ resourceType: "video", durationSeconds: 12 });
      await upload("ada", MP4, "clip.mp4", "listing").expect(400);
    });

    it("only the owner can delete a file; it leaves storage and the record goes", async () => {
      const mine = (await upload("ada", JPEG, "gate.jpg").expect(201)).body as { id: string };
      await t.http.delete(`/api/media/${mine.id}`).set(t.auth("bola")).expect(404);
      await t.http.delete(`/api/media/${mine.id}`).expect(401);
      await t.http.delete("/api/media/not-an-id").set(t.auth("ada")).expect(400);
      const before = deleted.length;
      await t.http.delete(`/api/media/${mine.id}`).set(t.auth("ada")).expect(204);
      expect(deleted.length).toBe(before + 1);
      await t.http.delete(`/api/media/${mine.id}`).set(t.auth("ada")).expect(404);
    });

    it("direct uploads are off by default: the client is told to use POST /media", async () => {
      const res = await t.http.post("/api/media/direct").set(t.auth("ada")).send({ purpose: "post", mimetype: "video/mp4", size: 1_000_000 }).expect(201);
      expect(res.body).toEqual({ id: null, upload: null });
    });
  });

  describe("GET /search", () => {
    beforeAll(async () => {
      await t.post("ada", { message: "Looking for a good plumber near Admiralty Way" });
      await t.post("tunde", { message: "Plumber wanted in Yaba" });
      await t.http.post("/api/listings").set(t.auth("bola")).send({ title: "Plumber tools set", description: "Wrenches and pipe cutters, barely used.", priceNaira: 15000, negotiable: true, category: "other", condition: "good", photos: [] }).expect(201);
    });

    it("finds posts, listings and neighbours in the caller's own Hood only", async () => {
      const res = (await t.http.get("/api/search?q=plumb").set(t.auth("bola")).expect(200)).body as { q: string; posts: { message: string }[]; listings: { title: string }[]; people: { displayName: string }[] };
      expect(res.q).toBe("plumb");
      expect(res.posts.map((p) => p.message)).toEqual(["Looking for a good plumber near Admiralty Way"]);
      expect(res.listings.map((l) => l.title)).toEqual(["Plumber tools set"]);
      expect(res.people.map((p) => p.displayName)).toEqual(["Ada Plumbing"]);

      const other = (await t.http.get("/api/search?q=plumb").set(t.auth("tunde")).expect(200)).body as { posts: { message: string }[]; listings: unknown[] };
      expect(other.posts.map((p) => p.message)).toEqual(["Plumber wanted in Yaba"]);
      expect(other.listings).toEqual([]);
    });

    it("narrows to one type, and is case-insensitive", async () => {
      const res = (await t.http.get("/api/search?q=PLUMB&type=listings&limit=5").set(t.auth("ada")).expect(200)).body as Record<string, unknown>;
      expect(Object.keys(res).sort()).toEqual(["listings", "q"]);
    });

    it("treats the query as text, not a pattern", async () => {
      const res = (await t.http.get(`/api/search?q=${encodeURIComponent(".*")}`).set(t.auth("ada")).expect(200)).body as { posts: unknown[] };
      expect(res.posts).toEqual([]);
    });

    it("validates input and needs a signed-in person; someone with no Hood gets empty results", async () => {
      await t.http.get("/api/search?q=plumb").expect(401);
      await t.http.get("/api/search?q=p").set(t.auth("ada")).expect(400);
      await t.http.get("/api/search").set(t.auth("ada")).expect(400);
      await t.http.get("/api/search?q=plumb&type=secrets").set(t.auth("ada")).expect(400);
      await t.http.get("/api/search?q=plumb&limit=500").set(t.auth("ada")).expect(400);
      const none = (await t.http.get("/api/search?q=plumb").set(t.auth("newbie")).expect(200)).body as { posts: unknown[]; listings: unknown[]; people: unknown[] };
      expect([none.posts, none.listings, none.people]).toEqual([[], [], []]);
    });
  });

  describe("GET /realtime/stream", () => {
    let base: string;
    beforeAll(async () => {
      await t.app.listen(0);
      base = `http://127.0.0.1:${(t.app.getHttpServer().address() as AddressInfo).port}`;
    });

    /** Opens the stream and resolves with the event names seen until `until` arrives (or it times out). */
    async function listen(uid: string, until: string, act: () => Promise<unknown>): Promise<string[]> {
      const abort = new AbortController();
      const res = await fetch(`${base}/api/realtime/stream`, { headers: { ...t.auth(uid), Accept: "text/event-stream" }, signal: abort.signal });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      expect(res.headers.get("cache-control")).toContain("no-cache");
      const reader = res.body!.getReader();
      const seen: string[] = [];
      const timeout = setTimeout(() => abort.abort(), 8_000);
      let acted = false;
      let text = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          text += new TextDecoder().decode(value);
          for (const m of text.matchAll(/event: ([\w.]+)/g)) if (!seen.includes(m[1]!)) seen.push(m[1]!);
          if (seen.includes("ready") && !acted) {
            acted = true;
            await act();
          }
          if (seen.includes(until)) break;
        }
      } catch {
        // Aborted by the timeout: return what was seen, and let the assertion explain.
      } finally {
        clearTimeout(timeout);
        abort.abort();
      }
      return seen;
    }

    it("refuses a stream without a valid token", async () => {
      expect((await fetch(`${base}/api/realtime/stream`)).status).toBe(401);
      expect((await fetch(`${base}/api/realtime/stream`, { headers: { Authorization: "Bearer nonsense" } })).status).toBe(401);
    });

    it("says ready, then delivers a neighbour's new post to people in the same Hood", async () => {
      const seen = await listen("bola", "post.created", () => t.post("ada", { message: "Generator repair guy on Road 3 is good" }));
      expect(seen[0]).toBe("ready");
      expect(seen).toContain("post.created");
    });

    it("tells the author when someone comments (a notification), and nobody in another Hood", async () => {
      const post = await t.post("ada", { message: "Anyone selling a ladder?" });
      const mine = await listen("ada", "notification.created", () => t.http.post(`/api/posts/${post._id}/comments`).set(t.auth("bola")).send({ content: "I have one you can borrow." }).expect(201));
      expect(mine).toContain("notification.created");

      const elsewhere = await listen("tunde", "post.created", async () => {
        await t.post("ada", { message: "Lekki only news" });
        await new Promise((r) => setTimeout(r, 400));
        // Something tunde *does* get, to end the wait: his own Hood's post.
        await t.post("tunde", { message: "Yaba news" });
      });
      expect(elsewhere.filter((e) => e === "post.created")).toHaveLength(1);
    });
  });
});
