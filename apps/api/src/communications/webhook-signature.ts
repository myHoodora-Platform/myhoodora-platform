import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies Resend webhooks, which are signed with the Standard Webhooks /
 * Svix scheme (https://www.standardwebhooks.com, Resend docs "Verify
 * webhooks"). Implemented with node:crypto so it works in CommonJS on
 * Node 20 (the svix package is ESM-only).
 *
 *   signed content = `${svix-id}.${svix-timestamp}.${rawBody}`
 *   signature      = base64(HMAC-SHA256(base64decode(secret without "whsec_"), signed content))
 *   header         = "v1,<sig> v1,<sig2>"   (any match is valid; supports key rotation)
 */
const TOLERANCE_SECONDS = 5 * 60;

export class WebhookSignatureError extends Error {}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  headers: { id: string; timestamp: string; signature: string },
  now: number = Date.now(),
): void {
  if (!headers.id || !headers.timestamp || !headers.signature) throw new WebhookSignatureError("missing headers");
  const ts = Number(headers.timestamp);
  if (!Number.isInteger(ts)) throw new WebhookSignatureError("bad timestamp");
  // Replay protection: reject messages outside the tolerance window.
  if (Math.abs(now / 1000 - ts) > TOLERANCE_SECONDS) throw new WebhookSignatureError("timestamp outside tolerance");

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest();

  const ok = headers.signature
    .split(" ")
    .map((part) => part.split(","))
    .some(([version, sig]) => {
      if (version !== "v1" || !sig) return false;
      const given = Buffer.from(sig, "base64");
      return given.length === expected.length && timingSafeEqual(given, expected);
    });
  if (!ok) throw new WebhookSignatureError("no matching signature");
}

/** Test/dev helper: produce a valid signature header. */
export function signWebhook(secret: string, id: string, timestamp: number, rawBody: string): string {
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64")}`;
}
