import { Controller, Get, Headers, Inject, Param, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { decodeJwt } from "jose";
import { Model } from "mongoose";
import { Public } from "../shared/auth/public.decorator";
import { User } from "../users/schemas/user.schema";
import {
  CLIENT_ASSERTION_TYPE,
  ClientAuthError,
  ClientAuthService,
} from "./client-auth.service";
import { subjectSnapshot } from "./domain/subject";
import type { OAuthConfig } from "./oauth.config";
import { IntegrationLink } from "./oauth.schemas";
import { OAUTH_CONFIG } from "./oauth.tokens";

/**
 * The Integration API (docs/integrations/myhoodora-ai.md §7), for myHoodora AI's server. Authenticated
 * with a client assertion whose audience is this API's base (contract §6); never a person's token.
 * Errors: `{ statusCode, message, code }`. 404 while AI_INTEGRATION_ENABLED is off.
 */
@ApiExcludeController()
@Public()
@Controller("integrations/ai")
export class IntegrationsController {
  constructor(
    @Inject(OAUTH_CONFIG) private readonly config: OAuthConfig,
    private readonly clientAuth: ClientAuthService,
    @InjectModel(IntegrationLink.name)
    private readonly links: Model<IntegrationLink>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  /** §7.1: an account's current state, the safety net for missed events. */
  @Get("subjects/:sub")
  @Throttle({ medium: { limit: 600, ttl: 60_000 } })
  async subject(
    @Param("sub") sub: string,
    @Headers("authorization") authorization: string | undefined,
    @Res() res: Response,
  ) {
    const fail = (statusCode: number, code: string, message: string) =>
      res.status(statusCode).json({ statusCode, message, code });
    if (!this.config.enabled) return fail(404, "not_found", "Not found.");

    const clientId = await this.authenticate(authorization);
    if (clientId === "unavailable")
      return fail(
        503,
        "temporarily_unavailable",
        "The client's keys could not be fetched.",
      );
    if (!clientId)
      return fail(401, "invalid_client", "Client authentication failed.");

    const link = await this.links
      .findOne({ clientId, sub })
      .lean<IntegrationLink>()
      .exec();
    const user =
      link && (await this.users.findOne({ uid: link.uid }).lean<User>().exec());
    if (!link || !user)
      return fail(
        404,
        "unknown_subject",
        "No one has signed in to this app with that subject.",
      );
    return res
      .status(200)
      .set("Cache-Control", "no-store")
      .json(subjectSnapshot(user, link.sub));
  }

  /** The client the Bearer assertion proves, null when it doesn't, or "unavailable" when its keys can't be fetched. */
  private async authenticate(
    authorization: string | undefined,
  ): Promise<string | null | "unavailable"> {
    const assertion = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    let clientId: unknown;
    try {
      // Only to know whose keys to check it with: authenticate() verifies everything, `iss` included.
      clientId = decodeJwt(assertion).iss;
    } catch {
      return null;
    }
    try {
      return (
        await this.clientAuth.authenticate(
          { clientId, assertionType: CLIENT_ASSERTION_TYPE, assertion },
          this.config.integrationApi,
        )
      ).clientId;
    } catch (err) {
      if (err instanceof ClientAuthError)
        return err.reason === "unavailable" ? "unavailable" : null;
      throw err;
    }
  }
}
