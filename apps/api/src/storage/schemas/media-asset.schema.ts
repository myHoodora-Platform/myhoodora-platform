import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { StorageResourceType } from "../providers/storage-provider";

export const MEDIA_PURPOSES = ["post", "listing", "group", "avatar"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export type MediaAssetDocument = HydratedDocument<MediaAsset>;

/**
 * One uploaded file: who owns it and where the provider keeps it, so it can
 * be deleted by our id whichever provider stored it. Content keeps the URL.
 */
@Schema({ timestamps: true, collection: "media_assets" })
export class MediaAsset {
  @Prop({ required: true, index: true })
  ownerUid!: string;

  /** Which adapter stored it ("cloudinary"); deletes go back to the same one. */
  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  providerId!: string;

  @Prop({ required: true, enum: ["image", "video"] })
  resourceType!: StorageResourceType;

  @Prop({ required: true, enum: MEDIA_PURPOSES })
  purpose!: MediaPurpose;

  /** Empty while a direct upload is pending. */
  @Prop({ default: "", index: true })
  url!: string;

  /** "pending": a direct-upload ticket was issued but not yet completed (see StorageService.completeDirectUpload). */
  @Prop({ enum: ["pending", "ready"], default: "ready" })
  status!: "pending" | "ready";

  /** Pending rows expire (TTL) if the browser never finishes the upload. */
  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop() format?: string;
  @Prop({ default: 0 }) bytes!: number;
  @Prop() width?: number;
  @Prop() height?: number;
  @Prop() durationSeconds?: number;

  /** When the unused-file sweep last looked at this file and found it still in use (StorageService.sweepUnreferenced). */
  @Prop({ type: Date })
  referenceCheckedAt?: Date;

  createdAt?: Date;
}

export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);
// The unused-file sweep takes the files it has gone longest without checking.
MediaAssetSchema.index({ referenceCheckedAt: 1 });
// A person's uploads over the last day (StorageService's daily allowance).
MediaAssetSchema.index({ ownerUid: 1, createdAt: -1 });
// Abandoned direct-upload tickets disappear on their own; ready files never expire.
MediaAssetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { status: "pending" } });
