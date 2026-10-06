import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { RevocationLookupUnavailable, SessionRevocationService } from "../../auth/session-revocation.service";
import { getFirebaseAdmin } from "../../config/firebase.config";
import { isKeyFetchFailure } from "./firebase-outage";
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

  constructor(
    private readonly reflector: Reflector,
    private readonly revocations: SessionRevocationService,
  ) {}

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

    // Two different failures, two different answers. A bad, expired or revoked credential is 401:
    // the web app then signs the person out. Not being able to find out (Google unreachable) is 503:
    // the web app retries and leaves them signed in. An outage must never read as a sign-out.
    const auth = getFirebaseAdmin().auth();
    let decodedToken: DecodedIdToken;
    try {
      // Signature, issuer, audience and expiry: checked locally, with Google's signing keys (fetched now and then, and cached).
      decodedToken = viaSessionCookie ? await auth.verifySessionCookie(token) : await auth.verifyIdToken(token);
    } catch (err: unknown) {
      if (isKeyFetchFailure(err)) throw this.unavailable("Google's signing keys could not be fetched");
      throw this.rejected((err as { code?: string }).code);
    }

    let revoked: boolean;
    try {
      // Revoked, disabled or deleted: checked against Firebase, remembered briefly (SessionRevocationService).
      revoked = await this.revocations.isRevoked(decodedToken);
    } catch (err: unknown) {
      if (err instanceof RevocationLookupUnavailable) throw this.unavailable(err.message);
      throw err;
    }
    if (revoked) throw this.rejected(viaSessionCookie ? "auth/session-cookie-revoked" : "auth/id-token-revoked");

    // Attach the decoded token so controllers can access it via @CurrentUser()
    const firebaseRequest = request as FirebaseRequest;
    firebaseRequest.user = decodedToken;
    return true;
  }

  private rejected(code: string | undefined): UnauthorizedException {
    // Log the error code only — never the token or its contents.
    this.logger.warn(`Firebase token rejected: ${code ?? "unknown"}`);
    return new UnauthorizedException("Invalid or expired token");
  }

  private unavailable(why: string): ServiceUnavailableException {
    // The exception filter logs the 503 itself; this adds the reason, which never reaches the client.
    this.logger.warn(`Sign-in could not be checked: ${why}`);
    return new ServiceUnavailableException("We can't check your sign-in right now. Please try again in a moment.");
  }
}
