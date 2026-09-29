import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { AppealsService } from "./appeals.service";
import { HoodLeadsService } from "./hood-leads.service";
import { LeadsRosterService } from "./leads-roster.service";
import { ModerationController } from "./moderation.controller";
import {
  Appeal,
  AppealSchema,
  HoodRole,
  HoodRoleSchema,
  LeadVote,
  LeadVoteSchema,
  ModerationCase,
  ModerationCaseSchema,
  Report,
  ReportSchema,
} from "./moderation.schemas";
import { ModerationService } from "./moderation.service";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModerationCase.name, schema: ModerationCaseSchema },
      { name: Report.name, schema: ReportSchema },
      { name: HoodRole.name, schema: HoodRoleSchema },
      { name: LeadVote.name, schema: LeadVoteSchema },
      { name: Appeal.name, schema: AppealSchema },
    ]),
    HoodsModule,
  ],
  controllers: [ReportsController, ModerationController],
  providers: [ModerationService, LeadsRosterService, HoodLeadsService, AppealsService],
  exports: [ModerationService, LeadsRosterService, HoodLeadsService, AppealsService],
})
export class ModerationModule {}
