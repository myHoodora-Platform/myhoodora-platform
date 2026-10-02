import mongoose from "mongoose";
type Db = mongoose.mongo.Db;
type MongoClient = mongoose.mongo.MongoClient;
import { runMigrations } from "../src/database/migrations/runner";

describe("data migrations (legacy → pass-1 schema)", () => {
  let client: MongoClient;
  let db: Db;
  const postId = new mongoose.Types.ObjectId();
  const alertId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    client = await mongoose.mongo.MongoClient.connect(process.env.TEST_MONGO_URI!);
    db = client.db(`mig_${Date.now()}`);
    await db.collection("users").insertMany([
      { uid: "banned-with-hood", verificationStatus: "banned", neighborhoodId: "h1" },
      { uid: "banned-no-hood", verificationStatus: "banned" },
      { uid: "normal", verificationStatus: "verified", neighborhoodId: "h1" },
    ]);
    await db.collection("neighborhoods").insertMany([{ name: "A", isActive: true }, { name: "B", isActive: false }]);
    const createdAt = new Date("2026-01-01T00:00:00Z");
    await db.collection("posts").insertMany([
      { _id: postId, content: '<!--mh:{"category":"event","eventDate":"2030-01-01T10:00:00.000Z","eventLocation":"Park"}-->\nSanitation day', type: "event", likes: ["u1", "u2"], createdAt },
      { _id: alertId, content: '<!--mh:{"category":"alert","alertCategory":"traffic","urgent":true}-->\nThird Mainland jam', type: "alert", likes: [], createdAt },
    ]);
  });
  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("dry run writes nothing", async () => {
    await runMigrations(db, { dryRun: true });
    expect(await db.collection("migrations").countDocuments()).toBe(0);
    expect(await db.collection("users").countDocuments({ verificationStatus: "banned" })).toBe(2);
    expect(await db.collection("posts").countDocuments({ message: { $exists: true } })).toBe(0);
  });

  it("applies everything once", async () => {
    const ran = await runMigrations(db);
    expect(ran).toHaveLength(4);
    const users = await db.collection("users").find().toArray();
    const by = Object.fromEntries(users.map((u) => [u.uid, u]));
    expect(by["banned-with-hood"]).toMatchObject({ verificationStatus: "verified", accountStatus: "suspended" });
    expect(by["banned-no-hood"]).toMatchObject({ verificationStatus: "unverified", accountStatus: "suspended" });
    expect(by["normal"]).toMatchObject({ accountStatus: "active" });

    expect((await db.collection("neighborhoods").find().sort({ name: 1 }).toArray()).map((h) => h.status)).toEqual(["active", "paused"]);

    const ev = await db.collection("posts").findOne({ _id: postId });
    expect(ev).toMatchObject({ message: "Sanitation day", category: "event", eventLocation: "Park", reactionCounts: { like: 2 } });
    expect(ev!.likes).toBeUndefined();
    expect(ev!.content).toContain("<!--mh:"); // legacy clients still read content
    expect(await db.collection("reactions").countDocuments({ postId: String(postId) })).toBe(2);

    const alert = await db.collection("posts").findOne({ _id: alertId });
    expect(alert).toMatchObject({ category: "alert", alertCategory: "traffic", urgent: true });
    expect(alert!.activeUntil.toISOString()).toBe("2026-01-01T03:00:00.000Z"); // traffic window = 3 h
  });

  it("is idempotent", async () => {
    expect(await runMigrations(db)).toEqual([]);
    expect(await db.collection("reactions").countDocuments()).toBe(2);
  });
});
