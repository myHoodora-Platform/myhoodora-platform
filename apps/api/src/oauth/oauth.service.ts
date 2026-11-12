import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Model } from "mongoose";
import { effectiveAccountStatus } from "../shared/authz/roles";
import type { Viewer } from "../shared/auth/viewer";
import { AccountLifecycle } from "../users/account-lifecycle";
import { hasAcceptedCurrentLegal } from "../users/domain/legal";
import { User } from "../users/schemas/user.schema";
import { ClientAuthError, ClientAuthService } from "./client-auth.service";
import { IntegrationEventsService } from "./integration-events.service";
import { OAuthKeysService } from "./oauth-keys.service";
import {
  hashCode,
  isCodeChallenge,
  newAuthorizationCode,
  pairwiseSubject,
  pkceMatches,
} from "./domain/crypto";
import type { AuthorizeDto } from "./oauth.dto";
import { OAUTH_CONFIG } from "./oauth.tokens";
import type { OAuthConfig } from "./oauth.config";
import { IntegrationLink, OAuthCode } from "./oauth.schemas";

const CODE_LIFETIME_MS = 60_000;
const ID_TOKEN_LIFETIME_S = 300;
export const CONTRACT_VERSION = "1";

/** What the web page does next (contract §4.1 step 4): go back to the client, or take the person through a step first. */
export type AuthorizeOutcome =
  | { kind: "redirect"; url: string }
  | { kind: "step"; step: "age_check" | "terms" | "email" | "reactivate" };

/** POST /oauth/token's answer (contract §4.3): a status and an OAuth-shaped body, never the platform's error shape. */
export interface TokenOutcome {
  status: number;
  body: Record<string, unknown>;
}

const tokenError = (
  status: number,
  error: string,
  description?: string,
): TokenOutcome => ({
  status,
  body: { error, ...(description && { error_description: description }) },
});

/** `state` and `nonce`: opaque values the client chose, printable and bounded. */
const OPAQUE = /^[\x21-\x7e]{8,500}$/;

/**
 * myHoodora as the sign-in for myHoodoraAI (docs/integrations/myhoodora-ai.md §4–5): the
 * authorisation code flow with PKCE, for one confidential client. Off unless AI_INTEGRATION_ENABLED.
 */
@Injectable()
export class OAuthService implements OnModuleInit {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @Inject(OAUTH_CONFIG) private readonly config: OAuthConfig,
    @InjectModel(OAuthCode.name) private readonly codes: Model<OAuthCode>,
    @InjectModel(IntegrationLink.name)
    private readonly links: Model<IntegrationLink>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly clientAuth: ClientAuthService,
    private readonly keys: OAuthKeysService,
    private readonly lifecycle: AccountLifecycle,
    private readonly events: IntegrationEventsService,
  ) {}

  onModuleInit(): void {
    // Deleting an account removes its links to clients and any code not yet used.
    this.lifecycle.register({
      name: "oauth",
      purge: async (uid, dryRun) => {
        if (dryRun) {
          const [links, codes] = await Promise.all([
            this.links.countDocuments({ uid }),
            this.codes.countDocuments({ uid }),
          ]);
          return { integrationLinks: links, oauthCodes: codes };
        }
        // Tell each app first (contract §8.3): once the links are gone, nothing knows their subject.
        const linked = await this.links
          .find({ uid })
          .select({ clientId: 1, sub: 1 })
          .lean<Pick<IntegrationLink, "clientId" | "sub">[]>()
          .exec();
        await this.events.accountDeleted(uid, linked);
        const [links, codes] = await Promise.all([
          this.links.deleteMany({ uid }),
          this.codes.deleteMany({ uid }),
        ]);
        return {
          integrationLinks: links.deletedCount,
          oauthCodes: codes.deletedCount,
        };
      },
    });
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  /** GET /.well-known/openid-configuration. */
  discovery(): Record<string, unknown> {
    this.ensureEnabled();
    return {
      issuer: this.config.issuer,
      authorization_endpoint: this.config.authorizationEndpoint,
      token_endpoint: this.config.tokenEndpoint,
      jwks_uri: this.config.jwksUri,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code"],
      subject_types_supported: ["pairwise"],
      id_token_signing_alg_values_supported: ["ES256"],
      token_endpoint_auth_methods_supported: ["private_key_jwt"],
      token_endpoint_auth_signing_alg_values_supported: ["ES256"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "email", "profile"],
      claims_supported: [
        "iss",
        "aud",
        "sub",
        "iat",
        "exp",
        "auth_time",
        "nonce",
        "email",
        "email_verified",
        "name",
        "hm_status",
        "hm_age_band",
        "hm_age_assurance",
        "hm_contract",
      ],
    };
  }

  /**
   * POST /oauth/authorize (contract §4.1–4.2, §4.4). The client and redirect URI are checked first: if
   * either is wrong the answer is a 400 and nobody is redirected anywhere. After that, every refusal goes
   * back to the client as an OAuth error, and anything the person can fix themselves is a step.
   */
  async authorize(
    viewer: Viewer,
    token: DecodedIdToken,
    dto: AuthorizeDto,
  ): Promise<AuthorizeOutcome> {
    this.ensureEnabled();
    const client = this.clientAuth.client(dto.client_id);
    if (!client)
      throw new BadRequestException(
        "This sign-in link isn't valid: the app isn't known to myHoodora.",
      );
    const redirectUri = dto.redirect_uri;
    if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
      throw new BadRequestException(
        "This sign-in link isn't valid: it doesn't return to a known address.",
      );
    }
    const state = dto.state && OPAQUE.test(dto.state) ? dto.state : undefined;
    const back = (params: Record<string, string>): AuthorizeOutcome => {
      const url = new URL(redirectUri);
      for (const [key, value] of Object.entries({
        ...params,
        ...(state && { state }),
      }))
        url.searchParams.set(key, value);
      return { kind: "redirect", url: url.toString() };
    };
    const refuse = (description: string) =>
      back({ error: "access_denied", error_description: description });

    const scopes = (dto.scope ?? "").split(" ").filter(Boolean);
    if (
      dto.response_type !== "code" ||
      !scopes.includes("openid") ||
      !state ||
      !dto.nonce ||
      !OPAQUE.test(dto.nonce) ||
      dto.code_challenge_method !== "S256" ||
      !isCodeChallenge(dto.code_challenge)
    ) {
      return back({
        error: "invalid_request",
        error_description:
          "The request is missing or has an invalid parameter.",
      });
    }

    if (dto.decision === "cancel")
      return refuse(viewer.emailVerified ? "cancelled" : "email_unverified");

    const user = await this.users
      .findOne({ uid: viewer.uid })
      .lean<User>()
      .exec();
    // No record yet: the age check comes first, and creates it.
    if (!user) return { kind: "step", step: "age_check" };
    const now = Date.now();
    if (
      user.purgedAt ||
      user.deactivation?.reason === "under_age" ||
      (user.deletionDueAt && user.deletionDueAt.getTime() <= now)
    ) {
      return refuse("account_closed");
    }
    if (effectiveAccountStatus(user) === "suspended")
      return refuse("account_suspended");
    // Closed by its owner (deactivated, or deleting within the grace period): myHoodora offers to reopen it first.
    if (user.deactivatedAt) return { kind: "step", step: "reactivate" };
    // The age check itself, whatever AGE_CHECK_REQUIRED says: the token states that they are an adult.
    if (!user.ageConfirmedAt) return { kind: "step", step: "age_check" };
    if (!hasAcceptedCurrentLegal(user.legalAcceptances))
      return { kind: "step", step: "terms" };
    if (!viewer.emailVerified) return { kind: "step", step: "email" };
    if (!client.allowedAgeBands.includes("adult"))
      return refuse("not_eligible");

    const code = newAuthorizationCode();
    await this.codes.create({
      codeHash: hashCode(code),
      clientId: client.clientId,
      redirectUri,
      uid: viewer.uid,
      nonce: dto.nonce,
      codeChallenge: dto.code_challenge,
      authTime: new Date(token.auth_time * 1000),
      expiresAt: new Date(now + CODE_LIFETIME_MS),
    });
    this.logger.log(`Authorisation code issued for ${client.clientId}`);
    return back({ code });
  }

  /** POST /oauth/token (contract §4.3): redeems a code for an ID token. Never throws for a bad request. */
  async token(form: Record<string, unknown>): Promise<TokenOutcome> {
    this.ensureEnabled();
    if (form.grant_type !== "authorization_code")
      return tokenError(400, "unsupported_grant_type");

    let clientId: string;
    try {
      clientId = (
        await this.clientAuth.authenticate(
          {
            clientId: form.client_id,
            assertionType: form.client_assertion_type,
            assertion: form.client_assertion,
          },
          this.config.tokenEndpoint,
        )
      ).clientId;
    } catch (err) {
      if (!(err instanceof ClientAuthError)) throw err;
      this.logger.warn(`Client authentication failed: ${err.message}`);
      return err.reason === "unavailable"
        ? tokenError(
            503,
            "temporarily_unavailable",
            "The client's keys could not be fetched.",
          )
        : tokenError(401, "invalid_client");
    }
    if (
      typeof form.code !== "string" ||
      !form.code ||
      typeof form.redirect_uri !== "string"
    )
      return tokenError(400, "invalid_request");

    // Spent by its first redemption, whatever happens next (contract §4.3).
    const now = new Date();
    const record = await this.codes
      .findOneAndUpdate(
        { codeHash: hashCode(form.code), usedAt: null },
        { $set: { usedAt: now } },
      )
      .lean<OAuthCode>()
      .exec();
    if (
      !record ||
      record.expiresAt.getTime() <= now.getTime() ||
      record.clientId !== clientId ||
      record.redirectUri !== form.redirect_uri ||
      !pkceMatches(form.code_verifier, record.codeChallenge)
    ) {
      this.logger.warn(`Code refused for ${clientId}`);
      return tokenError(400, "invalid_grant");
    }

    // The account may have changed in the seconds since the code was issued.
    const user = await this.users
      .findOne({ uid: record.uid })
      .lean<User>()
      .exec();
    if (
      !user ||
      user.purgedAt ||
      user.deactivatedAt ||
      !user.ageConfirmedAt ||
      effectiveAccountStatus(user) === "suspended" ||
      (user.sessionsRevokedAt &&
        record.authTime.getTime() < user.sessionsRevokedAt.getTime())
    ) {
      return tokenError(400, "invalid_grant");
    }

    const sub = pairwiseSubject(
      this.config.pairwiseSecret,
      clientId,
      record.uid,
    );
    await this.links
      .updateOne(
        { clientId, uid: record.uid },
        { $set: { sub, lastAt: now }, $setOnInsert: { firstAt: now } },
        { upsert: true },
      )
      .exec();

    const iat = Math.floor(now.getTime() / 1000);
    const idToken = await this.keys.sign({
      iss: this.config.issuer,
      aud: clientId,
      sub,
      iat,
      exp: iat + ID_TOKEN_LIFETIME_S,
      auth_time: Math.floor(record.authTime.getTime() / 1000),
      nonce: record.nonce,
      email: user.email,
      email_verified: true,
      ...(user.displayName && { name: user.displayName }),
      hm_status:
        effectiveAccountStatus(user) === "restricted" ? "restricted" : "active",
      hm_age_band: "adult",
      hm_age_assurance: user.ageAssurance ?? "self_declared_dob",
      hm_contract: CONTRACT_VERSION,
    });
    this.logger.log(`ID token issued for ${clientId}`);
    return {
      status: 200,
      body: {
        id_token: idToken,
        token_type: "Bearer",
        expires_in: ID_TOKEN_LIFETIME_S,
      },
    };
  }

  private ensureEnabled(): void {
    if (!this.config.enabled) throw new NotFoundException();
  }
}
