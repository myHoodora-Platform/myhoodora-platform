import type { JWK } from "jose";

/**
 * Signing in to myHoodoraAI with a myHoodora account (docs/integrations/myhoodora-ai.md).
 * Everything comes from the environment; nothing here is a secret's value.
 */

/** The one client in v1 (contract §3). */
export const AI_CLIENT_ID = "myhoodora-ai";

export type AgeBand = "adult";

export interface OAuthClient {
  clientId: string;
  /** Exact strings: no wildcards, no prefix matching (contract §4.1). */
  redirectUris: string[];
  /** Where the client's public keys are published (contract §6)… */
  jwksUrl?: string;
  /** …or the keys themselves, for local runs and tests. */
  jwks?: { keys: JWK[] };
  allowedAgeBands: AgeBand[];
}

export interface OAuthConfig {
  /** AI_INTEGRATION_ENABLED=true. Off: every route here answers 404, as if it didn't exist. */
  enabled: boolean;
  /** "https://api.myhoodora.com" (no trailing slash). */
  issuer: string;
  /** The web page that asks the signed-in person (contract §2). */
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  /** Private ES256 keys; the first one signs, all are published (public halves only). */
  signingKeys: (JWK & { kid: string; d: string })[];
  /** For pairwise subjects (contract §5.2). Changing it changes every `sub`. */
  pairwiseSecret: string;
  clients: OAuthClient[];
}

const MIN_PAIRWISE_SECRET_LENGTH = 32;

function trimSlash(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function parseJson(name: string, value: string | undefined): unknown {
  if (!value?.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    // Never echo the value: it may hold private keys.
    throw new Error(`${name} is not valid JSON`);
  }
}

/** The signing keys: a JWK set of private EC P-256 keys, each with a `kid`. */
function signingKeysFrom(value: string | undefined): (JWK & { kid: string; d: string })[] {
  const parsed = parseJson("OIDC_SIGNING_KEYS", value) as { keys?: unknown } | undefined;
  const keys = Array.isArray(parsed?.keys) ? (parsed.keys as JWK[]) : [];
  for (const key of keys) {
    if (key.kty !== "EC" || key.crv !== "P-256" || typeof key.d !== "string" || typeof key.kid !== "string" || !key.kid) {
      throw new Error('OIDC_SIGNING_KEYS must be a JWK set of private EC P-256 keys, each with a "kid" (pnpm --filter @myhoodora/api oidc:keygen)');
    }
  }
  const kids = keys.map((k) => k.kid);
  if (new Set(kids).size !== kids.length) throw new Error("OIDC_SIGNING_KEYS has two keys with the same kid");
  return keys as (JWK & { kid: string; d: string })[];
}

function isUrl(value: string, requireHttps: boolean): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (!requireHttps && url.protocol === "http:");
  } catch {
    return false;
  }
}

/**
 * Reads the configuration. With the integration on, anything missing or malformed throws, so the API
 * refuses to start rather than run a half-configured identity provider. Off, nothing is checked.
 */
export function oauthConfigFrom(env: Record<string, string | undefined>): OAuthConfig {
  const enabled = env.AI_INTEGRATION_ENABLED?.trim().toLowerCase() === "true";
  const production = env.NODE_ENV === "production";
  const issuer = trimSlash(env.OIDC_ISSUER ?? "");
  const appUrl = trimSlash(env.APP_URL ?? "http://localhost:3000");
  const redirectUris = (env.AI_CLIENT_REDIRECT_URIS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const jwksUrl = env.AI_CLIENT_JWKS_URL?.trim() || undefined;
  const jwks = parseJson("AI_CLIENT_JWKS", env.AI_CLIENT_JWKS) as { keys: JWK[] } | undefined;

  const config: OAuthConfig = {
    enabled,
    issuer,
    authorizationEndpoint: `${appUrl}/oauth/authorize`,
    tokenEndpoint: `${issuer}/api/v1/oauth/token`,
    jwksUri: `${issuer}/.well-known/jwks.json`,
    signingKeys: enabled ? signingKeysFrom(env.OIDC_SIGNING_KEYS) : [],
    pairwiseSecret: env.OIDC_PAIRWISE_SECRET ?? "",
    clients: [{ clientId: AI_CLIENT_ID, redirectUris, jwksUrl, jwks, allowedAgeBands: ["adult"] }],
  };
  if (!enabled) return config;

  const problems: string[] = [];
  if (!isUrl(issuer, production)) problems.push(`OIDC_ISSUER must be an ${production ? "https " : ""}URL`);
  if (config.signingKeys.length === 0) problems.push("OIDC_SIGNING_KEYS has no keys");
  if (config.pairwiseSecret.length < MIN_PAIRWISE_SECRET_LENGTH) problems.push(`OIDC_PAIRWISE_SECRET must be at least ${MIN_PAIRWISE_SECRET_LENGTH} characters`);
  if (redirectUris.length === 0) problems.push("AI_CLIENT_REDIRECT_URIS is empty");
  for (const uri of redirectUris) if (!isUrl(uri, production)) problems.push(`AI_CLIENT_REDIRECT_URIS has an invalid${production ? " (non-https)" : ""} URL`);
  if (!jwksUrl && !jwks) problems.push("AI_CLIENT_JWKS_URL (or AI_CLIENT_JWKS) is required");
  if (jwksUrl && !isUrl(jwksUrl, production)) problems.push("AI_CLIENT_JWKS_URL must be an https URL");
  if (jwks && !Array.isArray(jwks.keys)) problems.push('AI_CLIENT_JWKS must be a JWK set ({"keys": […]})');
  if (problems.length) throw new Error(`AI_INTEGRATION_ENABLED is on, but: ${problems.join("; ")}`);
  return config;
}
