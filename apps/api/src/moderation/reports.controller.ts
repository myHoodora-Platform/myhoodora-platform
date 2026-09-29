import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";
import { REPORT_REASONS, type ReportReason } from "../platform/platform-settings.schema";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { TARGET_TYPES, type TargetType } from "./moderation-registry";
import { ModerationService } from "./moderation.service";

class CreateReportDto {
  @IsIn(TARGET_TYPES) targetType!: TargetType;
  @IsString() @Length(1, 128) targetId!: string;
  @IsIn(REPORT_REASONS) reason!: ReportReason;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}

/** Contract §9: POST /reports → 204. Private; idempotent per reporter + item. */
@ApiTags("reports")
@ApiBearerAuth("firebase-jwt")
@Controller("reports")
export class ReportsController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  @HttpCode(204)
  @Can("report.create")
  @Throttle({ medium: { limit: 10, ttl: 60_000 }, long: { limit: 50, ttl: 3_600_000 } })
  async create(@CurrentViewer() viewer: Viewer, @Body() body: CreateReportDto) {
    await this.moderation.fileReport(viewer, body);
  }
}
