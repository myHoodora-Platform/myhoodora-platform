import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
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
import { sniffMediaType } from "./media-kind";
import { fetchRemoteFile, RemoteFileError } from "./remote-file";
import { removeTemp } from "./temp-files";

const MB = 1024 * 1024;
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
export class StorageService {
  private readonly folder: string;
  private readonly directUploads: boolean;
  private readonly gate: UploadGate;
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider | null,
    @InjectModel(MediaAsset.name) private readonly assets: Model<MediaAssetDocument>,
    config: ConfigService,
    /** Swappable in tests; Nest leaves it undefined, so the real downloader is used. */
    @Optional() @Inject(REMOTE_FILE_FETCHER) private readonly fetchRemote: typeof fetchRemoteFile = fetchRemoteFile,
  ) {
    this.folder = config.get<string>("storage.folder") ?? "myhoodora/development";
    this.directUploads = config.get<boolean>("storage.directUploads") ?? false;
    this.gate = new UploadGate(config.get<number>("storage.maxConcurrentUploads") ?? 4, 20);
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
