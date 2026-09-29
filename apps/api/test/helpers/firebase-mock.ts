/**
 * jest.mock factory for src/config/firebase.config. Tokens look like
 * "t:<uid>:<v|u>:<provider>" and decode to a Firebase DecodedIdToken.
 */
export const firebaseMock = {
  getFirebaseAdmin: () => ({
    auth: () => ({
      verifyIdToken: async (token: string) => {
        const [prefix, uid, v, provider] = token.split(":");
        if (prefix !== "t" || !uid) throw Object.assign(new Error("bad token"), { code: "auth/argument-error" });
        return { uid, email: `${uid}@test.dev`, email_verified: v === "v", name: uid, firebase: { sign_in_provider: provider ?? "password" } };
      },
      revokeRefreshTokens: async () => undefined,
      updateUser: async () => undefined,
    }),
  }),
  initializeFirebase: () => undefined,
};
