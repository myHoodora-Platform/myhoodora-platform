import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { ModerationService } from "./moderation.service";
import { ModerationCase, ModerationCaseSchema, Report, ReportSchema } from "./moderation.schemas";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModerationCase.name, schema: ModerationCaseSchema },
      { name: Report.name, schema: ReportSchema },
    ]),
    HoodsModule,
  ],
  controllers: [ReportsController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
