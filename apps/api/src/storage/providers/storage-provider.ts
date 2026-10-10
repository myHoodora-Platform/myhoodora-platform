/**
 * Storage port. Business code depends on StorageService, which depends on
 * this interface only; vendors (Cloudinary today; Supabase Storage or
 * Firebase Storage later) are adapters behind it. See README "File storage".
 */

export type StorageResourceType = "image" | "video";

export interface StorageUpload {
  /** A temp file on disk (uploads, links: never held in memory) or, for small files, bytes. */
  source: { path: string } | { buffer: Buffer };
  mimeType: string;
  resourceType: StorageResourceType;
  /** e.g. "myhoodora/production/post". */
  folder: string;
  /** Optional stable id inside the folder; the provider generates a random one otherwise. */
  publicId?: string;
}

export interface StoredObject {
  /** The provider's id for the object (Cloudinary public_id, a bucket path…). */
  providerId: string;
  /** Public HTTPS URL to deliver it. */
  url: string;
  resourceType: StorageResourceType;
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

/**
 * A one-time, signed permission for the browser to upload one file straight
 * to the provider (so large files never pass through the API). Contains no
 * secrets: only what the provider needs to accept exactly that file.
 */
export interface DirectUploadTicket {
  /** Where the browser POSTs a multipart form. */
  url: string;
  /** Form fields to send unchanged, before the file. */
  fields: Record<string, string>;
  /** Name of the form field that carries the file. */
  fileField: string;
  expiresAt: string;
}

export interface StorageProvider {
  readonly name: string;
  upload(file: StorageUpload): Promise<StoredObject>;
  /** Idempotent: an object that's already gone is not an error. */
  delete(providerId: string, resourceType: StorageResourceType): Promise<void>;
  /** Delivery URL for a stored object. */
  url(providerId: string, resourceType: StorageResourceType): string;
  /**
   * Optional: sign a direct browser upload to exactly `providerId`. Providers
   * without it fall back to `upload()` through the API. Must be paired with `describe`.
   */
  createDirectUpload?(target: { providerId: string; resourceType: StorageResourceType }): DirectUploadTicket;
  /** Optional: what the provider actually stored (real size and duration), or null if nothing arrived. */
  describe?(providerId: string, resourceType: StorageResourceType): Promise<StoredObject | null>;
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");

/**
 * What adapters throw. "rejected": the provider refused this file (corrupt,
 * wrong type), so retrying won't help. "unavailable": the provider is down or
 * timed out, so a retry might.
 */
export class StorageError extends Error {
  constructor(
    readonly reason: "rejected" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
