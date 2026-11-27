import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export const HOOD_STATUSES = ["active", "paused", "archived"] as const;
export type HoodStatus = (typeof HOOD_STATUSES)[number];

/**
 * Nigeria's 36 states and the FCT, as a Hood's `state`. A city (Lagos, Ibadan, Abeokuta) sits in a
 * state (Lagos, Oyo, Ogun), so the two are kept apart. Mirrored in packages/api-contract/src/states.ts.
 */
export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
] as const;
export type NigerianState = (typeof NIGERIAN_STATES)[number];

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

  /** The state the city is in. Required for new Hoods; older rows get it from migration 006. */
  @Prop({ type: String, enum: NIGERIAN_STATES, index: true })
  state?: NigerianState;

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
