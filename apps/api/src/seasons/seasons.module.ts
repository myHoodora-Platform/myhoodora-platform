import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminSeasonsController } from "./seasons.controller";
import { Season, SeasonSchema } from "./season.schema";
import { SeasonsService } from "./seasons.service";

/** Festive seasons (plan WP-D). Global: `GET /app-config` (PlatformController) sends the current one. */
@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Season.name, schema: SeasonSchema }])],
  controllers: [AdminSeasonsController],
  providers: [SeasonsService],
  exports: [SeasonsService],
})
export class SeasonsModule {}
