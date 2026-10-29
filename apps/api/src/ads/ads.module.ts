import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { ListingsModule } from "../listings/listings.module";
import { PostsModule } from "../posts/posts.module";
import { StorageModule } from "../storage/storage.module";
import { AdFeedService } from "./ad-feed.service";
import { Ad, AdEvent, AdEventSchema, AdHide, AdHideSchema, AdSchema, AdSettings, AdSettingsSchema } from "./ad.schema";
import { AdminAdsController, AdsController } from "./ads.controller";
import { AdsService } from "./ads.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ad.name, schema: AdSchema },
      { name: AdEvent.name, schema: AdEventSchema },
      { name: AdHide.name, schema: AdHideSchema },
      { name: AdSettings.name, schema: AdSettingsSchema },
    ]),
    HoodsModule,
    ListingsModule,
    PostsModule,
    StorageModule,
  ],
  controllers: [AdsController, AdminAdsController],
  providers: [AdsService, AdFeedService],
  exports: [AdsService],
})
export class AdsModule {}
