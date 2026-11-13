import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT, type JWK, type KeyLike } from "jose";
import { OAuthCode, IntegrationLink } from "../src/oauth/oauth.schemas";
import { AccountLifecycle } from "../src/users/account-lifecycle";
import { CURRENT_LEGAL } from "../src/users/domain/legal";
import type { User } from "../src/users/schemas/user.schema";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/** Signing in to myHoodoraAI with a myHoodora account: docs/integrations/myhoodora-ai.md §2–6. */

const ISSUER = "https://api.test";
const TOKEN_ENDPOINT = `${ISSUER}/api/v1/oauth/token`;
const CLIENT = "myhoodora-ai";
const REDIRECT = "https://studio.test/auth/myhoodora/callback";
const ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

const legal = () => [
  { doc: "terms" as const, version: CURRENT_LEGAL.terms, at: new Date(), via: "signup" as const },
  { doc: "privacy" as const, version: CURRENT_LEGAL.privacy, at: new Date(), via: "signup" as const },
];

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

async function keyPair(kid: string): Promise<{ privateJwk: JWK; publicJwk: JWK; key: KeyLike }> {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  return { privateJwk: { ...(await exportJWK(privateKey)), kid }, publicJwk: { ...(await exportJWK(publicKey)), kid, alg: "ES256" }, key: privateKey };
}

describe("Signing in to myHoodoraAI (OAuth / OpenID Connect)", () => {
  let t: TestApp;
  let client: Awaited<ReturnType<typeof keyPair>>;
  let impostor: Awaited<ReturnType<typeof keyPair>>;
  const saved = { ...process.env };

  beforeAll(async () => {
    const server = await keyPair("myhoodora-test");
    client = await keyPair("ai-test");
    impostor = await keyPair("ai-test");
    Object.assign(process.env, {
      AI_INTEGRATION_ENABLED: "true",
      OIDC_ISSUER: ISSUER,
      OIDC_SIGNING_KEYS: JSON.stringify({ keys: [server.privateJwk] }),
      OIDC_PAIRWISE_SECRET: "test-pairwise-secret-at-least-32-characters",
      AI_CLIENT_REDIRECT_URIS: REDIRECT,
      AI_CLIENT_JWKS: JSON.stringify({ keys: [client.publicJwk] }),
    });
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
    process.env = saved;
  });
  beforeEach(() => t.resetThrottle());

  /** Someone who may sign in: adult, current terms, confirmed email. */
  const ready = (uid: string, patch: Partial<User> = {}) => t.user(uid, { emailVerifiedAt: new Date(), legalAcceptances: legal(), ...patch });

  const request = (challenge: string, patch: Record<string, string> = {}) => ({
    response_type: "code",
    client_id: CLIENT,
    redirect_uri: REDIRECT,
    scope: "openid email profile",
    state: "state-abcdefgh",
    nonce: "nonce-abcdefgh",
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...patch,
  });

  const authorize = (uid: string, body: Record<string, string>, emailVerified = true) =>
    t.http.post("/api/v1/oauth/authorize").set(t.auth(uid, { emailVerified })).send(body);

  const assertion = (patch: { aud?: string; lifetime?: number; jti?: string; key?: KeyLike; iss?: string } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: "ai-test" })
      .setIssuer(patch.iss ?? CLIENT)
      .setSubject(CLIENT)
      .setAudience(patch.aud ?? TOKEN_ENDPOINT)
      .setIssuedAt(now)
      .setExpirationTime(now + (patch.lifetime ?? 60))
      .setJti(patch.jti ?? randomUUID())
      .sign(patch.key ?? client.key);
  };

  /** POST /oauth/token with a fresh client assertion (unless the form brings its own), expecting `status`. */
  const redeem = async (form: Record<string, string | undefined>, status: number) =>
    t.http
      .post("/api/v1/oauth/token")
      .type("form")
      .send({ grant_type: "authorization_code", redirect_uri: REDIRECT, client_id: CLIENT, client_assertion_type: ASSERTION_TYPE, client_assertion: await assertion(), ...form })
      .expect(status);

  /** Authorise and return the code from the redirect. */
  async function codeFor(uid: string, verifierPair = pkce()): Promise<{ code: string; verifier: string }> {
    const res = await authorize(uid, request(verifierPair.challenge)).expect(200);
    expect(res.body.kind).toBe("redirect");
    const url = new URL(res.body.url);
    expect(`${url.origin}${url.pathname}`).toBe(REDIRECT);
    expect(url.searchParams.get("state")).toBe("state-abcdefgh");
    const code = url.searchParams.get("code");
    expect(code).toBeTruthy();
    return { code: code!, verifier: verifierPair.verifier };
  }

  async function idTokenClaims(idToken: string) {
    const jwks = (await t.http.get("/.well-known/jwks.json").expect(200)).body;
    return (await jwtVerify(idToken, createLocalJWKSet(jwks), { issuer: ISSUER, audience: CLIENT, algorithms: ["ES256"] })).payload;
  }

  describe("discovery and keys", () => {
    it("are served at the issuer's root, not under /api", async () => {
      const doc = (await t.http.get("/.well-known/openid-configuration").expect(200)).body;
      expect(doc).toMatchObject({
        issuer: ISSUER,
        token_endpoint: TOKEN_ENDPOINT,
        jwks_uri: `${ISSUER}/.well-known/jwks.json`,
        authorization_endpoint: "https://app.test/oauth/authorize",
        response_types_supported: ["code"],
        subject_types_supported: ["pairwise"],
        id_token_signing_alg_values_supported: ["ES256"],
        token_endpoint_auth_methods_supported: ["private_key_jwt"],
        code_challenge_methods_supported: ["S256"],
      });
      await t.http.get("/api/.well-known/openid-configuration").expect(404);
    });

    it("publish public keys only", async () => {
      const res = await t.http.get("/.well-known/jwks.json").expect(200);
      expect(res.headers["cache-control"]).toContain("max-age=3600");
      expect(res.body.keys).toEqual([expect.objectContaining({ kty: "EC", crv: "P-256", kid: "myhoodora-test", alg: "ES256", use: "sig" })]);
      expect(res.body.keys[0]).not.toHaveProperty("d");
    });
  });

  describe("a full sign-in", () => {
    it("gives a code, then an ID token with the contract's claims and a pairwise subject", async () => {
      await ready("ada", { displayName: "Ada Obi" });
      const { code, verifier } = await codeFor("ada");
      const res = await redeem({ code, code_verifier: verifier }, 200);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body).toEqual({ id_token: expect.any(String), token_type: "Bearer", expires_in: 300 });

      const claims = await idTokenClaims(res.body.id_token);
      expect(claims).toMatchObject({
        iss: ISSUER,
        aud: CLIENT,
        nonce: "nonce-abcdefgh",
        email: "ada@test.dev",
        email_verified: true,
        name: "Ada Obi",
        hm_status: "active",
        hm_age_band: "adult",
        hm_age_assurance: "self_declared_dob",
        hm_contract: "1",
      });
      expect(claims.exp! - claims.iat!).toBe(300);
      expect(claims.hm_ai_role).toBeUndefined();
      expect(claims.sub).toHaveLength(43);
      expect(claims.sub).not.toContain("ada");
      expect(typeof claims.auth_time).toBe("number");

      // The same person gets the same subject next time, and the link is recorded for account events.
      const again = await codeFor("ada");
      const second = await idTokenClaims((await redeem({ code: again.code, code_verifier: again.verifier }, 200)).body.id_token);
      expect(second.sub).toBe(claims.sub);
      const links = await t.model<IntegrationLink>(IntegrationLink.name).find({ uid: "ada" }).lean().exec();
      expect(links).toEqual([expect.objectContaining({ clientId: CLIENT, sub: claims.sub })]);

      // Only a hash of the code is stored.
      const stored = await t.model<OAuthCode>(OAuthCode.name).find({ uid: "ada" }).lean().exec();
      expect(JSON.stringify(stored)).not.toContain(code);
    });

    it("the myHoodoraAI operator role (§5.4): granted by admins before a first sign-in, carried in the token", async () => {
      await t.user("boss", { role: "admin" });
      await t.user("mod", { role: "moderator" });
      await ready("opal");
      const grant = (uid: string, as: string, body: Record<string, unknown> = { grant: true, reason: "Runs myHoodora AI support" }) =>
        t.http.post(`/api/admin/neighbours/${uid}/ai-operator`).set(t.auth(as, { emailVerified: true })).send(body);

      await grant("opal", "mod").expect(403);
      expect((await grant("opal", "boss").expect(201)).body).toEqual({ granted: true, signedIn: false });
      const detail = (await t.http.get("/api/admin/neighbours/opal").set(t.auth("boss", { emailVerified: true })).expect(200)).body;
      expect(detail.aiOperator).toEqual({ granted: true, signedIn: false });

      const { code, verifier } = await codeFor("opal");
      const claims = await idTokenClaims((await redeem({ code, code_verifier: verifier }, 200)).body.id_token);
      expect(claims.hm_ai_role).toBe("operator");

      // Signed in already: granting again changes nothing; granting someone who signed in first is refused.
      expect((await grant("opal", "boss").expect(201)).body).toEqual({ granted: true, signedIn: true });
      await ready("olu");
      const first = await codeFor("olu");
      await redeem({ code: first.code, code_verifier: first.verifier }, 200);
      await grant("olu", "boss").expect(409);

      // Revoked: the next token has no claim, and both changes are audited.
      expect((await grant("opal", "boss", { grant: false, reason: "Left the team" }).expect(201)).body).toEqual({ granted: false, signedIn: true });
      const after = await codeFor("opal");
      expect((await idTokenClaims((await redeem({ code: after.code, code_verifier: after.verifier }, 200)).body.id_token)).hm_ai_role).toBeUndefined();
      const audit = (await t.http.get("/api/admin/neighbours/opal").set(t.auth("boss", { emailVerified: true })).expect(200)).body.timeline;
      expect(audit.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["ai_operator_grant", "ai_operator_revoke"]));
      await grant("opal", "boss", { grant: true }).expect(400);
    });

    it("a restricted neighbour can still sign in, and the token says so", async () => {
      await ready("ria", { accountStatus: "restricted", restrictedUntil: new Date(Date.now() + 86_400_000) });
      const { code, verifier } = await codeFor("ria");
      const claims = await idTokenClaims((await redeem({ code, code_verifier: verifier }, 200)).body.id_token);
      expect(claims.hm_status).toBe("restricted");
    });
  });

  describe("the code", () => {
    it("works once: a second redemption fails", async () => {
      await ready("once");
      const { code, verifier } = await codeFor("once");
      await redeem({ code, code_verifier: verifier }, 200);
      expect((await redeem({ code, code_verifier: verifier }, 400)).body).toEqual({ error: "invalid_grant" });
    });

    it("is spent by a wrong verifier, so the right one fails afterwards", async () => {
      await ready("guess");
      const { code, verifier } = await codeFor("guess");
      await redeem({ code, code_verifier: pkce().verifier }, 400);
      expect((await redeem({ code, code_verifier: verifier }, 400)).body.error).toBe("invalid_grant");
    });

    it("must come back with the same redirect URI", async () => {
      await ready("redir");
      const { code, verifier } = await codeFor("redir");
      expect((await redeem({ code, code_verifier: verifier, redirect_uri: `${REDIRECT}/` }, 400)).body.error).toBe("invalid_grant");
    });

    it("expires after 60 seconds", async () => {
      await ready("late");
      const { code, verifier } = await codeFor("late");
      await t.model<OAuthCode>(OAuthCode.name).updateMany({ uid: "late" }, { $set: { expiresAt: new Date(Date.now() - 1000) } }).exec();
      expect((await redeem({ code, code_verifier: verifier }, 400)).body.error).toBe("invalid_grant");
    });

    it("is refused if the account was suspended or signed out everywhere after it was issued", async () => {
      await ready("sus");
      const suspended = await codeFor("sus");
      await t.users.updateOne({ uid: "sus" }, { $set: { accountStatus: "suspended" } }).exec();
      expect((await redeem({ code: suspended.code, code_verifier: suspended.verifier }, 400)).body.error).toBe("invalid_grant");

      await ready("out");
      const signedOut = await codeFor("out");
      await t.users.updateOne({ uid: "out" }, { $set: { sessionsRevokedAt: new Date(Date.now() + 1000) } }).exec();
      expect((await redeem({ code: signedOut.code, code_verifier: signedOut.verifier }, 400)).body.error).toBe("invalid_grant");
    });

    it("an unknown code is refused", async () => {
      expect((await redeem({ code: "not-a-code", code_verifier: pkce().verifier }, 400)).body.error).toBe("invalid_grant");
    });
  });

  describe("client authentication (private_key_jwt)", () => {
    let code: string;
    let verifier: string;
    beforeEach(async () => {
      const uid = `c${randomUUID().slice(0, 8)}`;
      await ready(uid);
      ({ code, verifier } = await codeFor(uid));
    });

    it.each([
      ["no assertion", { client_assertion: undefined }],
      ["the wrong assertion type", { client_assertion_type: "urn:example:other" }],
      ["an unknown client", { client_id: "someone-else" }],
    ])("refuses %s with 401 invalid_client", async (_label, form) => {
      expect((await redeem({ code, code_verifier: verifier, ...form }, 401)).body).toEqual({ error: "invalid_client" });
    });

    it("refuses an assertion signed with someone else's key, for another audience, or by another issuer", async () => {
      await redeem({ code, code_verifier: verifier, client_assertion: await assertion({ key: impostor.key }) }, 401);
      await redeem({ code, code_verifier: verifier, client_assertion: await assertion({ aud: `${ISSUER}/api/v1/integrations/ai` }) }, 401);
      await redeem({ code, code_verifier: verifier, client_assertion: await assertion({ iss: "someone-else" }) }, 401);
      // None of those spent the code.
      await redeem({ code, code_verifier: verifier }, 200);
    });

    it("refuses an assertion that lives longer than a minute", async () => {
      await redeem({ code, code_verifier: verifier, client_assertion: await assertion({ lifetime: 600 }) }, 401);
    });

    it("accepts each assertion once", async () => {
      const once = await assertion();
      await redeem({ code, code_verifier: verifier, client_assertion: once }, 200);
      expect((await redeem({ code: "x", code_verifier: verifier, client_assertion: once }, 401)).body.error).toBe("invalid_client");
    });

    it("refuses other grant types", async () => {
      expect((await redeem({ grant_type: "client_credentials" }, 400)).body.error).toBe("unsupported_grant_type");
    });
  });

  describe("the authorisation request", () => {
    it("needs a signed-in person", async () => {
      await t.http.post("/api/v1/oauth/authorize").send(request(pkce().challenge)).expect(401);
    });

    it("an unknown client or an unregistered redirect URI is a 400, with no redirect", async () => {
      await ready("strict");
      const { challenge } = pkce();
      const res = await authorize("strict", request(challenge, { client_id: "evil" })).expect(400);
      expect(res.body.url).toBeUndefined();
      await authorize("strict", request(challenge, { redirect_uri: "https://evil.test/callback" })).expect(400);
      // Exact match only: not even a trailing slash.
      await authorize("strict", request(challenge, { redirect_uri: `${REDIRECT}/` })).expect(400);
    });

    it.each([
      ["a plain PKCE method", { code_challenge_method: "plain" }],
      ["no openid scope", { scope: "email" }],
      ["another response type", { response_type: "token" }],
      ["a short nonce", { nonce: "n" }],
      ["a malformed challenge", { code_challenge: "too-short" }],
    ])("%s goes back to the app as invalid_request", async (_label, patch) => {
      await ready(`bad${Object.keys(patch)[0]}`);
      const res = await authorize(`bad${Object.keys(patch)[0]}`, request(pkce().challenge, patch)).expect(200);
      const url = new URL(res.body.url);
      expect(url.searchParams.get("error")).toBe("invalid_request");
      expect(url.searchParams.get("state")).toBe("state-abcdefgh");
      expect(url.searchParams.get("code")).toBeNull();
    });

    it("asks for what's missing first: the age check, the terms, a confirmed email", async () => {
      const { challenge } = pkce();
      expect((await authorize("brand-new", request(challenge)).expect(200)).body).toEqual({ kind: "step", step: "age_check" });

      await ready("unchecked", { ageConfirmedAt: null });
      expect((await authorize("unchecked", request(challenge)).expect(200)).body).toEqual({ kind: "step", step: "age_check" });

      await ready("no-terms", { legalAcceptances: [] });
      expect((await authorize("no-terms", request(challenge)).expect(200)).body).toEqual({ kind: "step", step: "terms" });

      await ready("unconfirmed", { emailVerifiedAt: null });
      expect((await authorize("unconfirmed", request(challenge), false).expect(200)).body).toEqual({ kind: "step", step: "email" });
    });

    it("doesn't need a Hood or address verification", async () => {
      await ready("no-hood", { isOnboarded: false, verificationStatus: "unverified" });
      await codeFor("no-hood");
    });

    it("cancelling goes back as access_denied, saying why", async () => {
      await ready("changed-mind");
      let url = new URL((await authorize("changed-mind", { ...request(pkce().challenge), decision: "cancel" }).expect(200)).body.url);
      expect([url.searchParams.get("error"), url.searchParams.get("error_description")]).toEqual(["access_denied", "cancelled"]);

      await ready("never-confirmed", { emailVerifiedAt: null });
      url = new URL((await authorize("never-confirmed", { ...request(pkce().challenge), decision: "cancel" }, false).expect(200)).body.url);
      expect(url.searchParams.get("error_description")).toBe("email_unverified");
    });

    it("refuses suspended and closed accounts back to the app, and offers reactivation to a deactivated one", async () => {
      const { challenge } = pkce();
      const refusal = async (uid: string) => new URL((await authorize(uid, request(challenge)).expect(200)).body.url).searchParams.get("error_description");

      await ready("suspended", { accountStatus: "suspended" });
      expect(await refusal("suspended")).toBe("account_suspended");

      await ready("child", { deactivatedAt: new Date(), deletionDueAt: new Date(), deactivation: { reason: "under_age", kind: "delete" } });
      expect(await refusal("child")).toBe("account_closed");

      await ready("on-a-break", { deactivatedAt: new Date(), deactivation: { reason: "break", kind: "deactivate" } });
      expect((await authorize("on-a-break", request(challenge)).expect(200)).body).toEqual({ kind: "step", step: "reactivate" });
    });
  });

  it("deleting an account removes its links to clients and unused codes", async () => {
    await ready("leaving");
    const { code, verifier } = await codeFor("leaving");
    await redeem({ code, code_verifier: verifier }, 200);
    await codeFor("leaving");
    const counts = await t.app.get(AccountLifecycle).purge("leaving", false);
    expect(counts).toMatchObject({ integrationLinks: 1, oauthCodes: 2 });
    expect(await t.model<IntegrationLink>(IntegrationLink.name).countDocuments({ uid: "leaving" })).toBe(0);
  });
});

describe("Signing in to myHoodoraAI, switched off", () => {
  let t: TestApp;
  beforeAll(async () => {
    delete process.env.AI_INTEGRATION_ENABLED;
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it("answers 404 everywhere, as if it didn't exist", async () => {
    await t.http.get("/.well-known/openid-configuration").expect(404);
    await t.http.get("/.well-known/jwks.json").expect(404);
    await t.http.post("/api/v1/oauth/token").type("form").send({ grant_type: "authorization_code" }).expect(404);
    await t.user("off");
    await t.http.post("/api/v1/oauth/authorize").set(t.auth("off", { emailVerified: true })).send({ client_id: "myhoodora-ai" }).expect(404);
  });
});
