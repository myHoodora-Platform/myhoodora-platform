import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export const HOOD_STATUSES = ["active", "paused", "archived"] as const;
export type HoodStatus = (typeof HOOD_STATUSES)[number];

/** The largest Hood: also how far any geometry query must reach to see every Hood that could matter. */
export const MAX_HOOD_RADIUS_METERS = 20_000;

export type NeighborhoodDocument = HydratedDocument<Neighborhood>;

/**
 * A Hood. The class and collection keep the original "neighborhoods" name so
 * existing data and the public `/neighborhoods` routes stay unchanged.
 */
@Schema({ timestamps: true, collection: "neighborhoods" })
export class Neighborhood {
  @Prop({ required: true, unique: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ trim: true, maxlength: 280 })
  description?: string;

  @Prop({ required: true, trim: true, index: true })
  city!: string;

  @Prop({ required: true, trim: true, default: "Nigeria" })
  country!: string;

  /** GeoJSON point: [longitude, latitude] */
  @Prop({
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number] },
  })
  location?: { type: "Point"; coordinates: [number, number] };

  @Prop({ required: true, type: Number, min: 100, max: MAX_HOOD_RADIUS_METERS })
  radiusMeters!: number;

  /** active → can verify into; paused → closed to new members; archived → hidden (never hard-deleted). */
  @Prop({ required: true, enum: HOOD_STATUSES, default: "active", index: true })
  status!: HoodStatus;

  /** @deprecated kept for rows not yet migrated (migration 002). */
  @Prop()
  isActive?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NeighborhoodSchema = SchemaFactory.createForClass(Neighborhood);
NeighborhoodSchema.index({ location: "2dsphere" });
