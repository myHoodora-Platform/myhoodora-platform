import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { AiOperatorService } from "./ai-operator.service";
import { ClientAuthService } from "./client-auth.service";
import { oauthConfigFrom } from "./oauth.config";
import { IntegrationEventsService } from "./integration-events.service";
import { IntegrationsController } from "./integrations.controller";
import { OAuthController, WellKnownController } from "./oauth.controller";
import { OAuthKeysService } from "./oauth-keys.service";
import {
  IntegrationLink,
  IntegrationLinkSchema,
  OAuthCode,
  OAuthCodeSchema,
  UsedClientAssertion,
  UsedClientAssertionSchema,
} from "./oauth.schemas";
import { OAuthService } from "./oauth.service";
import { OAUTH_CONFIG } from "./oauth.tokens";

/**
 * myHoodora as the sign-in for myHoodoraAI (docs/integrations/myhoodora-ai.md). Off unless AI_INTEGRATION_ENABLED=true.
 * Global, so the modules where accounts change can tell IntegrationEventsService without importing this one.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OAuthCode.name, schema: OAuthCodeSchema },
      { name: UsedClientAssertion.name, schema: UsedClientAssertionSchema },
      { name: IntegrationLink.name, schema: IntegrationLinkSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [WellKnownController, OAuthController, IntegrationsController],
  // Read once at start-up; with the integration on, a bad setting stops the API here (oauth.config.ts).
  providers: [
    { provide: OAUTH_CONFIG, useFactory: () => oauthConfigFrom(process.env) },
    OAuthKeysService,
    ClientAuthService,
    OAuthService,
    IntegrationEventsService,
    AiOperatorService,
  ],
  exports: [OAuthService, IntegrationEventsService, AiOperatorService],
})
export class OAuthModule {}
