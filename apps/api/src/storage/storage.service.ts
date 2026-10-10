import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  Optional,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes } from "node:crypto";
import { open } from "node:fs/promises";
import { Model, Types } from "mongoose";
import { STORAGE_PROVIDER, StorageError, type DirectUploadTicket, type StorageProvider, type StorageResourceType, type StoredObject } from "./providers/storage-provider";
import { MediaAsset, MediaAssetDocument, type MediaPurpose } from "./schemas/media-asset.schema";
import { AccountLifecycle } from "../users/account-lifecycle";
import { sniffMediaType } from "./media-kind";
import { fetchRemoteFile, RemoteFileError } from "./remote-file";
import { removeTemp } from "./temp-files";

const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

// How long a stored file is kept after the thing that used it stopped using it. Content modules apply
// the first two when they say what is still in use (registerReferenceSource).
/** After its author deletes a post or listing: long enough for a slip to be noticed, short enough to mean "deleted". */
export const DELETED_MEDIA_KEPT_MS = 60 * 60 * 1000;
/** After staff remove content: the 30 days in which the author can appeal and have it restored, plus a day. */
export const REMOVED_MEDIA_KEPT_MS = 31 * DAY_MS;
/** A file that has never been attached to anything: long enough for a draft to be finished. */
const UNUSED_UPLOAD_KEPT_MS = DAY_MS;
/** Files looked at per sweep. */
const SWEEP_BATCH = 200;
/** Everything that keeps stored files. A sweep without all of them would delete files the missing one is using. */
const REFERENCE_SOURCES = ["posts", "listings", "groups", "users"] as const;

/** A module that keeps URLs of stored files, and can say which of a set it still needs. */
export interface MediaReferenceSource {
  name: (typeof REFERENCE_SOURCES)[number];
  /** The ones among `urls` that something of this module's is still using at `now`. */
  inUse(urls: string[], now: Date): Promise<string[]>;
}

export interface SweepReport {
  checked: number;
  /** Used by nothing. */
  unused: number;
  /** Actually deleted (0 in a dry run). */
  deleted: number;
}
export const REMOTE_FILE_FETCHER = Symbol("REMOTE_FILE_FETCHER");
/** Files stream to disk, then to storage in chunks, so videos can be as big as the provider's free plan allows. */
export const MAX_BYTES: Record<StorageResourceType, number> = { image: 10 * MB, video: 100 * MB };
/** Short clips only, like Nextdoor's "short video": checked on the stored file, not the client's claim. */
export const MAX_VIDEO_SECONDS = 60;
/** Upper bound for the multipart parser; the per-type limit is checked after. */
export const MAX_UPLOAD_BYTES = MAX_BYTES.video;
export const MAX_DIRECT_BYTES = MAX_BYTES;
/** How long a direct-upload ticket stays claimable. */
const DIRECT_TICKET_TTL_MS = 2 * 60 * 60 * 1000;
/** The web gives up on a direct upload after 20 minutes, so a ticket still pending after an hour was abandoned. */
const DIRECT_ABANDONED_AFTER_MS = 60 * 60 * 1000;

const ACCEPTED: Record<string, StorageResourceType> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/heic": "image",
  "image/heif": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
};

/** The purposes that take video; profile photos, listings and group covers are photos only. */
const VIDEO_PURPOSES: readonly MediaPurpose[] = ["post"];

/** An uploaded file: on disk (multer disk storage, downloaded links) or, for small ones, in memory. */
export interface UploadedFileInput {
  path?: string;
  buffer?: Buffer;
  /** What the client said; the real type is read from the file itself. */
  mimetype: string;
  size: number;
}

/**
 * Caps how many files one instance sends to storage at once, so a burst of
 * big videos can't saturate its network/CPU. Extra requests wait in a short
 * queue; past that they get a friendly 503 and the client can retry.
 */
export class UploadGate {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  constructor(
    private readonly max: number,
    private readonly maxQueue: number,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      if (this.waiting.length >= this.maxQueue) throw new ServiceUnavailableException("Lots of uploads right now. Please try again in a minute.");
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await work();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

export interface MediaAssetView {
  id: string;
  url: string;
  resourceType: StorageResourceType;
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

/**
 * The application's only way to store files. Validates, stores through the
 * configured StorageProvider, and records ownership so files can be deleted
 * by our id. Knows nothing about any vendor SDK.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly referenceSources = new Map<string, MediaReferenceSource>();
  private readonly deletionMode: "off" | "dry-run" | "live";
  private readonly folder: string;
  private readonly directUploads: boolean;
  private readonly gate: UploadGate;
  private readonly dailyUploads: number;
  private readonly dailyUploadBytes: number;
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider | null,
    @InjectModel(MediaAsset.name) private readonly assets: Model<MediaAssetDocument>,
    config: ConfigService,
    /** Swappable in tests; Nest leaves it undefined, so the real downloader is used. */
    @Optional() @Inject(REMOTE_FILE_FETCHER) private readonly fetchRemote: typeof fetchRemoteFile = fetchRemoteFile,
    /** Absent only in unit tests that build the service by hand. */
    @Optional() private readonly accounts?: AccountLifecycle,
  ) {
    this.folder = config.get<string>("storage.folder") ?? "myhoodora/development";
    this.directUploads = config.get<boolean>("storage.directUploads") ?? false;
    this.gate = new UploadGate(config.get<number>("storage.maxConcurrentUploads") ?? 4, 20);
    this.dailyUploads = config.get<number>("storage.dailyUploads") ?? 200;
    this.dailyUploadBytes = config.get<number>("storage.dailyUploadBytes") ?? 1024 * MB;
    this.deletionMode = config.get<"off" | "dry-run" | "live">("deletion.mode") ?? "dry-run";
  }

  onModuleInit() {
    // An account being deleted takes every file it uploaded with it, at once (no grace period: this is the end of one).
    this.accounts?.register({ name: "storage", purge: (uid, dryRun) => this.purgeOwner(uid, dryRun) });
  }

  /** Content modules call this on init to say which stored files they are using. */
  registerReferenceSource(source: MediaReferenceSource): void {
    this.referenceSources.set(source.name, source);
  }

  private async purgeOwner(uid: string, dryRun: boolean): Promise<Record<string, number>> {
    const theirs = await this.assets.find({ ownerUid: uid }).exec();
    if (dryRun || !theirs.length) return { mediaFiles: theirs.length };
    // Files exist and can't be deleted: the account must not be marked deleted. The job fails and is retried.
    const provider = this.requireProvider();
    for (const asset of theirs) {
      if (asset.provider !== provider.name) throw new Error(`A file stored with "${asset.provider}" can't be deleted through "${provider.name}".`);
      await provider.delete(asset.providerId, asset.resourceType);
      await asset.deleteOne();
    }
    return { mediaFiles: theirs.length };
  }

  /**
   * Delete stored files that nothing uses any more: media of a deleted post or listing, of content
   * staff removed once its appeal window has closed, and uploads that were never attached to anything.
   * (Deleting content only ever marked it deleted; its photos stayed reachable by URL for good.)
   *
   * Each module that keeps file URLs says which of a batch it still needs, and applies its own
   * grace periods in doing so. A file nobody claims is deleted from the provider, then from our
   * records. Runs hourly (StorageModule), a batch at a time, least-recently-checked first, so the
   * whole library is covered in turn. In "dry-run" mode it only counts. This cannot be undone:
   * content restored after its window comes back without its media.
   */
  async sweepUnreferenced(now = new Date()): Promise<SweepReport> {
    const none: SweepReport = { checked: 0, unused: 0, deleted: 0 };
    const provider = this.provider;
    if (this.deletionMode === "off" || !provider) return none;
    const missing = REFERENCE_SOURCES.filter((name) => !this.referenceSources.has(name));
    if (missing.length) {
      this.logger.error(`Unused-file sweep skipped: nothing has said which files ${missing.join(", ")} still use, so none can safely be called unused.`);
      return none;
    }

    const batch = await this.assets
      .find({ status: "ready", provider: provider.name, createdAt: { $lt: new Date(now.getTime() - UNUSED_UPLOAD_KEPT_MS) } })
      .sort({ referenceCheckedAt: 1 })
      .limit(SWEEP_BATCH)
      .exec();
    if (!batch.length) return none;
    const urls = batch.map((a) => a.url).filter(Boolean);
    const inUse = new Set<string>();
    // If any module can't answer, this throws and nothing is deleted this time round.
    for (const source of this.referenceSources.values()) for (const url of await source.inUse(urls, now)) inUse.add(url);

    const unused = batch.filter((a) => !inUse.has(a.url));
    const used = batch.filter((a) => inUse.has(a.url));
    let deleted = 0;
    if (this.deletionMode === "live") {
      for (const asset of unused) {
        try {
          await provider.delete(asset.providerId, asset.resourceType);
          await asset.deleteOne();
          deleted++;
        } catch (err) {
          // Left for the next sweep, at the back of the queue, so one bad file doesn't hold up the rest.
          this.logger.warn(`Couldn't delete an unused file: ${(err as Error).message}`);
          await this.assets.updateOne({ _id: asset._id }, { $set: { referenceCheckedAt: now } }).exec();
        }
      }
    } else if (unused.length) {
      this.logger.log(`[dry run] ${unused.length} stored file(s) are used by nothing and would be deleted. Nothing was changed.`);
    }
    // Move what was looked at to the back of the queue (in a dry run that includes the unused ones, or it would never get past them).
    const seen = this.deletionMode === "live" ? used : batch;
    if (seen.length) await this.assets.updateMany({ _id: { $in: seen.map((a) => a._id) } }, { $set: { referenceCheckedAt: now } }).exec();
    return { checked: batch.length, unused: unused.length, deleted };
  }

  /**
   * Refuses (429) a file that would take this person past their allowance for any 24 hours: a number
   * of files and a total size, counted from what they still have stored. Checked before anything is
   * downloaded or sent to the provider. Two uploads at the same moment can both pass and overshoot
   * by one file; the next is refused.
   */
  private async assertWithinAllowance(ownerUid: string, incomingBytes: number): Promise<void> {
    const [used] = await this.assets
      .aggregate<{ files: number; bytes: number }>([
        { $match: { ownerUid, createdAt: { $gte: new Date(Date.now() - DAY_MS) } } },
        { $group: { _id: null, files: { $sum: 1 }, bytes: { $sum: "$bytes" } } },
      ])
      .exec();
    if ((used?.files ?? 0) + 1 > this.dailyUploads || (used?.bytes ?? 0) + incomingBytes > this.dailyUploadBytes) {
      throw new HttpException("You've reached today's upload limit. Try again tomorrow.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  get enabled(): boolean {
    return this.provider !== null;
  }

  async upload(ownerUid: string, file: UploadedFileInput, purpose: MediaPurpose): Promise<MediaAssetView> {
    // Trust the bytes, not the label: a renamed PDF or web page is refused here.
    const mimetype = sniffMediaType(await readHead(file)) ?? "unknown";
    const resourceType = this.resourceTypeFor(mimetype, purpose);
    assertSize(resourceType, file.size, MAX_BYTES);

    const provider = this.requireProvider();
    await this.assertWithinAllowance(ownerUid, file.size);
    const source = file.path ? { path: file.path } : { buffer: file.buffer ?? Buffer.alloc(0) };
    let stored;
    try {
      stored = await this.gate.run(() => provider.upload({ source, mimeType: mimetype, resourceType, folder: `${this.folder}/${purpose}` }));
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw this.toHttp(err, "upload");
    }
    await this.rejectIfTooLong(provider, stored);
    const doc = await this.assets.create({ ownerUid, provider: provider.name, purpose, ...stored });
    return toView(doc);
  }

  /**
   * "Add from link": download a photo/video someone linked (safely, see
   * remote-file.ts) and store it like an upload, so the same type, size and
   * length rules apply and the post doesn't depend on the other site.
   */
  async importFromUrl(ownerUid: string, url: string, purpose: MediaPurpose): Promise<MediaAssetView> {
    this.requireProvider();
    // Before the download: someone out of allowance must not be able to keep the server fetching files.
    await this.assertWithinAllowance(ownerUid, 0);
    let remote;
    try {
      remote = await this.fetchRemote(url, { maxBytes: MAX_UPLOAD_BYTES });
    } catch (err) {
      if (err instanceof RemoteFileError) throw new BadRequestException(err.message);
      throw err;
    }
    try {
      return await this.upload(ownerUid, { path: remote.path, mimetype: remote.mimetype, size: remote.size }, purpose);
    } finally {
      await removeTemp(remote.path);
    }
  }

  /**
   * Step 1 of a direct upload: validate what the browser says it will send
   * and sign a ticket for exactly one new file id. Returns `upload: null`
   * when the provider can't (or for photos, which keep the server path so
   * they're resized and stripped on the way in); the client then uses POST /media.
   */
  async createDirectUpload(
    ownerUid: string,
    input: { purpose: MediaPurpose; mimetype: string; size: number },
  ): Promise<{ id: string | null; upload: DirectUploadTicket | null }> {
    const provider = this.requireProvider();
    const resourceType = this.resourceTypeFor(input.mimetype, input.purpose);
    await this.assertWithinAllowance(ownerUid, input.size);
    // Off by default (STORAGE_DIRECT_UPLOADS): each completion costs a Cloudinary Admin API call, which the free plan rate-limits.
    if (!this.directUploads || resourceType !== "video" || !provider.createDirectUpload || !provider.describe) return { id: null, upload: null };
    assertSize(resourceType, input.size, MAX_DIRECT_BYTES);
    const providerId = `${this.folder}/${input.purpose}/${randomBytes(12).toString("base64url")}`;
    const doc = await this.assets.create({
      ownerUid,
      provider: provider.name,
      providerId,
      resourceType,
      purpose: input.purpose,
      status: "pending",
      expiresAt: new Date(Date.now() + DIRECT_TICKET_TTL_MS),
    });
    return { id: String(doc._id), upload: provider.createDirectUpload({ providerId, resourceType }) };
  }

  /**
   * Step 2: the browser says it's done. We read back what the provider
   * actually stored (never the browser's claims) and enforce the limits.
   * Idempotent: completing a finished upload returns it again.
   */
  async completeDirectUpload(ownerUid: string, id: string): Promise<MediaAssetView> {
    const asset = Types.ObjectId.isValid(id) ? await this.assets.findOne({ _id: id, ownerUid }).exec() : null;
    if (!asset) throw new NotFoundException("That upload doesn't exist or has expired. Please upload again.");
    if (asset.status !== "pending") return toView(asset);
    const provider = this.requireProvider();
    if (asset.provider !== provider.name || !provider.describe) throw new ServiceUnavailableException("Uploads are having trouble right now. Please try again.");

    let stored: StoredObject | null;
    try {
      stored = await provider.describe(asset.providerId, asset.resourceType);
    } catch (err) {
      throw this.toHttp(err, "upload");
    }
    if (!stored) throw new BadRequestException("We didn't receive your video. Please upload it again.");
    if (stored.bytes > MAX_DIRECT_BYTES[asset.resourceType]) {
      await provider.delete(stored.providerId, asset.resourceType).catch(() => undefined);
      await asset.deleteOne();
      throw new PayloadTooLargeException(`Videos must be under ${MAX_DIRECT_BYTES.video / MB} MB.`);
    }
    try {
      await this.rejectIfTooLong(provider, stored);
    } catch (err) {
      await asset.deleteOne();
      throw err;
    }
    Object.assign(asset, { ...stored, status: "ready", expiresAt: undefined });
    await asset.save();
    return toView(asset);
  }

  /**
   * Direct uploads the browser started but never completed (tab closed, connection lost). The
   * pending row would expire on its own, but the file may already be in storage with nothing
   * pointing at it: delete that first, then the row. Runs hourly (StorageModule); returns the count.
   */
  async sweepAbandonedDirectUploads(olderThanMs = DIRECT_ABANDONED_AFTER_MS): Promise<number> {
    const provider = this.provider;
    if (!provider) return 0;
    const abandoned = await this.assets
      .find({ status: "pending", provider: provider.name, createdAt: { $lt: new Date(Date.now() - olderThanMs) } })
      .limit(200)
      .exec();
    let removed = 0;
    for (const asset of abandoned) {
      try {
        // Deleting a file that never arrived is a no-op at the provider.
        await provider.delete(asset.providerId, asset.resourceType);
        await asset.deleteOne();
        removed++;
      } catch (err) {
        // Leave the row for the next sweep (or its own expiry) rather than orphan the file silently.
        this.logger.warn(`Couldn't clean up an abandoned upload: ${(err as Error).message}`);
      }
    }
    return removed;
  }

  /** Owner deletes a file (e.g. removed from a draft, or a replaced profile photo). */
  async delete(ownerUid: string, id: string): Promise<void> {
    const asset = Types.ObjectId.isValid(id) ? await this.assets.findOne({ _id: id, ownerUid }).exec() : null;
    if (!asset) throw new NotFoundException("That file doesn't exist.");
    const provider = this.requireProvider();
    if (asset.provider !== provider.name) {
      // Stored by a provider we've since switched away from; keep the record so it can be cleaned up there.
      throw new ServiceUnavailableException("That file can't be deleted right now.");
    }
    try {
      await provider.delete(asset.providerId, asset.resourceType);
    } catch (err) {
      throw this.toHttp(err, "delete");
    }
    await asset.deleteOne();
  }

  /**
   * Best-effort cleanup when content stops using a file (e.g. a replaced
   * profile photo). Only the owner's files we stored; never throws.
   */
  async discardByUrl(ownerUid: string, url: string): Promise<void> {
    try {
      const asset = await this.assets.findOne({ ownerUid, url }).exec();
      if (!asset || !this.provider || asset.provider !== this.provider.name) return;
      await this.provider.delete(asset.providerId, asset.resourceType);
      await asset.deleteOne();
    } catch (err) {
      this.logger.warn(`Couldn't clean up a replaced file: ${(err as Error).message}`);
    }
  }

  /**
   * Shape (width ÷ height) of files we stored, by URL, so a client can frame a
   * photo or video before it has loaded instead of jumping when it does. One
   * query for the whole page; URLs we didn't store (pasted links) are absent.
   */
  async aspectRatios(urls: string[]): Promise<Map<string, number>> {
    if (!urls.length) return new Map();
    const rows = await this.assets
      .find({ url: { $in: [...new Set(urls)] }, width: { $gt: 0 }, height: { $gt: 0 } }, { url: 1, width: 1, height: 1 })
      .lean<Pick<MediaAsset, "url" | "width" | "height">[]>()
      .exec();
    return new Map(rows.map((r) => [r.url, Number((r.width! / r.height!).toFixed(4))]));
  }

  /** Delivery URL for a stored file (e.g. after changing delivery settings). */
  getUrl(asset: Pick<MediaAsset, "providerId" | "resourceType">): string {
    return this.requireProvider().url(asset.providerId, asset.resourceType);
  }

  private resourceTypeFor(mimetype: string, purpose: MediaPurpose): StorageResourceType {
    const resourceType = ACCEPTED[mimetype];
    if (!resourceType || (resourceType === "video" && !VIDEO_PURPOSES.includes(purpose))) {
      throw new BadRequestException(
        VIDEO_PURPOSES.includes(purpose)
          ? "Only photos (JPG, PNG, WebP, GIF, HEIC) and videos (MP4, MOV, WebM) can be uploaded."
          : "Only photos (JPG, PNG, WebP, GIF, HEIC) can be uploaded here.",
      );
    }
    return resourceType;
  }

  /** Videos over the limit are deleted from storage, then refused. */
  private async rejectIfTooLong(provider: StorageProvider, stored: StoredObject): Promise<void> {
    if (stored.resourceType !== "video" || (stored.durationSeconds ?? 0) <= MAX_VIDEO_SECONDS + 0.5) return;
    await provider.delete(stored.providerId, "video").catch(() => undefined);
    throw new BadRequestException(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds long.`);
  }

  private requireProvider(): StorageProvider {
    if (!this.provider) throw new ServiceUnavailableException("Photo uploads aren't available right now. Please try again later.");
    return this.provider;
  }

  private toHttp(err: unknown, op: "upload" | "delete") {
    if (err instanceof StorageError && err.reason === "rejected") {
      return new BadRequestException("We couldn't process that file. Try a different one.");
    }
    return new ServiceUnavailableException(op === "upload" ? "Uploads are having trouble right now. Please try again." : "That file can't be deleted right now.");
  }
}

/** First bytes of the file, for sniffing its real type. */
async function readHead(file: UploadedFileInput): Promise<Buffer> {
  if (!file.path) return (file.buffer ?? Buffer.alloc(0)).subarray(0, 32);
  const handle = await open(file.path, "r");
  try {
    const head = Buffer.alloc(32);
    const { bytesRead } = await handle.read(head, 0, 32, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function assertSize(resourceType: StorageResourceType, size: number, limits: Record<StorageResourceType, number>) {
  if (size > limits[resourceType]) {
    throw new PayloadTooLargeException(`${resourceType === "image" ? "Photos" : "Videos"} must be under ${limits[resourceType] / MB} MB.`);
  }
}

function toView(doc: MediaAssetDocument): MediaAssetView {
  return {
    id: String(doc._id),
    url: doc.url,
    resourceType: doc.resourceType,
    format: doc.format,
    bytes: doc.bytes,
    width: doc.width,
    height: doc.height,
    durationSeconds: doc.durationSeconds,
  };
}
