import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PlatformController } from "./platform.controller";
import { PlatformSettings, PlatformSettingsSchema } from "./platform-settings.schema";
import { PlatformSettingsService } from "./platform-settings.service";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: PlatformSettings.name, schema: PlatformSettingsSchema }])],
  controllers: [PlatformController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformModule {}
