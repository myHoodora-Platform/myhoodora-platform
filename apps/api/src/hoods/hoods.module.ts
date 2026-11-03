import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsController } from "./hoods.controller";
import { HoodsService } from "./hoods.service";
import { Neighborhood, NeighborhoodSchema } from "./schemas/hood.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: Neighborhood.name, schema: NeighborhoodSchema }])],
  controllers: [HoodsController],
  providers: [HoodsService],
  exports: [HoodsService, MongooseModule],
})
export class HoodsModule {}
