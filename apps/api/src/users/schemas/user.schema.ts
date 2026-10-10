import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { DEFAULT_PREFERENCES, type Preferences } from "../domain/preferences";
import { ACCOUNT_STATUSES, ROLES, VERIFICATION_STATUSES, type AccountStatus, type Role, type VerificationStatus } from "../../shared/authz/roles";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, unique: true, index: true })
  uid!: string; // Firebase UID

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ trim: true, maxlength: 60 })
  displayName?: string;

  @Prop()
  photoURL?: string;

  @Prop({ trim: true, maxlength: 160 })
  bio?: string;

  @Prop({ default: "email" })
  provider!: string; // 'password' | 'google.com' | 'apple.com'

  /**
   * Home Hood. Only address verification or staff can set it. It grants access only while
   * `verificationStatus` is "verified" (AccountGuard); staff rejecting a verification clears it.
   */
  @Prop({ index: true })
  neighborhoodId?: string;

  /** The Hood they were in when staff rejected their verification. History for staff: it grants nothing. */
  @Prop()
  lastNeighborhoodId?: string;

  @Prop({ default: false })
  isOnboarded!: boolean;

  /** Private: shown to staff only, never to neighbours. */
  @Prop({ type: { lat: Number, lng: Number, address: String }, _id: false })
  location?: { lat?: number; lng?: number; address?: string };

  @Prop({ required: true, default: "member", enum: ROLES, index: true })
  role!: Role;

  /** Is this person really local? (address verification) */
  @Prop({ required: true, default: "unverified", enum: VERIFICATION_STATUSES, index: true })
  verificationStatus!: VerificationStatus;

  @Prop({ type: Date })
  verifiedAt?: Date;

  /** May this person take part? Separate from verification (admin decision #3). */
  @Prop({ required: true, default: "active", enum: ACCOUNT_STATUSES, index: true })
  accountStatus!: AccountStatus;

  @Prop({ type: Date, default: null })
  restrictedUntil?: Date | null;

  @Prop({ type: Date, default: null })
  emailVerifiedAt?: Date | null;

  @Prop({ type: Date, default: null })
  deactivatedAt?: Date | null;

  /**
   * Set when the account was deleted for good, 30 days after it was deactivated
   * (AccountDeletionService). Nothing personal is left on the record by then: it remains so that
   * the uid on moderation and audit history still points at something, and can't be signed into.
   */
  @Prop({ type: Date, default: null })
  purgedAt?: Date | null;

  /** What they told us when they deactivated. Cleared if they come back. */
  @Prop({ type: { reason: String, details: String }, _id: false, default: null })
  deactivation?: { reason: string; details?: string } | null;

  /**
   * When they last chose "sign out everywhere". Any token or session cookie from a sign-in before
   * this moment is refused (AccountGuard), on every API instance, at once.
   */
  @Prop({ type: Date, default: null })
  sessionsRevokedAt?: Date | null;

  @Prop({ type: Object, default: () => structuredClone(DEFAULT_PREFERENCES) })
  preferences!: Preferences;

  /** Capped in the service (MAX_BLOCKS). */
  @Prop({ type: [String], default: [] })
  blockedUids!: string[];

  @Prop({ type: { lat: Number, lng: Number }, _id: false })
  lastKnownLocation?: { lat?: number; lng?: number };

  /** Address-check history for staff review (bounded to the last 10). */
  @Prop({
    type: [{ at: Date, lat: Number, lng: Number, address: String, result: String, _id: false }],
    default: [],
  })
  verificationAttempts!: { at: Date; lat: number; lng: number; address?: string; result: "matched" | "outside_coverage" | "low_accuracy" | "mismatch" }[];

  /** A pending "ask to join" a nearby Hood (contract §16). Cleared on approve, reject, cancel or an address match. */
  @Prop({ type: { id: String, name: String, requestedAt: Date }, _id: false, default: null })
  requestedHood?: { id: string; name: string; requestedAt: Date } | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ createdAt: -1 });
// "Who has blocked this person?" (UsersService.hiddenAuthorsFor) runs on nearly every read.
UserSchema.index({ blockedUids: 1 });
