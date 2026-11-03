import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ExpoPushAdapter } from "../communications/providers/expo-push.adapter";
import { LogPushAdapter } from "../communications/providers/log-push.adapter";
import { PUSH_PROVIDER, type PushProvider } from "../communications/providers/providers";
import { PushDevice, PushDeviceSchema } from "./push-device.schema";
import { PushController } from "./push.controller";
import { PushService } from "./push.service";

/** Picks the push adapter from PUSH_PROVIDER. Another vendor (FCM directly) is one adapter and one case here. */
export function createPushProvider(config: ConfigService, logger = new Logger("Push")): PushProvider {
  const provider = config.get<string>("push.provider") ?? "expo";
  switch (provider) {
    case "expo":
      logger.log("Push: expo");
      return new ExpoPushAdapter(config.get<string>("push.expoAccessToken"));
    case "log":
      return new LogPushAdapter();
    default:
      throw new Error(`PUSH_PROVIDER "${provider}" has no adapter. Use "expo" or "log", or add one in src/communications/providers/.`);
  }
}

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: PushDevice.name, schema: PushDeviceSchema }])],
  controllers: [PushController],
  providers: [PushService, { provide: PUSH_PROVIDER, inject: [ConfigService], useFactory: (config: ConfigService) => createPushProvider(config) }],
  exports: [PushService, PUSH_PROVIDER],
})
export class PushModule {}
