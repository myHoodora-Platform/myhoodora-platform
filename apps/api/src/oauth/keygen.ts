/**
 * Prints a new ES256 signing key for OIDC_SIGNING_KEYS (docs/integrations/myhoodora-ai.md §12), a
 * pairwise secret, and a secret for signing account events. Run: pnpm --filter @myhoodora/api oidc:keygen
 *
 * To rotate: put the new key FIRST in the set (it signs from then on) and keep the old one after it
 * (still published, so tokens it signed in the last few minutes still verify); remove it a day later.
 * Never rotate OIDC_PAIRWISE_SECRET: it would change every person's `sub` at every client.
 */
import { randomBytes } from "node:crypto";
import { exportJWK, generateKeyPair } from "jose";

async function main() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = await exportJWK(privateKey);
  const kid = `myhoodora-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString("hex")}`;
  console.log(
    "OIDC_SIGNING_KEYS (a secret: paste into the API host's environment, never commit it):",
  );
  console.log(
    JSON.stringify({ keys: [{ ...jwk, kid, alg: "ES256", use: "sig" }] }),
  );
  console.log(
    "\nOIDC_PAIRWISE_SECRET (set once per environment, never change it):",
  );
  console.log(randomBytes(32).toString("base64url"));
  console.log(
    "\nAI_EVENTS_SECRET (a secret: the same value goes in myHoodora AI's MYHOODORA_EVENTS_SECRET):",
  );
  console.log(`whsec_${randomBytes(32).toString("base64")}`);
}

void main();
