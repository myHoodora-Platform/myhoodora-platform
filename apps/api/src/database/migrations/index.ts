import type { mongo } from "mongoose";
type Db = mongo.Db;
import { decodePostContent, type PostType } from "../../posts/domain/post-meta";
import { DEFAULT_ALERT_WINDOWS, type AlertCategory } from "../../platform/platform-settings.schema";

export interface MigrationContext {
  db: Db;
  dryRun: boolean;
  log: (msg: string) => void;
}

export interface Migration {
  id: string;
  description: string;
  up(ctx: MigrationContext): Promise<void>;
}

/**
 * Ordered, idempotent data migrations. Each can be re-run safely; the
 * runner records applied ids in the `migrations` collection.
 */
export const MIGRATIONS: Migration[] = [
  {
    id: "001-users-split-account-status",
    description: "users: 'banned' verification → accountStatus suspended; add accountStatus/emailVerifiedAt defaults",
    async up({ db, dryRun, log }) {
      const users = db.collection("users");
      const banned = await users.countDocuments({ verificationStatus: "banned" });
      const missing = await users.countDocuments({ accountStatus: { $exists: false } });
      log(`banned → suspended: ${banned}; missing accountStatus: ${missing}`);
      if (dryRun) return;
      // Keep their Hood verification if they had a Hood; they were banned from taking part, not unverified.
      await users.updateMany({ verificationStatus: "banned", neighborhoodId: { $nin: [null, ""] } }, { $set: { verificationStatus: "verified", accountStatus: "suspended" } });
      await users.updateMany({ verificationStatus: "banned" }, { $set: { verificationStatus: "unverified", accountStatus: "suspended" } });
      await users.updateMany({ accountStatus: { $exists: false } }, { $set: { accountStatus: "active" } });
      await users.updateMany({ isActive: false, deactivatedAt: { $exists: false } }, { $set: { deactivatedAt: new Date() } });
      await users.updateMany({ emailVerifiedAt: { $exists: false } }, { $set: { emailVerifiedAt: null } });
    },
  },
  {
    id: "002-hoods-status",
    description: "neighborhoods: isActive → status (active/paused)",
    async up({ db, dryRun, log }) {
      const hoods = db.collection("neighborhoods");
      const todo = await hoods.countDocuments({ status: { $exists: false } });
      log(`hoods without status: ${todo}`);
      if (dryRun) return;
      await hoods.updateMany({ status: { $exists: false }, isActive: false }, { $set: { status: "paused" } });
      await hoods.updateMany({ status: { $exists: false } }, { $set: { status: "active" } });
    },
  },
  {
    id: "003-posts-first-class-fields",
    description: "posts: parse <!--mh:{}--> / <!--event:{}--> prefixes into fields (content kept as-is)",
    async up({ db, dryRun, log }) {
      const posts = db.collection("posts");
      const cursor = posts.find({ message: { $exists: false } });
      let n = 0;
      for await (const p of cursor) {
        const { message, meta } = decodePostContent(String(p.content ?? ""), (p.type as PostType) ?? "text");
        const createdAt: Date = p.createdAt ?? new Date();
        const set: Record<string, unknown> = {
          message,
          category: meta.category,
          urgent: meta.category === "alert" && Boolean(meta.urgent),
          visibility: meta.visibility ?? "neighbourhood",
          reactionCounts: p.reactionCounts ?? {},
          commentCount: p.commentCount ?? 0,
          commentsDisabled: false,
          removedAt: p.removedAt ?? null,
          resolvedAt: p.resolvedAt ?? null,
        };
        if (meta.category === "alert") {
          const cat = (meta.alertCategory ?? "other") as AlertCategory;
          set.alertCategory = cat;
          set.activeUntil = new Date(createdAt.getTime() + (DEFAULT_ALERT_WINDOWS[cat] ?? 24) * 3_600_000);
        }
        if (meta.eventDate) set.eventDate = new Date(meta.eventDate);
        if (meta.eventLocation) set.eventLocation = meta.eventLocation;
        if (meta.thankedName) set.thankedName = meta.thankedName;
        if (meta.priceNaira !== undefined) set.priceNaira = meta.priceNaira;
        if (meta.poll) set.poll = { options: meta.poll.options, closesAt: new Date(meta.poll.closesAt) };
        n++;
        if (!dryRun) await posts.updateOne({ _id: p._id }, { $set: set });
      }
      log(`posts parsed: ${n}`);
    },
  },
  {
    id: "004-likes-to-reactions",
    description: "posts.likes[] → reactions collection (type like) + reactionCounts",
    async up({ db, dryRun, log }) {
      const posts = db.collection("posts");
      const reactions = db.collection("reactions");
      if (!dryRun) await reactions.createIndex({ postId: 1, uid: 1 }, { unique: true });
      let rows = 0;
      for await (const p of posts.find({ "likes.0": { $exists: true } })) {
        const postId = String(p._id);
        const likes: string[] = p.likes ?? [];
        rows += likes.length;
        if (dryRun) continue;
        if (likes.length) {
          await reactions.bulkWrite(
            likes.map((uid) => ({ updateOne: { filter: { postId, uid }, update: { $setOnInsert: { postId, uid, type: "like", createdAt: p.createdAt ?? new Date() } }, upsert: true } })),
            { ordered: false },
          );
        }
        const count = await reactions.countDocuments({ postId, type: "like" });
        await posts.updateOne({ _id: p._id }, { $set: { "reactionCounts.like": count }, $unset: { likes: "" } });
      }
      log(`likes migrated: ${rows}`);
    },
  },
];
