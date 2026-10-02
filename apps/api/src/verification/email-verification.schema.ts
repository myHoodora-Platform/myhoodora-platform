import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type EmailVerificationDocument = HydratedDocument<EmailVerification>;

/**
 * One email-verification token. Only the SHA-256 hash is stored (OWASP):
 * a database leak can't be turned into working links.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "email_verifications" })
export class EmailVerification {
  @Prop({ required: true, index: true })
  uid!: string;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  consumedAt?: Date | null;

  createdAt?: Date;
}

export const EmailVerificationSchema = SchemaFactory.createForClass(EmailVerification);
// Clean up a week after expiry.
EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });
