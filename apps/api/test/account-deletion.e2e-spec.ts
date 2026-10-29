import { SessionRevocationService } from "../src/auth/session-revocation.service";
import { JobsService } from "../src/jobs/jobs.service";
import { STORAGE_PROVIDER } from "../src/storage/providers/storage-provider";
import type { StorageProvider } from "../src/storage/providers/storage-provider";
import { StorageService } from "../src/storage/storage.service";
import { AccountDeletionService } from "../src/users/account-deletion.service";
import { createTestApp, type TestApp } from "./helpers/app";
import { firebaseState } from "./helpers/firebase-mock";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const DAY = 86_400_000;
const HOUR = 3_600_000;

/** A storage provider that remembers what it was asked to delete. */
function fakeStorage() {
  const deleted: string[] = [];
  let n = 0;
  const provider: StorageProvider = {
    name: "fake",
    upload: async (f) => {
      const providerId = `${f.folder}/f${n++}`;
      return { providerId, url: `https://cdn.test/${providerId}.jpg`, resourceType: f.resourceType, format: "jpg", bytes: 68, width: 10, height: 10 };
    },
    delete: async (providerId) => void deleted.push(providerId),
    url: (providerId) => `https://cdn.test/${providerId}`,
  };
  return { provider, deleted };
}

/** Starts the API in the given deletion mode, with a Hood and a moderator. */
async function boot(mode: "live" | "dry-run" | "off") {
  // The stub Firebase is shared by every app in this file: each starts with nobody deleted.
  firebaseState.deleted.clear();
  process.env.DATA_DELETION_MODE = mode;
  const storage = fakeStorage();
  const t = await createTestApp((b) => b.overrideProvider(STORAGE_PROVIDER).useValue(storage.provider));
  delete process.env.DATA_DELETION_MODE;
  const lekki = await t.hood();
  await t.member("bola", lekki, { displayName: "Bola Ade" });
  await t.member("chidi", lekki);
  await t.member("mod1", lekki, { role: "moderator" });
  for (const service of [AccountDeletionService, JobsService]) {
    const logger = (t.app.get(service) as unknown as { logger: Record<"log" | "warn" | "error", () => void> }).logger;
    jest.spyOn(logger, "log").mockImplementation(() => undefined);
    jest.spyOn(logger, "warn").mockImplementation(() => undefined);
  }
  return { t, lekki, storage };
}

const upload = async (t: TestApp, uid: string, purpose: string) => (await t.http.post("/api/media").set(t.auth(uid)).field("purpose", purpose).attach("file", JPEG, "a.jpg").expect(201)).body as { id: string; url: string };
/** Stands in for time passing: the account was deactivated this many days ago. */
const deactivatedDaysAgo = (t: TestApp, uid: string, days: number) => t.users.updateOne({ uid }, { $set: { deactivatedAt: new Date(Date.now() - days * DAY) } });
const fresh = (uid: string) => ({ Authorization: `Bearer t:${uid}:u:password:fresh` });

/** Gives `uid` one of everything a neighbour can leave behind, and deactivates them. Returns the ids. */
async function leaveEverythingBehind(t: TestApp, lekki: string, uid: string) {
  await t.member(uid, lekki, { displayName: "Ada Okafor", bio: "Road 12", location: { address: "12 Admiralty Way", lat: 6.44, lng: 3.47 }, verificationAttempts: [{ at: new Date(), lat: 6.44, lng: 3.47, address: "12 Admiralty Way", result: "matched" }] } as never);
  const as = t.auth(uid);
  const avatar = await upload(t, uid, "avatar");
  await t.http.patch("/api/users/me").set(as).send({ photoURL: avatar.url }).expect(200);
  const photo = await upload(t, uid, "post");
  const postId = (await t.post(uid, { message: "Selling my generator", mediaUrls: [photo.url] }))._id;
  const listingId = (await t.http.post("/api/listings").set(as).send({ title: "Standing fan", priceNaira: 20000, category: "home_appliances", condition: "good", photos: [] }).expect(201)).body._id as string;
  const bolaPostId = (await t.post("bola", { message: "Anyone know a plumber?" }))._id;
  await t.http.post(`/api/posts/${bolaPostId}/comments`).set(as).send({ content: "Try Musa on Road 4" }).expect(201);
  await t.http.post(`/api/posts/${bolaPostId}/comments`).set(t.auth("chidi")).send({ content: "Seconded" }).expect(201);
  // A group they run alone, with one other member; and one they run entirely alone.
  const sharedGroup = (await t.http.post("/api/groups").set(as).send({ name: `${uid} parents`, description: "School runs and playdates.", category: "parents", privacy: "open", boundary: "neighbourhood" }).expect(201)).body._id as string;
  await t.http.post(`/api/groups/${sharedGroup}/join`).set(t.auth("bola")).send({}).expect(200);
  await t.http.post(`/api/groups/${sharedGroup}/posts`).set(as).send({ content: "Who is doing the Friday run?" }).expect(201);
  const soloGroup = (await t.http.post("/api/groups").set(as).send({ name: `${uid} book club`, description: "One book a month, nobody else yet.", category: "hobbies", privacy: "open", boundary: "neighbourhood" }).expect(201)).body._id as string;
  const conversationId = (await t.http.post("/api/conversations").set(t.auth("bola")).send({ recipientUid: uid }).expect(201)).body._id as string;
  await t.http.post(`/api/conversations/${conversationId}/messages`).set(t.auth("bola")).send({ body: "Is the fan still available?" }).expect(201);
  await t.http.post(`/api/conversations/${conversationId}/messages`).set(as).send({ body: "Yes, come by tomorrow." }).expect(201);
  await t.http.post("/api/users/me/blocks").set(t.auth("chidi")).send({ uid }).expect(204);
  await t.model("HoodRole").create({ hoodId: lekki, uid, role: "lead", appointedBy: "mod1" });
  // Something staff decided about them: that history has to survive.
  await t.http.post("/api/reports").set(t.auth("bola")).send({ targetType: "post", targetId: postId, reason: "spam" }).expect(204);
  const caseId = ((await t.http.get("/api/admin/reports?status=all").set(t.auth("mod1")).expect(200)).body.items as { id: string; target: { id: string } }[]).find((c) => c.target.id === postId)!.id;
  await t.http.post(`/api/admin/reports/${caseId}/actions`).set(t.auth("mod1")).send({ action: "warn_author", reason: "Advertising" }).expect(201);
  await t.app.get(JobsService).drain();

  await t.http.post("/api/users/me/deactivate").set(as).send({ reason: "moved", details: "Leaving Lagos." }).expect(204);
  return { postId, listingId, bolaPostId, sharedGroup, soloGroup, conversationId, caseId, avatar, photo };
}

/**
 * Audit B5, second step, with B13: the privacy policy promises that 30 days after deactivating
 * "we delete or anonymise your personal data". Nothing did.
 */
describe("Account deletion, 30 days after deactivation (DATA_DELETION_MODE=live)", () => {
  let t: TestApp;
  let lekki: string;
  let storage: ReturnType<typeof fakeStorage>;
  let deletion: AccountDeletionService;
  let left: Awaited<ReturnType<typeof leaveEverythingBehind>>;

  beforeAll(async () => {
    ({ t, lekki, storage } = await boot("live"));
    deletion = t.app.get(AccountDeletionService);
    left = await leaveEverythingBehind(t, lekki, "ada");
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetThrottle());
  afterEach(() => {
    firebaseState.deleteDown = false;
  });

  it("at 29 days nothing is due, and signing in still restores the account", async () => {
    await deactivatedDaysAgo(t, "ada", 29);
    expect(await deletion.enqueueDue()).toBe(0);
    expect(await deletion.purge("ada")).toBeNull();

    await t.member("back", lekki);
    await t.http.post("/api/users/me/deactivate").set(t.auth("back")).send({ reason: "other" }).expect(204);
    await deactivatedDaysAgo(t, "back", 29);
    expect((await t.http.get("/api/users/me").set(fresh("back")).expect(200)).body.uid).toBe("back");
    expect((await t.users.findOne({ uid: "back" }).lean())?.deactivatedAt).toBeNull();
  });

  it("past 30 days the account can no longer be restored by signing in", async () => {
    await deactivatedDaysAgo(t, "ada", 31);
    const res = await t.http.get("/api/users/me").set(fresh("ada")).expect(410);
    expect(res.body.message).toMatch(/more than 30 days/);
    expect((await t.users.findOne({ uid: "ada" }).lean())?.deactivatedAt).toBeInstanceOf(Date);
  });

  it("if Firebase can't be reached the account is not marked deleted, and the job is retried", async () => {
    firebaseState.deleteDown = true;
    expect(await deletion.enqueueDue()).toBe(1);
    await t.app.get(JobsService).drain();
    expect((await t.users.findOne({ uid: "ada" }).lean())?.purgedAt ?? null).toBeNull();
    expect(await t.model("Job").findOne({ type: "account.purge", "payload.uid": "ada" }).lean()).toMatchObject({ status: "queued", attempts: 1 });
    // Already queued: looking again doesn't queue it twice.
    expect(await deletion.enqueueDue()).toBe(0);
  });

  describe("once the job has run", () => {
    beforeAll(async () => {
      firebaseState.deleteDown = false;
      await t.model("Job").updateOne({ type: "account.purge", "payload.uid": "ada" }, { $set: { runAt: new Date(Date.now() - 1000) } });
      await t.app.get(JobsService).drain();
    });

    it("the record holds nothing personal, and says when it was deleted", async () => {
      const record = (await t.users.findOne({ uid: "ada" }).lean())!;
      expect(record.purgedAt).toBeInstanceOf(Date);
      expect(record.email).toBe("deleted-ada@users.myhoodora.invalid");
      for (const gone of ["displayName", "photoURL", "bio", "location", "lastKnownLocation", "neighborhoodId", "verifiedAt"] as const) expect(record[gone]).toBeUndefined();
      expect(record).toMatchObject({ verificationAttempts: [], blockedUids: [], deactivation: null, requestedHood: null, role: "member", verificationStatus: "unverified", emailVerifiedAt: null });
      expect(JSON.stringify(record)).not.toMatch(/Okafor|Admiralty|Road 12|ada@test\.dev|Leaving Lagos/);
    });

    it("their Firebase sign-in is deleted, and signing in says the account is gone", async () => {
      expect(firebaseState.deleted.has("ada")).toBe(true);
      // A token minted just before deletion is refused at once: Firebase no longer knows them.
      await t.http.get("/api/users/me").set(fresh("ada")).expect(401);
      // And if Firebase somehow still did, the record itself refuses to come back.
      firebaseState.deleted.delete("ada");
      t.app.get(SessionRevocationService).forget("ada");
      expect((await t.http.get("/api/users/me").set(fresh("ada")).expect(410)).body.message).toBe("This account has been deleted.");
      firebaseState.deleted.add("ada");
      t.app.get(SessionRevocationService).forget("ada");
    });

    it("their posts, listings and comments are gone, and comment counts are right", async () => {
      expect(await t.model("FeedPost").countDocuments({ authorUid: "ada", isActive: true })).toBe(0);
      expect(await t.model("Listing").countDocuments({ sellerUid: "ada", deletedAt: null })).toBe(0);
      await t.http.get(`/api/posts/${left.postId}`).set(t.auth("bola")).expect(404);
      await t.http.get(`/api/listings/${left.listingId}`).set(t.auth("bola")).expect(404);
      const comments = (await t.http.get(`/api/posts/${left.bolaPostId}/comments`).set(t.auth("bola")).expect(200)).body as { content: string }[];
      expect(comments.map((c) => c.content)).toEqual(["Seconded"]);
      expect((await t.http.get(`/api/posts/${left.bolaPostId}`).set(t.auth("bola")).expect(200)).body.commentCount).toBe(1);
    });

    it("every file they uploaded is deleted from storage", async () => {
      expect(await t.model("MediaAsset").countDocuments({ ownerUid: "ada" })).toBe(0);
      expect(storage.deleted).toHaveLength(2);
    });

    it("they are out of their groups: one passes to its longest-standing member, an empty one is archived", async () => {
      expect(await t.model("GroupMember").countDocuments({ uid: "ada" })).toBe(0);
      expect(await t.model("GroupPost").countDocuments({ authorUid: "ada" })).toBe(0);
      const shared = (await t.http.get(`/api/groups/${left.sharedGroup}`).set(t.auth("bola")).expect(200)).body;
      expect(shared).toMatchObject({ memberCount: 1, isAdmin: true });
      expect((await t.model<{ archivedAt: Date | null }>("Group").findById(left.soloGroup).lean())!.archivedAt).toBeInstanceOf(Date);
    });

    it("their Hood Lead role, their notifications and other people's blocks on them are gone", async () => {
      expect(await t.model("HoodRole").countDocuments({ uid: "ada" })).toBe(0);
      expect(await t.model("Notification").countDocuments({ uid: "ada" })).toBe(0);
      expect((await t.users.findOne({ uid: "chidi" }).lean())?.blockedUids).toEqual([]);
    });

    it("the other person keeps the whole conversation, with \"Deleted User\" where the name was and no id pointing at anyone", async () => {
      const convo = (await t.http.get(`/api/conversations/${left.conversationId}`).set(t.auth("bola")).expect(200)).body as { participantUids: string[]; participants: { uid: string; displayName: string; photoURL?: string }[] };
      expect(convo.participantUids.sort()).toEqual(["bola", "deleted-user"]);
      expect(convo.participants.find((p) => p.uid !== "bola")).toEqual({ uid: "deleted-user", displayName: "Deleted User" });
      const messages = (await t.http.get(`/api/conversations/${left.conversationId}/messages`).set(t.auth("bola")).expect(200)).body as { senderUid: string; body: string }[];
      expect(messages.map((m) => [m.senderUid, m.body])).toEqual([["bola", "Is the fan still available?"], ["deleted-user", "Yes, come by tomorrow."]]);
      expect((await t.http.get("/api/conversations").set(t.auth("bola")).expect(200)).body).toHaveLength(1);
      // Their id is nowhere in what is stored about the conversation.
      const stored = JSON.stringify([await t.model("Conversation").findById(left.conversationId).lean(), await t.model("Message").find({ conversationId: left.conversationId }).lean()]);
      expect(stored).not.toMatch(/"ada"|ada:|:ada/);
      // There is nobody to write to any more.
      const res = await t.http.post(`/api/conversations/${left.conversationId}/messages`).set(t.auth("bola")).send({ body: "Hello?" }).expect(403);
      expect(res.body.message).toMatch(/deleted their account/);
    });

    it("moderation and audit history keep the bare uid, so the record of what happened still reads correctly", async () => {
      const kase = await t.model<{ authorUid: string }>("ModerationCase").findById(left.caseId).lean();
      expect(kase!.authorUid).toBe("ada");
      expect(await t.model("AuditEvent").countDocuments({ "target.id": "ada" })).toBeGreaterThan(0);
      // Staff looking them up see a deleted account, not a person.
      const detail = (await t.http.get("/api/admin/neighbours/ada").set(t.auth("mod1")).expect(200)).body;
      expect(detail.displayName).toBe("Neighbour");
      expect(detail.location).toBeUndefined();
    });

    it("running it again changes nothing", async () => {
      expect(await deletion.purge("ada")).toBeNull();
      expect(await deletion.enqueueDue()).toBe(0);
      expect(storage.deleted).toHaveLength(2);
    });
  });

  it("the only owner is never deleted: someone has to hand the role on first", async () => {
    const complain = jest.spyOn((deletion as unknown as { logger: { error: () => void } }).logger, "error").mockImplementation(() => undefined);
    await t.member("boss", lekki, { role: "owner", deactivatedAt: new Date(Date.now() - 40 * DAY) });
    expect(await deletion.purge("boss")).toBeNull();
    expect(complain).toHaveBeenCalled();
    expect((await t.users.findOne({ uid: "boss" }).lean())?.purgedAt ?? null).toBeNull();
    // With a second owner there is no such problem.
    await t.member("boss2", lekki, { role: "owner" });
    expect((await deletion.purge("boss"))?.dryRun).toBe(false);
    expect((await t.users.findOne({ uid: "boss" }).lean())?.role).toBe("member");
  });
});

describe("Account deletion in dry-run mode (the default)", () => {
  let t: TestApp;
  let lekki: string;
  let storage: ReturnType<typeof fakeStorage>;
  beforeAll(async () => {
    ({ t, lekki, storage } = await boot("dry-run"));
  });
  afterAll(() => t.close());

  it("reports what would be deleted and changes nothing at all", async () => {
    const left = await leaveEverythingBehind(t, lekki, "dara");
    await deactivatedDaysAgo(t, "dara", 31);
    const before = JSON.stringify(await t.users.findOne({ uid: "dara" }).lean());

    const report = await t.app.get(AccountDeletionService).purge("dara");
    expect(report).toMatchObject({ uid: "dara", dryRun: true });
    expect(report!.counts).toMatchObject({ posts: 1, listings: 1, comments: 1, groupPosts: 1, conversations: 1, messages: 1, hoodLeadRoles: 1, mediaFiles: 2 });
    expect(report!.counts.groupMemberships).toBeGreaterThanOrEqual(1);

    expect(JSON.stringify(await t.users.findOne({ uid: "dara" }).lean())).toBe(before);
    expect(storage.deleted).toEqual([]);
    expect(firebaseState.deleted.has("dara")).toBe(false);
    expect(await t.model("FeedPost").countDocuments({ authorUid: "dara", isActive: true })).toBe(1);
    expect(await t.model("MediaAsset").countDocuments({ ownerUid: "dara" })).toBe(2);
    expect((await t.model<{ participantUids: string[] }>("Conversation").findById(left.conversationId).lean())!.participantUids).toContain("dara");
    // Nothing is being deleted, so the old rule stands: signing in restores it however long it has been.
    await t.http.get("/api/users/me").set(fresh("dara")).expect(200);
  });
});

describe("Account deletion switched off (DATA_DELETION_MODE=off)", () => {
  let t: TestApp;
  let lekki: string;
  beforeAll(async () => {
    ({ t, lekki } = await boot("off"));
  });
  afterAll(() => t.close());

  it("looks for nobody and deletes nothing", async () => {
    await t.member("ola", lekki, { deactivatedAt: new Date(Date.now() - 60 * DAY) });
    const deletion = t.app.get(AccountDeletionService);
    expect(await deletion.enqueueDue()).toBe(0);
    expect(await deletion.purge("ola")).toBeNull();
  });
});

/** Audit B13: deleting a post or listing only marked it deleted; its photos stayed reachable by URL for good. */
describe("Stored files that nothing uses any more are deleted", () => {
  let t: TestApp;
  let lekki: string;
  let storage: ReturnType<typeof fakeStorage>;
  let files: StorageService;
  const assets = () => t.model<{ url: string; createdAt: Date }>("MediaAsset");
  /** Stands in for time passing: every stored file is at least this old. */
  const agedBy = (ms: number) => assets().collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - ms) } });
  const exists = async (url: string) => (await assets().countDocuments({ url })) === 1;
  const sweepAt = (msFromNow: number) => files.sweepUnreferenced(new Date(Date.now() + msFromNow));

  beforeAll(async () => {
    ({ t, lekki, storage } = await boot("live"));
    files = t.app.get(StorageService);
    await t.member("mina", lekki);
    await t.member("admin1", lekki, { role: "admin" });
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    t.resetThrottle();
    await assets().deleteMany({});
    storage.deleted.length = 0;
  });

  it("media of a live post, a listing, a group cover and a profile photo is kept, however old", async () => {
    const [post, listing, cover, avatar] = [await upload(t, "mina", "post"), await upload(t, "mina", "listing"), await upload(t, "mina", "group"), await upload(t, "mina", "avatar")];
    await t.post("mina", { message: "My street", mediaUrls: [post.url] });
    await t.http.post("/api/listings").set(t.auth("mina")).send({ title: "Chair", priceNaira: 100, category: "furniture", condition: "good", photos: [listing.url] }).expect(201);
    await t.http.post("/api/groups").set(t.auth("mina")).send({ name: "Gardeners", description: "Plants, cuttings and advice.", category: "hobbies", privacy: "open", boundary: "neighbourhood", coverPhoto: cover.url }).expect(201);
    await t.http.patch("/api/users/me").set(t.auth("mina")).send({ photoURL: avatar.url }).expect(200);
    await agedBy(400 * DAY);
    const report = await sweepAt(0);
    expect(report.checked).toBe(4);
    for (const f of [post, listing, cover, avatar]) expect(await exists(f.url)).toBe(true);
    expect(report).toMatchObject({ unused: 0, deleted: 0 });
    expect(storage.deleted).toEqual([]);
  });

  it("an author deleting a post deletes its media: not within the hour, but after it", async () => {
    const photo = await upload(t, "mina", "post");
    const post = await t.post("mina", { message: "Our gate", mediaUrls: [photo.url] });
    await agedBy(2 * DAY);
    await t.http.delete(`/api/posts/${post._id}`).set(t.auth("mina")).expect(204);

    expect(await sweepAt(30 * 60_000)).toMatchObject({ unused: 0, deleted: 0 });
    expect(await exists(photo.url)).toBe(true);

    expect(await sweepAt(2 * HOUR)).toMatchObject({ unused: 1, deleted: 1 });
    expect(await exists(photo.url)).toBe(false);
    expect(storage.deleted).toHaveLength(1);
  });

  it("the same for a deleted listing's photos", async () => {
    const photo = await upload(t, "mina", "listing");
    const listing = (await t.http.post("/api/listings").set(t.auth("mina")).send({ title: "Table", priceNaira: 100, category: "furniture", condition: "good", photos: [photo.url] }).expect(201)).body._id as string;
    await agedBy(2 * DAY);
    await t.http.delete(`/api/listings/${listing}`).set(t.auth("mina")).expect((r) => expect(r.status).toBeLessThan(300));
    expect(await sweepAt(30 * 60_000)).toMatchObject({ deleted: 0 });
    expect(await sweepAt(2 * HOUR)).toMatchObject({ deleted: 1 });
  });

  it("content staff removed keeps its media through the 30-day appeal window, so a successful appeal restores it whole", async () => {
    const photo = await upload(t, "mina", "post");
    const post = await t.post("mina", { message: "Disputed", mediaUrls: [photo.url] });
    await agedBy(2 * DAY);
    await t.http.post(`/api/admin/posts/${post._id}/actions`).set(t.auth("admin1")).send({ action: "remove", reason: "Reported" }).expect(201);

    expect(await sweepAt(29 * DAY)).toMatchObject({ deleted: 0 });
    expect(await exists(photo.url)).toBe(true);
    expect(await sweepAt(32 * DAY)).toMatchObject({ deleted: 1 });
    expect(await exists(photo.url)).toBe(false);
  });

  it("removed content that is restored in time keeps its media for good", async () => {
    const photo = await upload(t, "mina", "post");
    const post = await t.post("mina", { message: "Restored", mediaUrls: [photo.url] });
    await agedBy(2 * DAY);
    await t.http.post(`/api/admin/posts/${post._id}/actions`).set(t.auth("admin1")).send({ action: "remove", reason: "Reported" }).expect(201);
    await t.http.post(`/api/admin/posts/${post._id}/actions`).set(t.auth("admin1")).send({ action: "restore", reason: "Appeal upheld" }).expect(201);
    expect(await sweepAt(400 * DAY)).toMatchObject({ deleted: 0 });
  });

  it("a file two posts use is kept while either is up", async () => {
    const photo = await upload(t, "mina", "post");
    const first = await t.post("mina", { message: "First", mediaUrls: [photo.url] });
    await t.post("mina", { message: "Second", mediaUrls: [photo.url] });
    await agedBy(2 * DAY);
    await t.http.delete(`/api/posts/${first._id}`).set(t.auth("mina")).expect(204);
    expect(await sweepAt(2 * HOUR)).toMatchObject({ deleted: 0 });
    expect(await exists(photo.url)).toBe(true);
  });

  it("an upload never attached to anything is kept for a day (a draft in progress), then deleted", async () => {
    const draft = await upload(t, "mina", "post");
    expect(await sweepAt(0)).toMatchObject({ checked: 0 });
    await agedBy(23 * HOUR);
    expect(await sweepAt(0)).toMatchObject({ checked: 0 });
    await agedBy(25 * HOUR);
    expect(await sweepAt(0)).toMatchObject({ checked: 1, unused: 1, deleted: 1 });
    expect(await exists(draft.url)).toBe(false);
  });

  it("if a module can't say what it is using, nothing is deleted", async () => {
    await upload(t, "mina", "post");
    await agedBy(2 * DAY);
    const sources = (files as unknown as { referenceSources: Map<string, { inUse: () => Promise<string[]> }> }).referenceSources;
    // One of them fails to answer…
    const posts = sources.get("posts")!;
    sources.set("posts", { ...posts, inUse: async () => Promise.reject(new Error("database blip")) });
    await expect(sweepAt(0)).rejects.toThrow("database blip");
    // …or is missing altogether.
    sources.delete("posts");
    const complain = jest.spyOn((files as unknown as { logger: { error: () => void } }).logger, "error").mockImplementation(() => undefined);
    expect(await sweepAt(0)).toEqual({ checked: 0, unused: 0, deleted: 0 });
    expect(complain).toHaveBeenCalled();
    sources.set("posts", posts);
    expect(storage.deleted).toEqual([]);
  });

  it("works through a library larger than one batch, without getting stuck on the files still in use", async () => {
    const used = await upload(t, "mina", "post");
    await t.post("mina", { message: "Kept", mediaUrls: [used.url] });
    await assets().insertMany(Array.from({ length: 250 }, (_, i) => ({ ownerUid: "mina", provider: "fake", providerId: `bulk/${i}`, resourceType: "image", purpose: "post", url: `https://cdn.test/bulk/${i}.jpg`, status: "ready" })));
    await agedBy(2 * DAY);
    let deleted = 0;
    for (let i = 0; i < 4; i++) deleted += (await sweepAt(i * 1000)).deleted;
    expect(deleted).toBe(250);
    expect(await exists(used.url)).toBe(true);
  });
});

describe("The unused-file sweep in dry-run mode (the default)", () => {
  let t: TestApp;
  let lekki: string;
  let storage: ReturnType<typeof fakeStorage>;
  beforeAll(async () => {
    ({ t, lekki, storage } = await boot("dry-run"));
  });
  afterAll(() => t.close());

  it("counts what it would delete and deletes nothing", async () => {
    const files = t.app.get(StorageService);
    jest.spyOn((files as unknown as { logger: { log: () => void } }).logger, "log").mockImplementation(() => undefined);
    await t.member("nora", lekki);
    const draft = await upload(t, "nora", "post");
    await t.model("MediaAsset").collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 2 * DAY) } });
    expect(await files.sweepUnreferenced()).toEqual({ checked: 1, unused: 1, deleted: 0 });
    expect(await t.model("MediaAsset").countDocuments({ url: draft.url })).toBe(1);
    expect(storage.deleted).toEqual([]);
  });
});
