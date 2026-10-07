/**
 * jest.mock factory for src/config/firebase.config. Tokens look like
 * "t:<uid>:<v|u>:<provider>" and decode to a Firebase DecodedIdToken.
 * Session cookies look like "s:<uid>"; like the real ones, neither passes as the other.
 * revokeRefreshTokens(uid) invalidates every sign-in from before that moment, as Firebase does;
 * "t:<uid>:v:password:fresh" / "s:<uid>:fresh" are a sign-in made after it.
 * `firebaseState.lookupDown` / `keysDown` make Google unreachable, failing the way the Admin SDK does.
 */
/** uid → when Firebase last revoked their sessions (ms). */
const revokedAt = new Map<string, number>();
/** uids disabled or deleted in Firebase (set directly by tests). */
export const firebaseState = {
  disabled: new Set<string>(),
  deleted: new Set<string>(),
  getUserCalls: 0,
  /** Google's user lookup can't be reached: getUser fails as the Admin SDK does on a network error. */
  lookupDown: false,
  /** Deleting a user fails (Firebase unreachable), until this is cleared. */
  deleteDown: false,
  /** Google's signing keys can't be fetched: verification fails as the Admin SDK reports it (same code as a bad token; only the message differs). */
  keysDown: false,
};
const keysUnavailable = () => Object.assign(new Error("Error while making request: connect ETIMEDOUT. Error code: ETIMEDOUT"), { code: "auth/argument-error" });
/** Every test token belongs to a sign-in from a minute before the tests began. Append ":fresh" for one from right now. */
const SIGNED_IN_AT = Math.floor(Date.now() / 1000) - 60;
const authTime = (parts: string[]) => (parts.includes("fresh") ? Math.floor(Date.now() / 1000) + 1 : SIGNED_IN_AT);

export const firebaseMock = {
  getFirebaseAdmin: () => ({
    auth: () => ({
      // Like the real SDK without checkRevoked: signature and shape only. Revocation is the API's own check (getUser below).
      verifyIdToken: async (token: string) => {
        if (firebaseState.keysDown) throw keysUnavailable();
        const parts = token.split(":");
        const [prefix, uid, v, provider] = parts;
        if (prefix !== "t" || !uid) throw Object.assign(new Error("bad token"), { code: "auth/argument-error" });
        return { uid, email: `${uid}@test.dev`, email_verified: v === "v", name: uid, auth_time: authTime(parts), firebase: { sign_in_provider: provider && provider !== "fresh" ? provider : "password" } };
      },
      createSessionCookie: async (idToken: string, opts: { expiresIn: number }) => {
        const [prefix, uid] = idToken.split(":");
        if (prefix !== "t" || !uid || !opts.expiresIn) throw Object.assign(new Error("bad token"), { code: "auth/invalid-id-token" });
        return `s:${uid}`;
      },
      verifySessionCookie: async (cookie: string) => {
        if (firebaseState.keysDown) throw keysUnavailable();
        const parts = cookie.split(":");
        const [prefix, uid] = parts;
        if (prefix !== "s" || !uid) throw Object.assign(new Error("bad cookie"), { code: "auth/argument-error" });
        return { uid, email: `${uid}@test.dev`, email_verified: true, auth_time: authTime(parts), firebase: { sign_in_provider: "password" } };
      },
      getUser: async (uid: string) => {
        firebaseState.getUserCalls++;
        if (firebaseState.lookupDown) throw Object.assign(new Error("Error while making request: read ECONNRESET. Error code: ECONNRESET"), { code: "app/network-error" });
        if (firebaseState.deleted.has(uid)) throw Object.assign(new Error("no such user"), { code: "auth/user-not-found" });
        const at = revokedAt.get(uid);
        return { uid, disabled: firebaseState.disabled.has(uid), tokensValidAfterTime: at ? new Date(at).toUTCString() : undefined };
      },
      revokeRefreshTokens: async (uid: string) => void revokedAt.set(uid, Math.floor(Date.now() / 1000) * 1000),
      updateUser: async () => undefined,
      deleteUser: async (uid: string) => {
        if (firebaseState.deleteDown) throw Object.assign(new Error("Error while making request: read ECONNRESET. Error code: ECONNRESET"), { code: "app/network-error" });
        if (firebaseState.deleted.has(uid)) throw Object.assign(new Error("no such user"), { code: "auth/user-not-found" });
        firebaseState.deleted.add(uid);
      },
    }),
  }),
  initializeFirebase: () => undefined,
};
