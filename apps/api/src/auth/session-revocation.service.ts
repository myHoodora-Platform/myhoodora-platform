import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdmin } from "../config/firebase.config";

/** What Firebase knows about a user's sessions: when they were last revoked, and whether the account is disabled. */
interface SessionState {
  /** Tokens issued (signed in) before this are dead. 0 = never revoked. */
  validSinceMs: number;
  /** Disabled or deleted in Firebase: nothing is valid. */
  blocked: boolean;
  until: number;
}

const MAX_USERS = 20_000;

/**
 * "Has this sign-in been revoked?" without asking Google on every request.
 *
 * A Firebase ID token (or session cookie) is a signed JWT: checking its signature and expiry is
 * local and instant. Whether it has been *revoked* is not in the token; Firebase's own check
 * (`checkRevoked`) fetches the user record from Google each time, which the Firebase docs call
 * "an expensive operation, requiring an extra network round trip". That was a few hundred
 * milliseconds on every API call.
 *
 * So the same comparison is made here against a copy of the user's session state that is fetched
 * at most once per `AUTH_REVOCATION_CACHE_SECONDS` (default 30) per user, per API instance.
 *
 * What this does and doesn't delay:
 * - "Sign out everywhere" from our own app is NOT delayed: it is also recorded on our user record,
 *   which AccountGuard reads on every request (see AuthService.revokeTokens).
 * - Suspending someone in the admin is NOT delayed: that is `accountStatus`, also read every request.
 * - Changes made directly in Firebase (a password reset, or disabling/deleting the user in the
 *   console) reach the API within the cache window instead of at once.
 *
 * Set AUTH_REVOCATION_CACHE_SECONDS=0 to ask Google on every request again.
 */
@Injectable()
export class SessionRevocationService {
  private readonly ttlMs: number;
  private readonly states = new Map<string, SessionState>();
  private readonly loading = new Map<string, Promise<SessionState>>();

  constructor(config: ConfigService) {
    this.ttlMs = config.get<number>("auth.revocationCacheMs") ?? 30_000;
  }

  /** True when this token's sign-in has been revoked, or its account disabled or deleted. */
  async isRevoked(token: Pick<DecodedIdToken, "uid" | "auth_time">): Promise<boolean> {
    const state = await this.stateOf(token.uid);
    // Same rule as the Admin SDK: a token is dead if its sign-in happened before the last revocation.
    return state.blocked || token.auth_time * 1000 < state.validSinceMs;
  }

  /** Drop what we remember about someone (their sessions just changed), so the next request asks afresh. */
  forget(uid: string): void {
    this.states.delete(uid);
  }

  private stateOf(uid: string): Promise<SessionState> {
    const known = this.states.get(uid);
    if (known && Date.now() < known.until) return Promise.resolve(known);
    // A page load is several requests at once: they share one lookup.
    const running = this.loading.get(uid);
    if (running) return running;
    const lookup = this.fetch(uid).finally(() => this.loading.delete(uid));
    this.loading.set(uid, lookup);
    return lookup;
  }

  private async fetch(uid: string): Promise<SessionState> {
    let state: SessionState;
    try {
      const user = await getFirebaseAdmin().auth().getUser(uid);
      const validSince = user.tokensValidAfterTime ? new Date(user.tokensValidAfterTime).getTime() : 0;
      state = { validSinceMs: Number.isFinite(validSince) ? validSince : 0, blocked: user.disabled === true, until: Date.now() + this.ttlMs };
    } catch (err) {
      // The account no longer exists: every token for it is dead. Anything else (Google unreachable)
      // is not an answer, so it is neither remembered nor treated as "fine": the request fails.
      if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
      state = { validSinceMs: 0, blocked: true, until: Date.now() + this.ttlMs };
    }
    if (this.ttlMs > 0) {
      if (this.states.size >= MAX_USERS) this.states.delete(this.states.keys().next().value!);
      this.states.delete(uid);
      this.states.set(uid, state);
    }
    return state;
  }
}
