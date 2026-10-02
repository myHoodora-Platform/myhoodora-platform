import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export const BUSINESS_CATEGORIES = ["home_services", "food", "retail", "beauty", "education", "property", "health", "other"] as const;
export const BUSINESS_STATUSES = ["applied", "info_requested", "verified", "rejected", "suspended"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export type BusinessPageDocument = HydratedDocument<BusinessPage>;

/**
 * Business Page (contract §11), modelled on Nextdoor's "Claim your free
 * Business Page": applied publicly, reviewed by staff, then claimed by a
 * myHoodora account through an emailed single-use link.
 */
@Schema({ timestamps: true, collection: "business_pages" })
export class BusinessPage {
  @Prop({ required: true, maxlength: 80 }) businessName!: string;
  @Prop({ type: String, required: true, enum: BUSINESS_CATEGORIES }) category!: (typeof BUSINESS_CATEGORIES)[number];
  @Prop({ required: true, maxlength: 300 }) description!: string;
  @Prop({ type: [String], required: true }) areasServed!: string[];
  @Prop({ maxlength: 200 }) address?: string;
  @Prop({ required: true, maxlength: 80 }) contactName!: string;
  /** E.164, e.g. +2348031234567 */
  @Prop({ required: true, index: true }) phone!: string;
  @Prop({ required: true, lowercase: true, trim: true }) email!: string;
  @Prop() cacNumber?: string;
  @Prop({ default: false }) wantsAdsUpdates!: boolean;
  @Prop({ type: String, required: true, enum: BUSINESS_STATUSES, default: "applied", index: true }) status!: BusinessStatus;
  /** Recorded by staff: phone confirmed by call/OTP; CAC checked on the public register. */
  @Prop({ type: Object, default: () => ({ phone: "pending", cac: "not_provided" }) })
  checks!: { phone: "verified" | "pending" | "failed"; cac: "matched" | "not_provided" | "pending" | "mismatch" };
  /** SHA-256 of the emailed claim token; cleared once claimed. */
  @Prop() claimTokenHash?: string;
  @Prop() claimTokenExpiresAt?: Date;
  @Prop({ index: true }) ownerUid?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export const BusinessPageSchema = SchemaFactory.createForClass(BusinessPage);
