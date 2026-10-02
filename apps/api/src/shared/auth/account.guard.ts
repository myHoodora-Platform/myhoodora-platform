import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectModel } from "@nestjs/mongoose";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Model } from "mongoose";
import { User, UserDocument } from "../../users/schemas/user.schema";
import { capabilitiesOf, effectiveAccountStatus } from "../authz/roles";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ALLOW_SUSPENDED_KEY, type Viewer } from "./viewer";

/**
 * Runs after FirebaseAuthGuard. Loads our user record once per request and
 * attaches `request.viewer` (role, account state, Hood, capabilities).
 * Suspended accounts are blocked everywhere except @AllowSuspended routes.
 */
@Injectable()
export class AccountGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<{ user?: DecodedIdToken; viewer?: Viewer }>();
    if (!req.user) return true; // FirebaseAuthGuard already rejected unauthenticated requests.

    const doc = await this.users.findOne({ uid: req.user.uid }).lean<User>().exec();
    // "Sign out everywhere": refused here from our own record, so it takes effect on every instance
    // at once without waiting for anything to be re-checked with Firebase.
    if (doc?.sessionsRevokedAt && req.user.auth_time * 1000 < doc.sessionsRevokedAt.getTime()) {
      throw new UnauthorizedException("Invalid or expired token");
    }
    const subject = {
      role: doc?.role ?? "member",
      accountStatus: doc?.accountStatus ?? "active",
      verificationStatus: doc?.verificationStatus ?? "unverified",
      hoodId: doc?.neighborhoodId ?? null,
      restrictedUntil: doc?.restrictedUntil ?? null,
    } as const;

    const viewer: Viewer = {
      uid: req.user.uid,
      email: doc?.email ?? req.user.email,
      emailVerified: Boolean(doc?.emailVerifiedAt) || req.user.email_verified === true,
      displayName: doc?.displayName,
      role: subject.role,
      accountStatus: effectiveAccountStatus(subject),
      verificationStatus: subject.verificationStatus,
      hoodId: subject.hoodId,
      capabilities: doc?.deactivatedAt ? [] : capabilitiesOf(subject),
      exists: Boolean(doc),
    };
    req.viewer = viewer;

    const allowSuspended = this.reflector.getAllAndOverride<boolean>(ALLOW_SUSPENDED_KEY, [context.getHandler(), context.getClass()]);
    if (viewer.accountStatus === "suspended" && !allowSuspended) {
      throw new ForbiddenException("This account is suspended.");
    }
    return true;
  }
}
