import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { Model } from "mongoose";
import { OAUTH_CONFIG } from "./oauth.tokens";
import type { OAuthClient, OAuthConfig } from "./oauth.config";
import { UsedClientAssertion } from "./oauth.schemas";

export const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
/** Contract §6: an assertion lives at most a minute. */
const MAX_ASSERTION_LIFETIME_S = 60;
const CLOCK_SKEW_S = 60;

/** Why a client couldn't be authenticated. `unavailable`: its keys couldn't be fetched, which says nothing about the client. */
export type ClientAuthFailure = "invalid_client" | "unavailable";
export class ClientAuthError extends Error {
  constructor(
    readonly reason: ClientAuthFailure,
    why: string,
  ) {
    super(why);
  }
}

/**
 * Checks a client assertion (contract §6, RFC 7523 / OIDC private_key_jwt): signed with one of the
 * client's published ES256 keys, issued by and about the client, for this exact audience, short-lived,
 * and never seen before (its `jti` is recorded until it would have expired).
 */
@Injectable()
export class ClientAuthService {
  private readonly logger = new Logger(ClientAuthService.name);
  private readonly keySets = new Map<string, JWTVerifyGetKey>();

  constructor(
    @Inject(OAUTH_CONFIG) private readonly config: OAuthConfig,
    @InjectModel(UsedClientAssertion.name)
    private readonly used: Model<UsedClientAssertion>,
  ) {}

  client(clientId: unknown): OAuthClient | undefined {
    return typeof clientId === "string"
      ? this.config.clients.find((c) => c.clientId === clientId)
      : undefined;
  }

  /** Returns the authenticated client, or throws ClientAuthError. `audience`: the exact URL being called. */
  async authenticate(
    input: { clientId?: unknown; assertionType?: unknown; assertion?: unknown },
    audience: string,
  ): Promise<OAuthClient> {
    const client = this.client(input.clientId);
    if (!client) throw new ClientAuthError("invalid_client", "unknown client");
    if (
      input.assertionType !== CLIENT_ASSERTION_TYPE ||
      typeof input.assertion !== "string" ||
      !input.assertion
    ) {
      throw new ClientAuthError("invalid_client", "no client assertion");
    }

    let payload: { iat?: number; exp?: number; jti?: unknown };
    try {
      ({ payload } = await jwtVerify(input.assertion, this.keySet(client), {
        algorithms: ["ES256"],
        issuer: client.clientId,
        subject: client.clientId,
        audience,
        clockTolerance: CLOCK_SKEW_S,
        requiredClaims: ["iat", "exp", "jti"],
      }));
    } catch (err) {
      // Couldn't fetch the keys: a timeout, a network error (not a jose error at all), or a bad answer
      // from the key URL (jose's generic error). None of these says the assertion is wrong.
      if (
        err instanceof errors.JWKSTimeout ||
        !(err instanceof errors.JOSEError) ||
        err.code === "ERR_JOSE_GENERIC"
      ) {
        throw new ClientAuthError(
          "unavailable",
          "client keys could not be fetched",
        );
      }
      // The error code only: never the assertion.
      throw new ClientAuthError(
        "invalid_client",
        (err as { code?: string }).code ?? "invalid assertion",
      );
    }

    const { iat, exp, jti } = payload;
    if (
      typeof jti !== "string" ||
      jti.length > 200 ||
      typeof iat !== "number" ||
      typeof exp !== "number"
    ) {
      throw new ClientAuthError("invalid_client", "malformed assertion");
    }
    if (exp - iat > MAX_ASSERTION_LIFETIME_S)
      throw new ClientAuthError("invalid_client", "assertion lives too long");

    // Once only, across every API instance: the unique index decides.
    try {
      await this.used.create({
        clientId: client.clientId,
        jti,
        expiresAt: new Date((exp + CLOCK_SKEW_S) * 1000),
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000)
        throw new ClientAuthError("invalid_client", "assertion replayed");
      throw err;
    }
    return client;
  }

  private keySet(client: OAuthClient): JWTVerifyGetKey {
    let set = this.keySets.get(client.clientId);
    if (!set) {
      set = client.jwks
        ? createLocalJWKSet(client.jwks)
        : // Cached for an hour; an unknown `kid` refetches at most once a minute (contract §6).
          createRemoteJWKSet(new URL(client.jwksUrl!), {
            cacheMaxAge: 60 * 60_000,
            cooldownDuration: 60_000,
            timeoutDuration: 5_000,
          });
      this.keySets.set(client.clientId, set);
      this.logger.log(
        `Client keys for ${client.clientId} from ${client.jwks ? "configuration" : client.jwksUrl}`,
      );
    }
    return set;
  }
}
