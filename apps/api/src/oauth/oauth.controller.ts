import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExcludeController,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { CurrentUser } from "../shared/auth/current-user.decorator";
import { Public } from "../shared/auth/public.decorator";
import {
  AllowSuspended,
  CurrentViewer,
  type Viewer,
} from "../shared/auth/viewer";
import { AuthorizeDto } from "./oauth.dto";
import { OAuthKeysService } from "./oauth-keys.service";
import { OAuthService } from "./oauth.service";

/**
 * Discovery and keys (contract §2), served at the host's root, outside /api: that is where OpenID
 * Connect clients look for them, relative to the issuer. 404 while AI_INTEGRATION_ENABLED is off.
 */
@ApiExcludeController()
@Public()
@Controller({ path: ".well-known", version: VERSION_NEUTRAL })
export class WellKnownController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly keys: OAuthKeysService,
  ) {}

  @Get("openid-configuration")
  @Header("Cache-Control", "public, max-age=3600")
  discovery() {
    return this.oauth.discovery();
  }

  @Get("jwks.json")
  // An hour, as the contract allows clients to cache it; rotations keep the old key published for longer.
  @Header("Cache-Control", "public, max-age=3600")
  jwks() {
    return this.keys.publicJwks();
  }
}

/** Signing in to myHoodoraAI with a myHoodora account (docs/integrations/myhoodora-ai.md §4). */
@ApiTags("oauth")
@Controller("oauth")
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Post("authorize")
  @HttpCode(200)
  // Suspended and closed accounts get a proper answer (an error back to the app, or "reactivate first").
  @AllowSuspended()
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiBearerAuth("firebase-jwt")
  @ApiOperation({
    summary:
      "The web page's half of signing in to myHoodoraAI: issue a code, or say what's needed first",
    description:
      "Called by www's /oauth/authorize page with the signed-in person's Firebase ID token and the request's parameters. " +
      "400 when the client or redirect URI isn't registered: the page shows an error and redirects nowhere. Otherwise " +
      "`{ kind: 'redirect', url }` (a code, or an OAuth error, for the app) or `{ kind: 'step', step }` with " +
      "`age_check`, `terms`, `email` or `reactivate`: take the person through that, then call again. 404 while the integration is off.",
  })
  authorize(
    @CurrentViewer() viewer: Viewer,
    @CurrentUser() token: DecodedIdToken,
    @Body() body: AuthorizeDto,
  ) {
    return this.oauth.authorize(viewer, token, body);
  }

  @Post("token")
  @Public()
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "Redeem an authorisation code for an ID token (form-encoded; client authenticated with private_key_jwt)",
    description:
      "Answers in OAuth's shape (RFC 6749 §5): `{ id_token, token_type, expires_in }`, or `{ error, error_description }` with 400, 401 or 503.",
  })
  async token(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const { status, body: answer } = await this.oauth.token(body ?? {});
    // RFC 6749 §5.1: token responses are never cached.
    res
      .status(status)
      .set({ "Cache-Control": "no-store", Pragma: "no-cache" })
      .json(answer);
  }
}
