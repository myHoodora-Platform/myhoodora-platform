import { hasAcceptedCurrentLegal, CURRENT_LEGAL } from "../users/domain/legal";
import { hashCode, isCodeChallenge, newAuthorizationCode, pairwiseSubject, pkceMatches } from "./domain/crypto";
import { oauthConfigFrom } from "./oauth.config";

const KEY = { kty: "EC", crv: "P-256", x: "x", y: "y", d: "d", kid: "k1" };
const ON = {
  AI_INTEGRATION_ENABLED: "true",
  OIDC_ISSUER: "https://api.myhoodora.com/",
  OIDC_SIGNING_KEYS: JSON.stringify({ keys: [KEY] }),
  OIDC_PAIRWISE_SECRET: "s".repeat(32),
  AI_CLIENT_REDIRECT_URIS: "https://studio.myhoodora.com/auth/myhoodora/callback",
  AI_CLIENT_JWKS_URL: "https://studio.myhoodora.com/.well-known/jwks.json",
  APP_URL: "https://www.myhoodora.com/",
  NODE_ENV: "production",
};

describe("oauthConfigFrom", () => {
  it("is off unless AI_INTEGRATION_ENABLED=true, and then checks nothing", () => {
    expect(oauthConfigFrom({}).enabled).toBe(false);
    expect(oauthConfigFrom({ AI_INTEGRATION_ENABLED: "yes", OIDC_SIGNING_KEYS: "not json" }).enabled).toBe(false);
  });

  it("derives the endpoints from the issuer and the web app's address", () => {
    const config = oauthConfigFrom(ON);
    expect(config).toMatchObject({
      enabled: true,
      issuer: "https://api.myhoodora.com",
      authorizationEndpoint: "https://www.myhoodora.com/oauth/authorize",
      tokenEndpoint: "https://api.myhoodora.com/api/v1/oauth/token",
      jwksUri: "https://api.myhoodora.com/.well-known/jwks.json",
    });
    expect(config.clients).toEqual([
      expect.objectContaining({ clientId: "myhoodora-ai", redirectUris: [ON.AI_CLIENT_REDIRECT_URIS], allowedAgeBands: ["adult"] }),
    ]);
  });

  it.each([
    ["no issuer", { OIDC_ISSUER: "" }, /OIDC_ISSUER/],
    ["an http issuer in production", { OIDC_ISSUER: "http://api.myhoodora.com" }, /OIDC_ISSUER/],
    ["a short pairwise secret", { OIDC_PAIRWISE_SECRET: "short" }, /OIDC_PAIRWISE_SECRET/],
    ["no redirect URIs", { AI_CLIENT_REDIRECT_URIS: "" }, /AI_CLIENT_REDIRECT_URIS/],
    ["no client keys", { AI_CLIENT_JWKS_URL: "" }, /AI_CLIENT_JWKS_URL/],
    ["a public key where a private one belongs", { OIDC_SIGNING_KEYS: JSON.stringify({ keys: [{ ...KEY, d: undefined }] }) }, /private EC P-256/],
    ["an RSA key", { OIDC_SIGNING_KEYS: JSON.stringify({ keys: [{ ...KEY, kty: "RSA" }] }) }, /private EC P-256/],
    ["two keys with one kid", { OIDC_SIGNING_KEYS: JSON.stringify({ keys: [KEY, KEY] }) }, /same kid/],
  ])("refuses to start with %s", (_label, patch, message) => {
    expect(() => oauthConfigFrom({ ...ON, ...patch })).toThrow(message);
  });

  it("never repeats a malformed key set in its error, which could hold a private key", () => {
    expect(() => oauthConfigFrom({ ...ON, OIDC_SIGNING_KEYS: '{"keys": [{"d": "SECRET-VALUE"' })).toThrow(/^OIDC_SIGNING_KEYS is not valid JSON$/);
  });
});

describe("pairwise subjects (contract §5.2)", () => {
  it("are stable per person and client, differ between clients, and don't reveal the uid", () => {
    const a = pairwiseSubject("secret", "myhoodora-ai", "uid-1");
    expect(a).toBe(pairwiseSubject("secret", "myhoodora-ai", "uid-1"));
    expect(a).toHaveLength(43);
    expect(a).not.toContain("uid-1");
    expect(pairwiseSubject("secret", "another-client", "uid-1")).not.toBe(a);
    expect(pairwiseSubject("secret", "myhoodora-ai", "uid-2")).not.toBe(a);
    expect(pairwiseSubject("other-secret", "myhoodora-ai", "uid-1")).not.toBe(a);
  });
});

describe("PKCE (RFC 7636)", () => {
  // RFC 7636 Appendix B.
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

  it("matches the RFC's example", () => {
    expect(isCodeChallenge(challenge)).toBe(true);
    expect(pkceMatches(verifier, challenge)).toBe(true);
  });

  it("refuses a wrong, short, long or malformed verifier", () => {
    expect(pkceMatches(verifier.replace(/.$/, "j"), challenge)).toBe(false);
    expect(pkceMatches("short", challenge)).toBe(false);
    expect(pkceMatches("a".repeat(129), challenge)).toBe(false);
    expect(pkceMatches(`${verifier}!`, challenge)).toBe(false);
    expect(pkceMatches(undefined, challenge)).toBe(false);
  });

  it("only accepts S256-shaped challenges", () => {
    expect(isCodeChallenge("plain-text-challenge")).toBe(false);
    expect(isCodeChallenge(`${challenge}=`)).toBe(false);
  });
});

describe("authorisation codes", () => {
  it("are 256 random bits, and only a hash is stored", () => {
    const code = newAuthorizationCode();
    expect(code).toHaveLength(43);
    expect(newAuthorizationCode()).not.toBe(code);
    expect(hashCode(code)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode(code)).not.toContain(code);
  });
});

describe("hasAcceptedCurrentLegal", () => {
  const record = (doc: string, version: string) => ({ doc, version });
  it("needs the current version of both documents, or newer", () => {
    expect(hasAcceptedCurrentLegal([record("terms", CURRENT_LEGAL.terms), record("privacy", CURRENT_LEGAL.privacy)])).toBe(true);
    expect(hasAcceptedCurrentLegal([record("terms", "2099-01-01"), record("privacy", "2099-01-01")])).toBe(true);
    expect(hasAcceptedCurrentLegal([record("terms", CURRENT_LEGAL.terms)])).toBe(false);
    expect(hasAcceptedCurrentLegal([record("terms", "2020-01-01"), record("privacy", CURRENT_LEGAL.privacy)])).toBe(false);
    expect(hasAcceptedCurrentLegal(undefined)).toBe(false);
  });
});
