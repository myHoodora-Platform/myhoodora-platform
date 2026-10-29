import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export const PUSH_PLATFORMS = ["ios", "android"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export type PushDeviceDocument = HydratedDocument<PushDevice>;

/**
 * A phone that may receive pushes for one person. The token is unique: when someone else signs in on
 * the same phone, registering moves the token to them, so the previous person stops getting pushes there.
 */
@Schema({ timestamps: true, collection: "push_devices" })
export class PushDevice {
  @Prop({ required: true, index: true })
  uid!: string;

  @Prop({ required: true, unique: true, maxlength: 300 })
  token!: string;

  @Prop({ required: true, enum: PUSH_PLATFORMS })
  platform!: PushPlatform;

  /** Last time the app registered it (each launch while signed in). */
  @Prop({ required: true })
  lastSeenAt!: Date;
}

export const PushDeviceSchema = SchemaFactory.createForClass(PushDevice);
