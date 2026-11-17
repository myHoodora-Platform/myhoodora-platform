import { Body, Controller, Get, Param, Patch, Post, Put, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";
import { BuildersQuery, EngagementSettingsDto, SetBuilderDto } from "./engagement.dto";
import { EngagementService } from "./engagement.service";

/** Your streak, the launch challenge and your badge (contract §42). */
@ApiTags("engagement")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("engagement")
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Get("me")
  @ApiOperation({ summary: "My streak, launch challenge progress and badge (worked out fresh)" })
  me(@CurrentViewer() viewer: Viewer) {
    return this.engagement.me(viewer);
  }
}

/** Admin → Engagement: the challenge's rules and dates, the switches, and Hood Builders (audited). */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("admin.access")
@Controller("admin/engagement")
export class AdminEngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Get()
  @ApiOperation({ summary: "Challenge settings, kill switches and counts (builders, streak tiers)" })
  view() {
    return this.engagement.adminView();
  }

  @Patch()
  @Can("admin.access", "engagement.manage")
  @ApiOperation({ summary: "Change the challenge (name, dates, thresholds) or the switches" })
  update(@CurrentViewer() viewer: Viewer, @Body() body: EngagementSettingsDto) {
    return this.engagement.updateSettings(viewer, body);
  }

  @Post("end-challenge")
  @Can("admin.access", "engagement.manage")
  @ApiOperation({ summary: "End the launch challenge now (badges already earned stay)" })
  end(@CurrentViewer() viewer: Viewer) {
    return this.engagement.endChallenge(viewer);
  }

  @Get("builders")
  @ApiOperation({ summary: "Hood Builders (format=csv for a spreadsheet)" })
  async builders(@Query() q: BuildersQuery, @Res({ passthrough: true }) res: Response) {
    if (q.format !== "csv") return this.engagement.builders();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="hood-builders.csv"');
    return this.engagement.buildersCsv();
  }

  @Get("people/:uid")
  @ApiOperation({ summary: "One neighbour's streak, challenge progress and badge (worked out fresh)" })
  @ApiNotFound("Neighbour")
  person(@Param("uid") uid: string) {
    return this.engagement.refresh(uid);
  }

  @Put("builders/:uid")
  @Can("admin.access", "engagement.manage")
  @ApiOperation({ summary: "Grant or take away the Hood Builder badge" })
  @ApiNotFound("Neighbour")
  setBuilder(@CurrentViewer() viewer: Viewer, @Param("uid") uid: string, @Body() body: SetBuilderDto) {
    return this.engagement.setBuilder(viewer, uid, body.on, body.reason.trim());
  }
}
