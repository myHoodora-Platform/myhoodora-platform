import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { SEASON_ACCENTS, SEASON_EFFECTS, SEASON_INTENSITIES, SEASON_MASCOTS, type SeasonAccent, type SeasonEffect, type SeasonIntensity, type SeasonMascot } from "./seasons-rules";

export type SeasonDocument = HydratedDocument<Season>;

/** A festive look the apps put on between two times (contract §41). Admins manage them (`settings.manage`). */
@Schema({ timestamps: true, collection: "seasons" })
export class Season {
  /** Stable id, e.g. "christmas-2026". */
  @Prop({ required: true, unique: true, trim: true, maxlength: 40 }) key!: string;
  /** For staff: "Christmas 2026". */
  @Prop({ required: true, trim: true, maxlength: 60 }) label!: string;
  @Prop({ default: true }) enabled!: boolean;
  @Prop({ required: true }) startsAt!: Date;
  @Prop({ required: true }) endsAt!: Date;
  @Prop({ required: true, enum: SEASON_EFFECTS, default: "lights" }) effect!: SeasonEffect;
  @Prop({ required: true, enum: SEASON_INTENSITIES, default: "normal" }) intensity!: SeasonIntensity;
  @Prop({ required: true, enum: SEASON_MASCOTS, default: "none" }) mascot!: SeasonMascot;
  @Prop({ required: true, enum: SEASON_ACCENTS, default: "red" }) accent!: SeasonAccent;
  /** The greeting card at the top of the feed (dismissible once per season). */
  @Prop({ trim: true, maxlength: 80, default: "" }) greetingTitle!: string;
  @Prop({ trim: true, maxlength: 280, default: "" }) greetingBody!: string;
  /** An illustration or GIF uploaded through myHoodora, and the credit its licence asks for ("Designed by Freepik"). */
  @Prop() imageUrl?: string;
  @Prop({ trim: true, maxlength: 120 }) imageCredit?: string;
  /** New Year: the moment the countdown counts to (and the fireworks burst). */
  @Prop({ type: Date, default: null }) countdownTo?: Date | null;
  @Prop() updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export const SeasonSchema = SchemaFactory.createForClass(Season);
SeasonSchema.index({ enabled: 1, startsAt: 1, endsAt: 1 });
