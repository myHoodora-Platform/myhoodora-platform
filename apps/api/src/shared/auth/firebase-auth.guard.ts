import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdmin } from "../../config/firebase.config";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { SESSION_COOKIE_AUTH_KEY } from "./session-cookie-auth.decorator";

type FirebaseRequest = Request & { user?: DecodedIdToken };

/** The credential from `Authorization: Bearer <credential>`, or null. */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow routes marked with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing Bearer token");
    }

    // @SessionCookieAuth() routes take the web's session cookie; everything else an ID token.
    // Firebase signs the two with different issuers, so one is never accepted as the other.
    const viaSessionCookie = this.reflector.getAllAndOverride<boolean>(SESSION_COOKIE_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    try {
      const auth = getFirebaseAdmin().auth();
      const decodedToken = viaSessionCookie
        ? await auth.verifySessionCookie(token, /** checkRevoked */ true)
        : await auth.verifyIdToken(token, /** checkRevoked */ true);

      // Attach the decoded token so controllers can access it via @CurrentUser()
      const firebaseRequest = request as FirebaseRequest;
      firebaseRequest.user = decodedToken;
      return true;
    } catch (err: unknown) {
      // Log the error code only — never the token or its contents.
      this.logger.warn(`Firebase token rejected: ${(err as { code?: string }).code ?? "unknown"}`);
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
