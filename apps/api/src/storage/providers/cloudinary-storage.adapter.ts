import { Logger } from "@nestjs/common";
import { v2 as cloudinary, type UploadApiErrorResponse, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { StorageError, type DirectUploadTicket, type StorageProvider, type StorageResourceType, type StorageUpload, type StoredObject } from "./storage-provider";

type CloudinarySdk = Pick<typeof cloudinary, "config" | "uploader" | "url" | "utils" | "api">;

/** Per request to Cloudinary: a 100 MB video from a slow server link needs a while. */
const UPLOAD_TIMEOUT_MS = 10 * 60_000;
/** Photos are stored at most this size on the long edge (phones shoot 4000px+). */
const MAX_IMAGE_EDGE = 2560;
/** Videos are delivered at most 1280 px on the long edge (720p-class): plenty for a feed, kind to mobile data. */
const MAX_VIDEO_EDGE = 1280;
const VIDEO_DELIVERY = { format: "mp4", quality: "auto", width: MAX_VIDEO_EDGE, crop: "limit" } as const;
/** The same delivery version as a signed-upload `eager` string (Cloudinary sorts parameters alphabetically). */
const VIDEO_DELIVERY_EAGER = `c_limit,q_auto,w_${MAX_VIDEO_EDGE}/mp4`;
/** Cloudinary accepts a signed request for an hour. */
const SIGNATURE_TTL_S = 3600;

/** Splits cloudinary://<key>:<secret>@<cloud>. Errors never include the value. */
export function parseCloudinaryUrl(url: string): { cloudName: string; apiKey: string; apiSecret: string } {
  const m = /^cloudinary:\/\/([^:@\s]+):([^@\s]+)@([\w-]+)$/.exec(url.trim());
  if (!m) throw new Error("CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>");
  return { apiKey: m[1]!, apiSecret: m[2]!, cloudName: m[3]! };
}

/** The only file that knows about the Cloudinary SDK. */
export class CloudinaryStorageAdapter implements StorageProvider {
  readonly name = "cloudinary";
  readonly cloudName: string;
  private readonly apiKey: string;
  /** Server-side only: signs direct-upload tickets, never leaves this class. */
  private readonly apiSecret: string;
  private readonly logger = new Logger(CloudinaryStorageAdapter.name);

  constructor(
    cloudinaryUrl: string,
    private readonly sdk: CloudinarySdk = cloudinary,
  ) {
    const { cloudName, apiKey, apiSecret } = parseCloudinaryUrl(cloudinaryUrl);
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.sdk.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  }

  async upload(file: StorageUpload): Promise<StoredObject> {
    const options = {
      resource_type: file.resourceType,
      folder: file.folder,
      ...(file.publicId ? { public_id: file.publicId, overwrite: true } : { unique_filename: true, overwrite: false }),
      timeout: UPLOAD_TIMEOUT_MS,
      // Stored photos are capped in size; delivery URLs strip camera metadata (GPS) and pick the format.
      ...(file.resourceType === "image" && { transformation: [{ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, crop: "limit" }] }),
      // Prepare the delivery MP4 in the background so the first viewer doesn't wait on (or 423 from) on-the-fly processing.
      ...(file.resourceType === "video" && { eager: [VIDEO_DELIVERY], eager_async: true }),
    };
    let res: UploadApiResponse;
    try {
      // From disk the SDK streams the file in one request (measured: 65.8 MB video in 18 s, +28 MB memory).
      // Its chunked uploader was far worse (231 s, +365 MB: it re-copies each chunk as it grows), and one
      // request covers our 100 MB cap.
      res = "buffer" in file.source ? await this.fromBuffer(file.source.buffer, options) : await this.sdk.uploader.upload(file.source.path, options);
    } catch (err) {
      throw this.toError("upload", (err as { error?: UploadApiErrorResponse }).error ?? (err as UploadApiErrorResponse));
    }
    if (!res?.public_id) throw this.toError("upload", undefined);
    return {
      providerId: res.public_id,
      url: this.url(res.public_id, file.resourceType),
      resourceType: file.resourceType,
      format: res.format,
      bytes: res.bytes,
      width: res.width,
      height: res.height,
      durationSeconds: typeof res.duration === "number" ? res.duration : undefined,
    };
  }

  private fromBuffer(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      this.sdk.uploader
        .upload_stream(options, (err?: UploadApiErrorResponse, res?: UploadApiResponse) => (err || !res ? reject(err ?? new Error("no response")) : resolve(res)))
        .end(buffer);
    });
  }

  async delete(providerId: string, resourceType: StorageResourceType): Promise<void> {
    let result: { result?: string } | undefined;
    try {
      result = (await this.sdk.uploader.destroy(providerId, { resource_type: resourceType, invalidate: true })) as { result?: string };
    } catch (err) {
      throw this.toError("delete", err as UploadApiErrorResponse);
    }
    if (result?.result !== "ok" && result?.result !== "not found") {
      this.logger.warn(`Cloudinary delete answered "${result?.result ?? "nothing"}"`);
      throw new StorageError("unavailable", "cloudinary:delete");
    }
  }

  url(providerId: string, resourceType: StorageResourceType): string {
    if (resourceType === "video") {
      // MP4 plays everywhere (iOS included) and makes the URL recognisably a video; capped at 1280 px.
      return this.sdk.url(providerId, { resource_type: "video", secure: true, ...VIDEO_DELIVERY });
    }
    return this.sdk.url(providerId, { resource_type: "image", secure: true, fetch_format: "auto", quality: "auto" });
  }

  createDirectUpload({ providerId, resourceType }: { providerId: string; resourceType: StorageResourceType }): DirectUploadTicket {
    const timestamp = Math.floor(Date.now() / 1000);
    // Everything signed here is fixed: the browser can't change the file id, folder or processing.
    const params: Record<string, string | number> = {
      timestamp,
      public_id: providerId,
      ...(resourceType === "video"
        ? { eager: VIDEO_DELIVERY_EAGER, eager_async: "true" }
        : { transformation: `c_limit,h_${MAX_IMAGE_EDGE},w_${MAX_IMAGE_EDGE}` }),
    };
    const signature = this.sdk.utils.api_sign_request(params, this.apiSecret);
    return {
      url: `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`,
      fields: { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: this.apiKey, signature },
      fileField: "file",
      expiresAt: new Date((timestamp + SIGNATURE_TTL_S) * 1000).toISOString(),
    };
  }

  async describe(providerId: string, resourceType: StorageResourceType): Promise<StoredObject | null> {
    let res: { public_id: string; format?: string; bytes: number; width?: number; height?: number; duration?: number };
    try {
      // media_metadata makes Cloudinary report the real duration it measured.
      res = await this.sdk.api.resource(providerId, { resource_type: resourceType, media_metadata: true });
    } catch (err) {
      const e = err as { http_code?: number; error?: { http_code?: number; message?: string } };
      if ((e.error?.http_code ?? e.http_code) === 404) return null;
      throw this.toError("describe", e.error ?? (e as Partial<UploadApiErrorResponse>));
    }
    return {
      providerId: res.public_id,
      url: this.url(res.public_id, resourceType),
      resourceType,
      format: res.format,
      bytes: res.bytes,
      width: res.width,
      height: res.height,
      durationSeconds: typeof res.duration === "number" ? res.duration : undefined,
    };
  }

  /** Error objects carry an HTTP code and message only, never credentials. */
  private toError(op: "upload" | "delete" | "describe", err?: Partial<UploadApiErrorResponse>): StorageError {
    const code = err?.http_code;
    this.logger.warn(`Cloudinary ${op} failed${code ? ` (${code})` : ""}: ${(err?.message ?? "no response").slice(0, 200)}`);
    // 4xx other than auth/rate limits means this file was refused; everything else is on the provider's side.
    const rejected = typeof code === "number" && code >= 400 && code < 500 && ![401, 403, 408, 420, 429].includes(code);
    return new StorageError(rejected ? "rejected" : "unavailable", `cloudinary:${op}:${code ?? "error"}`);
  }
}
