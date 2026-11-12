import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

/**
 * A single-use authorisation code (contract §4.1): 60 seconds, bound to the client, the redirect URI,
 * the PKCE challenge and the nonce. Only a hash of the code is stored. MongoDB removes it after it
 * expires; a used one stays until then, so using it twice is caught.
 */
@Schema({ collection: "oauth_codes", timestamps: { createdAt: true, updatedAt: false } })
export class OAuthCode {
  @Prop({ required: true, unique: true })
  codeHash!: string;

  @Prop({ required: true })
  clientId!: string;

  @Prop({ required: true })
  redirectUri!: string;

  /** Firebase uid. Never sent to the client: it gets the pairwise subject. */
  @Prop({ required: true })
  uid!: string;

  @Prop({ required: true })
  nonce!: string;

  @Prop({ required: true })
  codeChallenge!: string;

  /** When the person last signed in to myHoodora (the ID token's `auth_time`). */
  @Prop({ required: true, type: Date })
  authTime!: Date;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  usedAt?: Date | null;
}
export type OAuthCodeDocument = HydratedDocument<OAuthCode>;
export const OAuthCodeSchema = SchemaFactory.createForClass(OAuthCode);
// Removed a few seconds to a minute after expiry (MongoDB's TTL monitor runs every 60 s); expiry itself is checked on use.
OAuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Client assertions already used (contract §6): each `jti` is accepted once. Kept until the assertion
 * would have expired anyway, plus the allowed clock skew.
 */
@Schema({ collection: "oauth_used_assertions" })
export class UsedClientAssertion {
  @Prop({ required: true })
  clientId!: string;

  @Prop({ required: true })
  jti!: string;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;
}
export const UsedClientAssertionSchema = SchemaFactory.createForClass(UsedClientAssertion);
UsedClientAssertionSchema.index({ clientId: 1, jti: 1 }, { unique: true });
UsedClientAssertionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Who has signed in to which client, and as which pairwise subject. Account events and the subject
 * lookup (contract §§7.1, 8) go only to clients a person has used. Removed with the account.
 */
@Schema({ collection: "integration_links" })
export class IntegrationLink {
  @Prop({ required: true })
  clientId!: string;

  @Prop({ required: true })
  uid!: string;

  @Prop({ required: true })
  sub!: string;

  @Prop({ required: true, type: Date })
  firstAt!: Date;

  @Prop({ required: true, type: Date })
  lastAt!: Date;
}
export const IntegrationLinkSchema = SchemaFactory.createForClass(IntegrationLink);
IntegrationLinkSchema.index({ clientId: 1, uid: 1 }, { unique: true });
IntegrationLinkSchema.index({ clientId: 1, sub: 1 }, { unique: true });
IntegrationLinkSchema.index({ uid: 1 });
