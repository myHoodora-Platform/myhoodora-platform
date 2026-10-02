/**
 * jest.mock factory for src/config/firebase.config. Tokens look like
 * "t:<uid>:<v|u>:<provider>" and decode to a Firebase DecodedIdToken.
 * Session cookies look like "s:<uid>"; like the real ones, neither passes as the other.
 * revokeRefreshTokens(uid) invalidates that uid's session cookies, as Firebase does.
 */
const revoked = new Set<string>();

export const firebaseMock = {
  getFirebaseAdmin: () => ({
    auth: () => ({
      verifyIdToken: async (token: string) => {
        const [prefix, uid, v, provider] = token.split(":");
        if (prefix !== "t" || !uid) throw Object.assign(new Error("bad token"), { code: "auth/argument-error" });
        return { uid, email: `${uid}@test.dev`, email_verified: v === "v", name: uid, firebase: { sign_in_provider: provider ?? "password" } };
      },
      createSessionCookie: async (idToken: string, opts: { expiresIn: number }) => {
        const [prefix, uid] = idToken.split(":");
        if (prefix !== "t" || !uid || !opts.expiresIn) throw Object.assign(new Error("bad token"), { code: "auth/invalid-id-token" });
        return `s:${uid}`;
      },
      verifySessionCookie: async (cookie: string, checkRevoked?: boolean) => {
        const [prefix, uid] = cookie.split(":");
        if (prefix !== "s" || !uid) throw Object.assign(new Error("bad cookie"), { code: "auth/argument-error" });
        if (checkRevoked && revoked.has(uid)) throw Object.assign(new Error("revoked"), { code: "auth/session-cookie-revoked" });
        return { uid, email: `${uid}@test.dev`, email_verified: true, firebase: { sign_in_provider: "password" } };
      },
      revokeRefreshTokens: async (uid: string) => void revoked.add(uid),
      updateUser: async () => undefined,
    }),
  }),
  initializeFirebase: () => undefined,
};
