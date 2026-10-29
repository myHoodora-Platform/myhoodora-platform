import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Viewer } from "../auth/viewer";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";
import type { Capability } from "./roles";

export const CAPABILITIES_KEY = "capabilities";

/**
 * Declare the capability a route needs (all listed are required).
 * Record-level rules (own post, same Hood) are checked in the service.
 */
export const Can = (...capabilities: Capability[]) => SetMetadata(CAPABILITIES_KEY, capabilities);

/**
 * What to tell someone who may not post or message, naming the one thing they can do about it.
 * In the order they have to be done: be allowed to post at all, verify the address, confirm the email.
 */
export function whyNoWriting(viewer: Pick<Viewer, "accountStatus" | "verificationStatus" | "hoodId" | "emailVerified">): string {
  if (viewer.accountStatus !== "active") return "Your account is restricted from posting right now.";
  if (viewer.verificationStatus !== "verified" || !viewer.hoodId) return "Verify your address to join your neighbourhood first.";
  if (!viewer.emailVerified) return "Confirm your email address first. We sent you a link when you signed up; you can ask for a new one at the top of the app.";
  return "You don't have access to this.";
}

/** Global guard, runs after AccountGuard has attached the viewer. */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[] | undefined>(CAPABILITIES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const viewer = context.switchToHttp().getRequest<{ viewer?: Viewer }>().viewer;
    if (!viewer) throw new ForbiddenException("You don't have access to this.");
    const missing = required.filter((c) => !viewer.capabilities.includes(c));
    if (missing.length) {
      // Say why for the cases the person can act on; keep staff scopes opaque.
      if (missing.every((c) => c === "content.create" || c === "content.react")) throw new ForbiddenException(whyNoWriting(viewer));
      // Messaging stays open to someone restricted, so for them the reason is never the restriction.
      if (missing.every((c) => c === "messages.send")) throw new ForbiddenException(whyNoWriting({ ...viewer, accountStatus: "active" }));
      throw new ForbiddenException("You don't have access to this.");
    }
    return true;
  }
}
