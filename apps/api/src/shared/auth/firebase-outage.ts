/**
 * Did token verification fail because Google's signing keys couldn't be fetched, rather than
 * because of the token itself?
 *
 * The distinction matters because the two get opposite answers: a bad token is 401 (the web app
 * then signs the person out), an outage is 503 (it retries and leaves them signed in).
 *
 * firebase-admin 13 reports both with the same code, auth/argument-error
 * (FirebaseTokenVerifier.mapJwtErrorToAuthError in lib/auth/token-verifier.js). Only the message
 * tells them apart (lib/utils/jwt.js):
 * - "Error fetching public keys for Google certs: …": Google answered with an HTTP error;
 * - "Error while making request: …": a network error or timeout.
 *
 * Matching on a message is fragile, so firebase-outage.spec.ts runs the real SDK with its network
 * blocked: an upgrade that rewords these fails that test instead of quietly turning outages back
 * into sign-outs.
 */
export function isKeyFetchFailure(err: unknown): boolean {
  const { code, message } = (err ?? {}) as { code?: unknown; message?: unknown };
  return code === "auth/argument-error" && typeof message === "string" && /^Error (fetching (public keys|Json Web Keys)|while making request)/.test(message);
}
