import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { Listing, ListingSchema } from "./listing.schema";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";

@Module({
  imports: [MongooseModule.forFeature([{ name: Listing.name, schema: ListingSchema }]), HoodsModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
