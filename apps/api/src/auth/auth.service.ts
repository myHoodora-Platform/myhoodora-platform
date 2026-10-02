import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getFirebaseAdmin } from "../config/firebase.config";

export interface WebSession {
  /** Firebase session cookie. The web server stores it HttpOnly; it never reaches browser JavaScript. */
  sessionCookie: string;
  /** Seconds until it expires. */
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  /** Exchanges an ID token the guard has already verified (signature, expiry, revocation) for a session cookie. */
  async createSession(idToken: string): Promise<WebSession> {
    const expiresIn = this.config.get<number>("auth.sessionTtlMs")!;
    const sessionCookie = await getFirebaseAdmin()
      .auth()
      .createSessionCookie(idToken, { expiresIn })
      .catch((err: unknown) => {
        // The token expired or was revoked between the guard and here: a sign-in problem, not a server fault.
        if ((err as { code?: string }).code === "auth/invalid-id-token") throw new UnauthorizedException("Invalid or expired token");
        throw err;
      });
    return { sessionCookie, expiresIn: Math.floor(expiresIn / 1000) };
  }

  /** "Sign out everywhere": revokes every refresh token, which also invalidates every session cookie. */
  async revokeTokens(uid: string): Promise<void> {
    await getFirebaseAdmin().auth().revokeRefreshTokens(uid);
  }
}
