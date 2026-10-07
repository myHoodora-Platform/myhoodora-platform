import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export const LISTING_CATEGORIES = ["furniture", "electronics", "home_appliances", "fashion", "kids", "books", "vehicles", "other"] as const;
export const LISTING_CONDITIONS = ["new", "like_new", "good", "fair"] as const;
export const LISTING_STATUSES = ["available", "pending", "sold"] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type ListingDocument = HydratedDocument<Listing>;

/** For Sale & Free (contract §4). Removed by staff ≠ deleted by the seller. */
@Schema({ timestamps: true, collection: "listings" })
export class Listing {
  @Prop({ required: true, index: true }) sellerUid!: string;
  @Prop({ required: true }) neighborhoodId!: string;
  @Prop({ required: true, maxlength: 80 }) title!: string;
  @Prop({ default: "", maxlength: 1500 }) description!: string;
  /** null = free */
  @Prop({ type: Number, default: null }) priceNaira!: number | null;
  @Prop({ default: false }) negotiable!: boolean;
  @Prop({ type: String, required: true, enum: LISTING_CATEGORIES }) category!: ListingCategory;
  @Prop({ type: String, required: true, enum: LISTING_CONDITIONS }) condition!: (typeof LISTING_CONDITIONS)[number];
  @Prop({ type: [String], default: [] }) photos!: string[];
  @Prop({ type: String, required: true, enum: LISTING_STATUSES, default: "available" }) status!: ListingStatus;
  @Prop({ type: Date, default: null }) removedAt!: Date | null;
  @Prop({ type: Date, default: null }) deletedAt!: Date | null;
  /** The seller has deactivated their account: hidden from neighbours until they come back (AccountLifecycle). */
  @Prop() sellerDeactivated?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);
ListingSchema.index({ neighborhoodId: 1, deletedAt: 1, removedAt: 1, createdAt: -1 });
// "Is this stored file still used by a listing?" (StorageService.sweepUnreferenced).
ListingSchema.index({ photos: 1 });
