import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type HoodRequestDocument = HydratedDocument<HoodRequest>;

export const HOOD_REQUEST_KINDS = ["secondary", "move"] as const;
export type HoodRequestKind = (typeof HOOD_REQUEST_KINDS)[number];

/** pending → approved | declined | withdrawn; an approved secondary Hood can later become "removed". */
export const HOOD_REQUEST_STATUSES = ["pending", "approved", "declined", "withdrawn", "removed"] as const;
export type HoodRequestStatus = (typeof HOOD_REQUEST_STATUSES)[number];

/**
 * A verified neighbour asking staff for a change to their neighbourhoods (contract §31):
 * - "secondary": to read another Hood and hear its alerts (work, family), with a reason;
 * - "move": to change their home Hood, with their new address. Neighbours can't move themselves.
 */
@Schema({ timestamps: true, collection: "hood_requests" })
export class HoodRequest {
  @Prop({ required: true, index: true })
  uid!: string;

  @Prop({ required: true, enum: HOOD_REQUEST_KINDS })
  kind!: HoodRequestKind;

  @Prop({ required: true, enum: HOOD_REQUEST_STATUSES, default: "pending", index: true })
  status!: HoodRequestStatus;

  /** The Hood asked for (secondary), or the one the new address falls in (move; may be none). */
  @Prop()
  hoodId?: string;

  /** Their home Hood when they asked. */
  @Prop()
  fromHoodId?: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  reason!: string;

  /** Move only. Private: staff with the address capability, never neighbours. */
  @Prop({ trim: true, maxlength: 300 })
  address?: string;

  @Prop({ type: { lat: Number, lng: Number }, _id: false })
  point?: { lat: number; lng: number };

  @Prop({ type: { uid: String, displayName: String }, _id: false })
  decidedBy?: { uid: string; displayName?: string };

  @Prop({ type: Date })
  decidedAt?: Date;

  /** Shown to the neighbour (why it was declined or removed). */
  @Prop({ trim: true, maxlength: 500 })
  decisionNote?: string;

  /** The support conversation staff opened about it (contract §18). */
  @Prop()
  threadId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const HoodRequestSchema = SchemaFactory.createForClass(HoodRequest);
HoodRequestSchema.index({ status: 1, createdAt: 1 });
HoodRequestSchema.index({ uid: 1, status: 1 });
