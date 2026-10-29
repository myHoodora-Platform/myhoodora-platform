import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Ad, AdSchema } from "../ads/ad.schema";
import { HoodsModule } from "../hoods/hoods.module";
import { Listing, ListingSchema } from "./listing.schema";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";

@Module({
  imports: [MongooseModule.forFeature([
      { name: Listing.name, schema: ListingSchema },
      // Read only: whether a seller is promoted to a neighbourhood (a `listings` ad).
      { name: Ad.name, schema: AdSchema },
    ]), HoodsModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
