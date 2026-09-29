import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { CommunicationsService } from "./communications.service";
import { LogEmailAdapter } from "./providers/log-email.adapter";
import { EMAIL_PROVIDER, type EmailProvider } from "./providers/providers";
import { ResendEmailAdapter } from "./providers/resend-email.adapter";
import { ResendWebhookController } from "./resend-webhook.controller";
import { Communication, CommunicationSchema } from "./schemas/communication.schema";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Communication.name, schema: CommunicationSchema }])],
  controllers: [ResendWebhookController],
  providers: [
    CommunicationsService,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EmailProvider => {
        const key = config.get<string>("mail.resendApiKey");
        const from = config.get<string>("mail.from")!;
        return key ? new ResendEmailAdapter(key, from, config.get<string>("mail.replyTo")) : new LogEmailAdapter();
      },
    },
  ],
  exports: [CommunicationsService, EMAIL_PROVIDER],
})
export class CommunicationsModule {}
