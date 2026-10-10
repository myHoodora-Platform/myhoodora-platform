import { searchRegex } from "../shared/http/pagination";
import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Connection, Model } from "mongoose";
import { AuthService } from "../auth/auth.service";
import { AuditService } from "../audit/audit.service";
import { HoodsService, isOpenHood, type NearbyHood } from "../hoods/hoods.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";
import { StorageService } from "../storage/storage.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { EmailVerificationService } from "../verification/email-verification.service";
import { mergePreferences, type Preferences } from "./domain/preferences";
import { AccountLifecycle, DELETED_USER_NAME, DELETED_USER_UID, RESTORE_WINDOW_MS } from "./account-lifecycle";
import type { DeactivateDto, OnboardingDto, PreferencesDto, UpdateMeDto, VerifyLocationDto } from "./dto/users.dto";
import { User, UserDocument } from "./schemas/user.schema";

const MAX_BLOCKS = 500;
/** The name shown in place of someone who has deactivated their account. */
export const FORMER_NEIGHBOUR = "Former neighbour";
const MAX_ATTEMPTS_KEPT = 10;
const DAY_MS = 86_400_000;

export interface MeResponse {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  neighborhoodId?: string;
  isOnboarded: boolean;
  role: User["role"];
  verificationStatus: User["verificationStatus"];
  accountStatus: User["accountStatus"];
  restrictedUntil?: string | null;
  location?: User["location"];
  /** Set while waiting for staff to approve a join request (contract §16). */
  requestedHood: { id: string; name: string; requestedAt: string } | null;
  createdAt?: string;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  neighborhoodName?: string;
  neighbourSince?: string;
  bio?: string;
  verified: boolean;
  kind?: "neighbour" | "organisation";
}

export function toMe(u: User): MeResponse {
  return {
    uid: u.uid,
    email: u.email,
    emailVerified: Boolean(u.emailVerifiedAt),
    displayName: u.displayName,
    photoURL: u.photoURL,
    bio: u.bio,
    neighborhoodId: u.neighborhoodId,
    isOnboarded: u.isOnboarded,
    role: u.role,
    verificationStatus: u.verificationStatus,
    accountStatus: u.accountStatus,
    restrictedUntil: u.restrictedUntil?.toISOString() ?? null,
    location: u.location,
    requestedHood: u.requestedHood ? { id: u.requestedHood.id, name: u.requestedHood.name, requestedAt: u.requestedHood.requestedAt.toISOString() } : null,
    createdAt: u.createdAt?.toISOString(),
  };
}

/** Self-service account operations (the signed-in neighbour acting on themselves). */
@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly hoods: HoodsService,
    private readonly emailVerification: EmailVerificationService,
    private readonly notifications: NotificationsService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly lifecycle: AccountLifecycle,
  ) {}

  onModuleInit() {
    // A profile photo is in use for as long as it is someone's photo (StorageService.sweepUnreferenced).
    this.storage.registerReferenceSource({
      name: "users",
      inUse: async (urls) => (await this.users.find({ photoURL: { $in: urls } }).select({ photoURL: 1 }).lean<Pick<User, "photoURL">[]>().exec()).map((u) => u.photoURL!),
    });
  }

  findByUid(uid: string): Promise<UserDocument | null> {
    return this.users.findOne({ uid }).exec();
  }

  /**
   * GET /users/me. First call creates the account and its verification token
   * in one transaction, then (after commit) sends the welcome email once.
   * Later calls — every sign-in — just return the profile.
   */
  async getOrCreateMe(token: DecodedIdToken): Promise<MeResponse> {
    // A provider like Google has already proven the address is theirs.
    const providerVerified = token.email_verified === true && token.firebase?.sign_in_provider !== "password";
    const existing = await this.findByUid(token.uid);
    if (existing) {
      // An existing account is never recreated or overwritten by signing in, whichever method is used:
      // name, photo, Hood, role and onboarding stay exactly as they are. Only two things can change here.
      let changed = false;
      // Deleted for good. (Their Firebase sign-in went with it; this covers a token issued just before.)
      if (existing.purgedAt) throw new GoneException("This account has been deleted.");
      if (existing.deactivatedAt) {
        // Past the 30 days, with deletion running: it is about to be deleted, and must not be half-restored meanwhile.
        const pastWindow = Date.now() - existing.deactivatedAt.getTime() > RESTORE_WINDOW_MS;
        if (pastWindow && this.config.get<string>("deletion.mode") === "live") {
          throw new GoneException("This account was deactivated more than 30 days ago and can no longer be restored.");
        }
        // Logging back in within 30 days restores the account (contract §10). Their content comes back
        // first: if that fails they are still deactivated, and the next sign-in tries again.
        await this.lifecycle.unhide(existing.uid);
        existing.deactivatedAt = null;
        existing.deactivation = null;
        changed = true;
      }
      if (!existing.emailVerifiedAt && providerVerified) {
        // They signed up with a password and now use Google with the same address: no need to ask them to confirm it.
        existing.emailVerifiedAt = new Date();
        changed = true;
      }
      if (changed) await existing.save();
      return toMe(existing);
    }

    let rawToken: string | undefined;
    let created: UserDocument;
    try {
      created = await withTransaction(this.connection, async (session) => {
        const [user] = await this.users.create(
          [
            {
              uid: token.uid,
              email: token.email ?? `${token.uid}@users.myhoodora.invalid`,
              displayName: token.name,
              photoURL: token.picture,
              provider: token.firebase?.sign_in_provider ?? "password",
              emailVerifiedAt: providerVerified ? new Date() : null,
            },
          ],
          { session },
        );
        if (!providerVerified && token.email) rawToken = await this.emailVerification.issue(token.uid, session);
        return user!;
      });
    } catch (err) {
      // Two first requests raced; the other one created the account.
      if ((err as { code?: number }).code === 11000) {
        const again = await this.findByUid(token.uid);
        if (again) return toMe(again);
      }
      throw err;
    }

    if (token.email) {
      // After commit, outside the transaction; failures are recorded, not thrown.
      await this.emailVerification.sendWelcome(created, rawToken).catch(() => this.logger.warn("Welcome email could not be queued."));
    }
    return toMe(created);
  }

  async me(uid: string): Promise<MeResponse> {
    const user = await this.findByUid(uid);
    if (!user) throw new NotFoundException("Profile not found. Sign in again to create it.");
    return toMe(user);
  }

  /**
   * PATCH /users/me — display name, bio, photo only. `photoURL: null` removes
   * the photo. A replaced or removed photo we stored is deleted afterwards.
   */
  async updateMe(uid: string, dto: UpdateMeDto): Promise<MeResponse> {
    const { photoURL, ...rest } = dto;
    const update = {
      $set: { ...rest, ...(photoURL && { photoURL }) },
      ...(photoURL === null && { $unset: { photoURL: 1 } }),
    };
    const before = await this.users.findOneAndUpdate({ uid }, update, { new: false, runValidators: true }).exec();
    if (!before) throw new NotFoundException("Profile not found.");
    if (photoURL !== undefined && before.photoURL && before.photoURL !== photoURL) {
      // Only files this person uploaded through us are touched; Google/Apple photos are left alone.
      void this.storage.discardByUrl(uid, before.photoURL);
    }
    return toMe((await this.findByUid(uid))!);
  }

  /**
   * Account writes before the first GET /users/me can find no document (it
   * failed or never ran). Create it from the token, exactly as sign-in would.
   */
  async ensureAccount(viewer: Viewer, token: DecodedIdToken): Promise<void> {
    if (!viewer.exists) await this.getOrCreateMe(token);
  }

  async completeOnboarding(uid: string, dto: OnboardingDto): Promise<MeResponse> {
    const set: Partial<User> = { isOnboarded: true };
    if (dto.displayName !== undefined) set.displayName = dto.displayName;
    if (dto.location !== undefined) set.location = dto.location;
    const user = await this.users.findOneAndUpdate({ uid }, { $set: set }, { new: true, runValidators: true }).exec();
    if (!user) throw new NotFoundException("Profile not found.");
    return toMe(user);
  }

  /**
   * Address verification: match the point to an open Hood. Records every
   * attempt (last 10) so staff can review failures in the verification queue.
   * Outside every Hood, offers the close ones to ask to join (contract §16).
   *
   * The coordinates come from the caller, so this is only as strong as their honesty. It must at least
   * not let a verified neighbour walk from Hood to Hood: a point in a *different* Hood moves them only
   * once `verifiedAt` is older than the cooldown (90 days by default), and every such move is audited.
   * Sooner than that it is 409 and they stay where they are; staff can still move them (change_hood).
   */
  async verifyLocation(viewer: Viewer, dto: VerifyLocationDto) {
    const user = await this.findByUid(viewer.uid);
    if (!user) throw new NotFoundException("Profile not found.");
    if (user.verificationStatus === "rejected") {
      throw new ForbiddenException("Your address couldn't be verified. Contact support if you think that's wrong.");
    }
    const match = await this.hoods.findVerifiedMatch(dto.lng, dto.lat);
    // Already a verified neighbour somewhere else: this check would move them.
    const movingFrom = match && user.verificationStatus === "verified" && user.neighborhoodId && user.neighborhoodId !== match.neighborhoodId ? user.neighborhoodId : undefined;
    const cooldownDays = this.config.get<number>("verification.hoodChangeCooldownDays") ?? 90;
    const tooSoon =
      Boolean(movingFrom) &&
      this.config.get<boolean>("verification.strictHoodAccess") !== false &&
      Date.now() - (user.verifiedAt?.getTime() ?? 0) < cooldownDays * DAY_MS;

    const result = !match ? ("outside_coverage" as const) : tooSoon ? ("mismatch" as const) : ("matched" as const);
    const attempt = { at: new Date(), lat: dto.lat, lng: dto.lng, address: dto.address, result };
    const attempts = [...(user.verificationAttempts ?? []), attempt].slice(-MAX_ATTEMPTS_KEPT);

    if (!match || tooSoon) {
      await this.users.updateOne({ uid: viewer.uid }, { $set: { lastKnownLocation: { lat: dto.lat, lng: dto.lng }, verificationAttempts: attempts } }).exec();
      if (tooSoon) {
        const current = (await this.hoods.findManyByIds([movingFrom!])).get(movingFrom!);
        throw new ConflictException(
          `You're a verified neighbour in ${current?.name ?? "another neighbourhood"}, and you can change neighbourhood once every ${cooldownDays} days. If you've moved, contact support and we'll help.`,
        );
      }
      return {
        verificationStatus: user.verificationStatus === "verified" ? "verified" : "unverified",
        reason: "outside_coverage" as const,
        nearbyHoods: await this.nearbyHoods(dto.lng, dto.lat),
      };
    }

    const changedHood = user.neighborhoodId !== match.neighborhoodId;
    const update = {
      $set: {
        neighborhoodId: match.neighborhoodId,
        verificationStatus: "verified" as const,
        verifiedAt: changedHood || !user.verifiedAt ? new Date() : user.verifiedAt,
        lastKnownLocation: { lat: dto.lat, lng: dto.lng },
        verificationAttempts: attempts,
        requestedHood: null,
      },
    };
    if (movingFrom) {
      // A neighbour moving themselves is recorded with the move, so staff can see it (and a pattern of it).
      const hoods = await this.hoods.findManyByIds([movingFrom, match.neighborhoodId]);
      const from = hoods.get(movingFrom)?.name ?? "another Hood";
      await withTransaction(this.connection, async (s) => {
        await this.users.updateOne({ uid: viewer.uid }, update, { session: s }).exec();
        await this.audit.record(
          viewer,
          "hood_self_change",
          { type: "user", id: viewer.uid, label: hoods.get(match.neighborhoodId)?.name ?? "another Hood" },
          { reason: dto.address ? `From ${from} · ${dto.address}` : `From ${from}` },
          s,
        );
      });
    } else {
      await this.users.updateOne({ uid: viewer.uid }, update).exec();
    }
    if (user.verificationStatus !== "verified") {
      await this.notifications.notify({ uids: [viewer.uid], type: "verification", title: "You're a verified neighbour", body: "Welcome to your Hood.", href: "/news-feed" });
    }
    return { verificationStatus: "verified" as const, neighborhoodId: match.neighborhoodId, distanceMeters: Math.round(match.distanceMeters) };
  }

  private nearbyHoods(lng: number, lat: number): Promise<NearbyHood[]> {
    return this.hoods.nearbyForJoin(lng, lat, this.config.get<number>("verification.nearbyBufferMeters") ?? 3000);
  }

  /**
   * Ask to join a Hood near your last address check. The Hood must be one the
   * server offers for that point (never trusted from the client). Puts you in
   * the staff verification queue; re-requesting replaces the request.
   */
  async requestHood(viewer: Viewer, hoodId: string): Promise<MeResponse> {
    const user = await this.findByUid(viewer.uid);
    if (!user) throw new NotFoundException("Profile not found.");
    if (user.verificationStatus === "verified") throw new ConflictException("You're already a verified neighbour.");
    if (user.verificationStatus === "rejected") {
      throw new ForbiddenException("Your address couldn't be verified. Contact support if you think that's wrong.");
    }
    const last = user.verificationAttempts?.[user.verificationAttempts.length - 1];
    const hood = last ? (await this.nearbyHoods(last.lng, last.lat)).find((h) => h.id === hoodId) : undefined;
    if (!hood) {
      const known = (await this.hoods.findManyByIds([hoodId])).get(hoodId);
      if (known && !isOpenHood(known)) throw new BadRequestException("That neighbourhood isn't taking new neighbours right now.");
      throw new BadRequestException("That neighbourhood isn't near your address.");
    }
    const updated = await withTransaction(this.connection, async (s) => {
      const doc = await this.users
        .findOneAndUpdate(
          { uid: viewer.uid, verificationStatus: { $in: ["unverified", "pending_review"] } },
          { $set: { verificationStatus: "pending_review", requestedHood: { id: hood.id, name: hood.name, requestedAt: new Date() } } },
          { new: true, session: s },
        )
        .exec();
      if (!doc) throw new ConflictException("Your verification status just changed. Refresh and try again.");
      await this.audit.record(viewer, "hood_request", { type: "user", id: viewer.uid, label: hood.name }, { reason: last?.address }, s);
      return doc;
    });
    this.realtime.toStaff("queue.changed");
    return toMe(updated);
  }

  /** Withdraw a pending join request; 409 if nothing is pending. */
  async cancelHoodRequest(viewer: Viewer): Promise<MeResponse> {
    const updated = await withTransaction(this.connection, async (s) => {
      const before = await this.users
        .findOneAndUpdate(
          { uid: viewer.uid, verificationStatus: "pending_review", requestedHood: { $ne: null } },
          { $set: { verificationStatus: "unverified", requestedHood: null } },
          { session: s },
        )
        .exec();
      if (!before) throw new ConflictException("You don't have a pending request to join a neighbourhood.");
      await this.audit.record(viewer, "hood_request_cancel", { type: "user", id: viewer.uid, label: before.requestedHood!.name }, {}, s);
      return this.users.findOne({ uid: viewer.uid }).session(s).exec();
    });
    this.realtime.toStaff("queue.changed");
    return toMe(updated!);
  }

  /**
   * GET /users/:uid/public — name, Hood name, badge, bio. Never email,
   * address or coordinates. 410 for deactivated people, 404 for blocks (never say who blocked whom).
   * Visible to neighbours of their own Hood and, with "Nearby neighbourhoods too"
   * (privacy.profileVisibility), verified neighbours of the Hoods near it. Staff excepted. Beyond
   * that: 403 "restricted" when the viewer is in a nearby Hood and the owner kept it closed, and
   * 404 "outside your coverage" when the viewer is simply too far away for the owner's choice to matter.
   */
  async publicProfile(viewer: Viewer, uid: string): Promise<PublicProfile> {
    const target = await this.users.findOne({ uid }).lean<User>().exec();
    const staff = viewer.capabilities.includes("admin.access");
    if (!target) throw new NotFoundException("This neighbour isn't available.");
    if (target.deactivatedAt || target.purgedAt) throw new GoneException("This account has been deactivated.");
    if (!staff && uid !== viewer.uid) {
      // `viewer.hoodId` is only set for a verified neighbour, so nobody else gets past here.
      const sameHood = Boolean(viewer.hoodId) && target.neighborhoodId === viewer.hoodId;
      if (!sameHood) {
        const inReach = Boolean(viewer.hoodId) && Boolean(target.neighborhoodId) && target.verificationStatus === "verified" && (await this.hoods.nearbyHoodIds(target.neighborhoodId!)).includes(viewer.hoodId!);
        const name = target.displayName ?? "This neighbour";
        if (!inReach) {
          // Nothing the owner chose: they simply live outside the viewer's neighbourhoods.
          throw new NotFoundException(`${name} is outside your neighbourhood coverage, so their profile isn't available to you.`);
        }
        if (target.preferences?.privacy?.profileVisibility !== "nearby") {
          throw new ForbiddenException(`${name} has restricted who can see their profile, so you can't view it.`);
        }
      }
    }
    if (uid !== viewer.uid && !staff) {
      const me = await this.users.findOne({ uid: viewer.uid }).select({ blockedUids: 1 }).lean<Pick<User, "blockedUids">>().exec();
      if (me?.blockedUids?.includes(uid) || target.blockedUids?.includes(viewer.uid)) throw new NotFoundException("This neighbour isn't available.");
    }
    const hood = target.neighborhoodId ? (await this.hoods.findManyByIds([target.neighborhoodId])).get(target.neighborhoodId) : undefined;
    const showSince = target.preferences?.privacy?.showNeighbourSince !== false;
    return {
      uid: target.uid,
      displayName: target.displayName ?? "Neighbour",
      photoURL: target.photoURL,
      neighborhoodName: hood?.name,
      neighbourSince: showSince ? target.verifiedAt?.toISOString() : undefined,
      bio: target.bio,
      verified: target.verificationStatus === "verified",
      kind: "neighbour",
    };
  }

  /**
   * GET /users/search (contract §8 invites): verified, active neighbours in
   * the caller's own Hood whose name matches. Blocks either way are hidden.
   */
  async search(viewer: Viewer, q: string): Promise<PublicProfile[]> {
    if (!viewer.hoodId) return [];
    const re = searchRegex(q);
    const hidden = await this.hiddenAuthorsFor(viewer.uid);
    const rows = await this.users
      .find({
        neighborhoodId: viewer.hoodId,
        verificationStatus: "verified",
        deactivatedAt: null,
        accountStatus: { $ne: "suspended" },
        uid: { $nin: [viewer.uid, ...hidden] },
        ...(re && { displayName: re }),
      })
      .sort({ displayName: 1 })
      .limit(20)
      .lean<User[]>()
      .exec();
    const hood = (await this.hoods.findManyByIds([viewer.hoodId])).get(viewer.hoodId);
    return rows.map((u) => ({
      uid: u.uid,
      displayName: u.displayName ?? "Neighbour",
      photoURL: u.photoURL,
      neighborhoodName: hood?.name,
      verified: true,
      kind: "neighbour" as const,
    }));
  }

  async getPreferences(uid: string): Promise<Preferences> {
    const user = await this.users.findOne({ uid }).select({ preferences: 1 }).lean<Pick<User, "preferences">>().exec();
    return mergePreferences(user?.preferences, {});
  }

  async updatePreferences(uid: string, dto: PreferencesDto): Promise<Preferences> {
    const current = await this.getPreferences(uid);
    const next = mergePreferences(current, dto as Partial<Preferences>);
    await this.users.updateOne({ uid }, { $set: { preferences: next } }).exec();
    return next;
  }

  async listBlocks(uid: string): Promise<string[]> {
    const user = await this.users.findOne({ uid }).select({ blockedUids: 1 }).lean<Pick<User, "blockedUids">>().exec();
    return user?.blockedUids ?? [];
  }

  async block(uid: string, target: string): Promise<string[]> {
    if (target === uid) throw new BadRequestException("You can't block yourself.");
    const user = await this.users
      .findOneAndUpdate({ uid, [`blockedUids.${MAX_BLOCKS - 1}`]: { $exists: false } }, { $addToSet: { blockedUids: target } }, { new: true })
      .exec();
    if (!user) throw new BadRequestException(`You can block up to ${MAX_BLOCKS} people.`);
    return user.blockedUids;
  }

  async unblock(uid: string, target: string): Promise<void> {
    await this.users.updateOne({ uid }, { $pull: { blockedUids: target } }).exec();
  }

  /**
   * Hide the account and everything it posted, and sign out everywhere; restored by signing in
   * within 30 days. Their posts and listings are hidden outright; what they wrote in other people's
   * threads stays, without their name or photo (authorCards). Safe to repeat: if hiding fails the
   * request fails with the sessions still live, so the app can simply try again.
   */
  async deactivate(uid: string, dto: DeactivateDto): Promise<void> {
    const deactivation = { reason: dto.reason, ...(dto.details?.trim() && { details: dto.details.trim() }) };
    // The first time only: deactivating again must not restart the 30 days.
    await this.users.updateOne({ uid, deactivatedAt: null }, { $set: { deactivatedAt: new Date() } }).exec();
    await this.users.updateOne({ uid, purgedAt: null }, { $set: { deactivation } }).exec();
    await this.lifecycle.hide(uid);
    this.logger.log(`Account deactivated (reason: ${dto.reason})`);
    await this.auth.revokeTokens(uid).catch(() => undefined);
  }

  /** uids the viewer shouldn't see (blocked either way). */
  async hiddenAuthorsFor(uid: string): Promise<string[]> {
    const [me, blockers] = await Promise.all([
      this.users.findOne({ uid }).select({ blockedUids: 1 }).lean<Pick<User, "blockedUids">>().exec(),
      this.users.find({ blockedUids: uid }).select({ uid: 1 }).lean<Pick<User, "uid">[]>().exec(),
    ]);
    return [...new Set([...(me?.blockedUids ?? []), ...blockers.map((b) => b.uid)])];
  }

  /**
   * Active, verified members of a Hood, a page at a time in uid order (for Hood-wide notifications).
   * Pass the last uid of one page as `afterUid` for the next; "" starts from the beginning.
   */
  async membersOfHoodPage(hoodId: string, afterUid: string, limit: number): Promise<string[]> {
    const rows = await this.users
      .find({ neighborhoodId: hoodId, verificationStatus: "verified", deactivatedAt: null, accountStatus: { $ne: "suspended" }, uid: { $gt: afterUid } })
      .sort({ uid: 1 })
      .select({ uid: 1 })
      .limit(limit)
      .lean<Pick<User, "uid">[]>()
      .exec();
    return rows.map((r) => r.uid);
  }

  /**
   * Small author cards embedded on posts/comments (contract §3, avoids N+1).
   *
   * Someone who has deactivated is "Former neighbour" with no photo and no Hood: what they wrote in
   * other people's threads, groups and conversations stays readable, but not under their name.
   * `forStaff` keeps the real name, for admin screens where moderation has to know who it is.
   * Someone whose account has been deleted is "Deleted User" to everyone: there is no name left.
   */
  async authorCards(uids: string[], opts: { forStaff?: boolean } = {}): Promise<Map<string, { uid: string; displayName: string; photoURL?: string; neighborhoodId?: string }>> {
    const rows = await this.users
      .find({ uid: { $in: [...new Set(uids)] } })
      .select({ uid: 1, displayName: 1, photoURL: 1, neighborhoodId: 1, deactivatedAt: 1, purgedAt: 1 })
      .lean<Pick<User, "uid" | "displayName" | "photoURL" | "neighborhoodId" | "deactivatedAt" | "purgedAt">[]>()
      .exec();
    const cards = new Map<string, { uid: string; displayName: string; photoURL?: string; neighborhoodId?: string }>(
      rows.map((r) => [
        r.uid,
        r.purgedAt
          ? { uid: r.uid, displayName: DELETED_USER_NAME }
          : r.deactivatedAt && !opts.forStaff
            ? { uid: r.uid, displayName: FORMER_NEIGHBOUR }
            : { uid: r.uid, displayName: r.displayName ?? "Neighbour", photoURL: r.photoURL, neighborhoodId: r.neighborhoodId },
      ]),
    );
    // The stand-in left in a conversation where a deleted person's uid used to be.
    if (uids.includes(DELETED_USER_UID)) cards.set(DELETED_USER_UID, { uid: DELETED_USER_UID, displayName: DELETED_USER_NAME });
    return cards;
  }
}
