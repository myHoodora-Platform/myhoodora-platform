import { STORAGE_PROVIDER } from "../src/storage/providers/storage-provider";
import type { StorageProvider } from "../src/storage/providers/storage-provider";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const storage: StorageProvider = {
  name: "fake",
  upload: async (f) => ({ providerId: `${f.folder}/x`, url: `https://cdn.test/${f.folder}/x.jpg`, resourceType: f.resourceType, format: "jpg", bytes: 68, width: 10, height: 10 }),
  delete: async () => undefined,
  url: (id) => `https://cdn.test/${id}`,
};

/**
 * Audit B3, part 4 (decided 7 October 2026): an address check proves nothing about who someone is,
 * so writing to neighbours also needs an email address that has been confirmed.
 */
describe("Posting and messaging need a confirmed email", () => {
  let t: TestApp;
  let lekki: string;
  let postId: string;
  let conversationId: string;

  beforeAll(async () => {
    t = await createTestApp((b) => b.overrideProvider(STORAGE_PROVIDER).useValue(storage));
    lekki = await t.hood();
    await t.member("ada", lekki);
    await t.member("bola", lekki);
    // Verified by address, never confirmed their email.
    await t.member("uche", lekki, { emailVerifiedAt: null });
    postId = (await t.post("ada", { message: "Street party on Saturday", category: "event", eventDate: new Date(Date.now() + 3 * 86_400_000).toISOString(), eventLocation: "Road 12" }))._id;
    conversationId = (await t.http.post("/api/conversations").set(t.auth("ada")).send({ recipientUid: "uche" }).expect(201)).body._id;
    await t.http.post(`/api/conversations/${conversationId}/messages`).set(t.auth("ada")).send({ body: "Welcome to the street!" }).expect(201);
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());

  const as = (uid: string) => t.auth(uid);
  const upload = (uid: string, purpose: string) => t.http.post("/api/media").set(as(uid)).field("purpose", purpose).attach("file", JPEG, "a.jpg");

  it("without one, a verified neighbour still reads their Hood", async () => {
    expect((await t.http.get(`/api/posts/neighborhood/${lekki}`).set(as("uche")).expect(200)).body).toHaveLength(1);
    await t.http.get(`/api/posts/${postId}/comments`).set(as("uche")).expect(200);
    expect((await t.http.get(`/api/conversations/${conversationId}/messages`).set(as("uche")).expect(200)).body).toHaveLength(1);
    expect((await t.http.get("/api/users/me").set(as("uche")).expect(200)).body).toMatchObject({ verificationStatus: "verified", emailVerified: false });
  });

  it("but can't post, comment, list, start a group, upload content media or message, and is told why", async () => {
    const refused = [
      await t.http.post("/api/posts").set(as("uche")).send({ message: "Hello neighbours" }).expect(403),
      await t.http.post(`/api/posts/${postId}/comments`).set(as("uche")).send({ content: "Count me in" }).expect(403),
      await t.http.post("/api/listings").set(as("uche")).send({ title: "Standing fan", priceNaira: 20000, category: "home_appliances", condition: "good", photos: [] }).expect(403),
      await t.http.post("/api/groups").set(as("uche")).send({ name: "Road 12 Parents", description: "School runs and playdates.", category: "parents", privacy: "open", boundary: "neighbourhood" }).expect(403),
      await upload("uche", "post").expect(403),
      await t.http.post(`/api/conversations/${conversationId}/messages`).set(as("uche")).send({ body: "Thank you!" }).expect(403),
      await t.http.post("/api/conversations").set(as("uche")).send({ recipientUid: "bola" }).expect(403),
    ];
    for (const res of refused) expect(res.body.message).toMatch(/confirm your email/i);
    expect(await t.model("FeedPost").countDocuments({ authorUid: "uche" })).toBe(0);
  });

  it("what isn't writing to neighbours stays open: reacting, an RSVP, reporting, a profile photo, their own settings", async () => {
    await t.http.put(`/api/posts/${postId}/reaction`).set(as("uche")).send({ type: "like" }).expect((r) => expect(r.status).toBeLessThan(300));
    await t.http.put(`/api/posts/${postId}/rsvp`).set(as("uche")).send({ status: "going" }).expect(200);
    await t.http.post("/api/reports").set(as("uche")).send({ targetType: "post", targetId: postId, reason: "spam" }).expect(204);
    await upload("uche", "avatar").expect(201);
    await t.http.patch("/api/users/me").set(as("uche")).send({ bio: "New on Road 12" }).expect(200);
    // And they can ask for the link again, which is how they get out of this.
    await t.http.post("/api/auth/email-verification/resend").set(as("uche")).expect(202);
  });

  it("someone not verified by address is still told to do that first", async () => {
    await t.user("newbie");
    expect((await t.http.post("/api/posts").set(as("newbie")).send({ message: "Hi" }).expect(403)).body.message).toMatch(/verify your address/i);
  });

  it("once the email is confirmed, everything opens", async () => {
    await t.users.updateOne({ uid: "uche" }, { $set: { emailVerifiedAt: new Date() } });
    await t.http.post("/api/posts").set(as("uche")).send({ message: "Hello neighbours" }).expect(201);
    await t.http.post(`/api/conversations/${conversationId}/messages`).set(as("uche")).send({ body: "Thank you!" }).expect(201);
    await upload("uche", "post").expect(201);
  });

  it("a provider that has already proved the address (Google) counts as confirmed", async () => {
    await t.member("gina", lekki, { emailVerifiedAt: null });
    await t.http.post("/api/posts").set(t.auth("gina")).send({ message: "Hi" }).expect(403);
    await t.http.post("/api/posts").set(t.auth("gina", { emailVerified: true, provider: "google.com" })).send({ message: "Hi from Google sign-in" }).expect(201);
  });

  it("staff powers don't depend on it", async () => {
    await t.member("mod1", lekki, { role: "moderator", emailVerifiedAt: null });
    await t.http.get("/api/admin/overview").set(as("mod1")).expect(200);
    await t.http.post("/api/posts").set(as("mod1")).send({ message: "From a moderator" }).expect(403);
  });
});

/** EMAIL_CONFIRMATION_REQUIRED=false: for a deployment whose verification emails can't be delivered yet. */
describe("Posting and messaging with EMAIL_CONFIRMATION_REQUIRED=false", () => {
  let t: TestApp;
  beforeAll(async () => {
    process.env.EMAIL_CONFIRMATION_REQUIRED = "false";
    t = await createTestApp();
  });
  afterAll(async () => {
    delete process.env.EMAIL_CONFIRMATION_REQUIRED;
    await t.close();
  });

  it("an unconfirmed, address-verified neighbour posts and messages as before", async () => {
    const lekki = await t.hood();
    await t.member("ada", lekki);
    await t.member("uche", lekki, { emailVerifiedAt: null });
    await t.http.post("/api/posts").set(t.auth("uche")).send({ message: "Hello neighbours" }).expect(201);
    await t.http.post("/api/conversations").set(t.auth("uche")).send({ recipientUid: "ada" }).expect(201);
  });
});
