import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

/** The launch challenge and the switches for streaks and badges (one document, key "engagement"). */
@Schema({ timestamps: true, collection: "engagement_settings" })
export class EngagementSettings {
  @Prop({ required: true, unique: true, default: "engagement" }) key!: string;
  @Prop({ default: "myHoodora Launch Challenge" }) challengeName!: string;
  /** 17 Nov 2026, 00:00 Lagos: it went live on social media that day. */
  @Prop({ type: Date, default: () => new Date("2026-11-16T23:00:00.000Z") }) challengeStartsAt!: Date;
  /** Set by "End challenge" (or a planned end). Badges already earned stay. */
  @Prop({ type: Date, default: null }) challengeEndsAt?: Date | null;
  /** Hood Builder: this many verified invites, or this many active days, in the challenge. */
  // Raised from 3 to 5 on 17 Nov 2026; the apps' fallback is BUILDER_INVITES in packages/api-contract/src/invites.ts.
  @Prop({ default: 5 }) minInvites!: number;
  @Prop({ default: 5 }) minActiveDays!: number;
  /** Kill switches. */
  @Prop({ default: true }) streaksOn!: boolean;
  @Prop({ default: true }) badgesOn!: boolean;
  @Prop() updatedBy?: string;
}
export const EngagementSettingsSchema = SchemaFactory.createForClass(EngagementSettings);
