import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { AccountStatus, Capability, Role, VerificationStatus } from "../authz/roles";

/**
 * The signed-in person, loaded once per request by AccountGuard from the
 * Firebase token + our user record. The only identity controllers use.
 */
export interface Viewer {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  role: Role;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  /** The caller's own Hood — every Hood-scoped query uses this, never a client param. */
  hoodId: string | null;
  capabilities: Capability[];
  /** false until GET /users/me has created the record. */
  exists: boolean;
}

export const CurrentViewer = createParamDecorator((_data: unknown, ctx: ExecutionContext): Viewer => {
  const req = ctx.switchToHttp().getRequest<{ viewer: Viewer }>();
  return req.viewer;
});

export const ALLOW_SUSPENDED_KEY = "allowSuspended";

/** Routes a suspended person may still call (see their own status, log out). */
export const AllowSuspended = () => SetMetadata(ALLOW_SUSPENDED_KEY, true);
