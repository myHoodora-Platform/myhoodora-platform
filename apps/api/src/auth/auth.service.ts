import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { getFirebaseAdmin } from "../config/firebase.config";
import { User, UserDocument } from "../users/schemas/user.schema";
import { SessionRevocationService } from "./session-revocation.service";

export interface WebSession {
  /** Firebase session cookie. The web server stores it HttpOnly; it never reaches browser JavaScript. */
  sessionCookie: string;
  /** Seconds until it expires. */
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly revocations: SessionRevocationService,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

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
    // Whole seconds, like the tokens' own sign-in time, and taken first so a sign-in a moment later is never caught.
    const revokedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    // Firebase: no device can refresh its token any more…
    await getFirebaseAdmin().auth().revokeRefreshTokens(uid);
    // …and ours: every token already issued is refused from now, on every API instance, without waiting
    // for anything to be re-checked with Firebase (AccountGuard reads this on each request).
    await this.users.updateOne({ uid }, { $set: { sessionsRevokedAt: revokedAt } }).exec();
    this.revocations.forget(uid);
  }
}
