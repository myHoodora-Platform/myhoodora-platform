import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppVersionWatcherService, STORE_VERSION_SOURCES } from "./app-version-watcher.service";
import { MongooseModule } from "@nestjs/mongoose";
import { PlatformController } from "./platform.controller";
import { PlatformSettings, PlatformSettingsSchema } from "./platform-settings.schema";
import { PlatformSettingsService } from "./platform-settings.service";
import { AppleStoreLookup, GooglePlayLookup, parseServiceAccount, type StoreVersionSource } from "./store-versions";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: PlatformSettings.name, schema: PlatformSettingsSchema }])],
  controllers: [PlatformController],
  providers: [
    PlatformSettingsService,
    AppVersionWatcherService,
    {
      provide: STORE_VERSION_SOURCES,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StoreVersionSource[] => [
        new GooglePlayLookup(config.get<string>("appUpdates.androidPackage")!, parseServiceAccount(config.get<string>("appUpdates.googlePlayServiceAccount"))),
        new AppleStoreLookup(config.get<string>("appUpdates.iosBundleId")!, config.get<string>("appUpdates.iosCountry")!),
      ],
    },
  ],
  exports: [PlatformSettingsService, AppVersionWatcherService],
})
export class PlatformModule {}
