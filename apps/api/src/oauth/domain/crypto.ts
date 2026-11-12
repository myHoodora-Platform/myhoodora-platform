import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The `sub` a client sees for a person (contract §5.2): stable for that person and that client,
 * different for every other client, and useless for finding their Firebase uid.
 */
export function pairwiseSubject(secret: string, clientId: string, uid: string): string {
  return createHmac("sha256", secret).update(`${clientId}:${uid}`).digest("base64url");
}

/** RFC 7636 §4.1: 43 to 128 characters from the unreserved set. */
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
/** BASE64URL(SHA-256(verifier)): always 43 characters. */
const CHALLENGE = /^[A-Za-z0-9\-_]{43}$/;

export function isCodeChallenge(value: unknown): value is string {
  return typeof value === "string" && CHALLENGE.test(value);
}

/** PKCE S256 (RFC 7636 §4.6), compared in constant time. */
export function pkceMatches(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== "string" || !VERIFIER.test(verifier)) return false;
  const expected = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const given = Buffer.from(challenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** A single-use authorisation code: 256 random bits. Only its hash is stored. */
export function newAuthorizationCode(): string {
  return randomBytes(32).toString("base64url");
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
