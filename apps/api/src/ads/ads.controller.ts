import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { AdFeedService } from "./ad-feed.service";
import { AdEventsDto, AdFeedQuery, AdInputDto, AdListQuery, AdSettingsDto, AdStatsQuery, AdStatusDto, HideAdDto, ReportAdDto } from "./ads.dto";
import { AdsService } from "./ads.service";

/** The feed with sponsored items, and what neighbours do with an ad (contract §32). */
@ApiTags("ads")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller()
export class AdsController {
  constructor(
    private readonly feed: AdFeedService,
    private readonly ads: AdsService,
  ) {}

  @Get("feed/hood/:id")
  @ApiOperation({ summary: "Neighbourhood feed with sponsored items → { items: [{type:'post'|'ad', data, slotId?}], nextCursor } (?limit&cursor&category&session)" })
  @ApiNotFound("Neighbourhood")
  page(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Query() q: AdFeedQuery) {
    return this.feed.page(viewer, id, q);
  }

  @Post("ads/events")
  @ApiOperation({ summary: "Record impressions and clicks (each counts once per ad, feed session and kind) → { recorded }" })
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  record(@CurrentViewer() viewer: Viewer, @Body() body: AdEventsDto) {
    return this.ads.record(viewer, body.events);
  }

  @Post("ads/:id/hide")
  @ApiOperation({ summary: "Never show me this ad again → { hidden }" })
  @HttpCode(HttpStatus.OK)
  @ApiNotFound("Ad")
  hide(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: HideAdDto) {
    return this.ads.hide(viewer, id, body.sessionId);
  }

  @Post("ads/:id/report")
  @ApiOperation({ summary: "Report an ad (also hides it for you) → { reported }" })
  @Can("report.create")
  @HttpCode(HttpStatus.OK)
  @ApiNotFound("Ad")
  report(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ReportAdDto) {
    return this.ads.report(viewer, id, body.reason, body.sessionId);
  }
}

/** Managing ads (contract §32): admins and the owner only, every change in the audit log. */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("ads.manage")
@Controller("admin/ads")
export class AdminAdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  @ApiOperation({ summary: "Ads with quick stats (?status&q)" })
  list(@Query() q: AdListQuery) {
    return this.ads.list(q);
  }

  @Get("settings")
  @ApiOperation({ summary: "Placement rules" })
  settings() {
    return this.ads.settings();
  }

  @Patch("settings")
  @ApiOperation({ summary: "Change the placement rules" })
  updateSettings(@CurrentViewer() viewer: Viewer, @Body() body: AdSettingsDto) {
    return this.ads.updateSettings(viewer, body);
  }

  @Get(":id")
  @ApiOperation({ summary: "One ad with its stats" })
  @ApiNotFound("Ad")
  get(@Param("id", ParseObjectIdPipe) id: string) {
    return this.ads.get(id);
  }

  @Get(":id/stats")
  @ApiOperation({ summary: "Impressions, reach, clicks, CTR, hides, reports and a daily series (?from&to, default last 30 days)" })
  @ApiNotFound("Ad")
  stats(@Param("id", ParseObjectIdPipe) id: string, @Query() q: AdStatsQuery) {
    return this.ads.stats(id, q);
  }

  @Post()
  @ApiOperation({ summary: "Create an ad (a draft unless you then set it active)" })
  create(@CurrentViewer() viewer: Viewer, @Body() body: AdInputDto) {
    return this.ads.create(viewer, body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit an ad" })
  @ApiNotFound("Ad")
  update(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: AdInputDto) {
    return this.ads.update(viewer, id, body);
  }

  @Put(":id/status")
  @ApiOperation({ summary: "Go live, pause, end, or back to draft (going live checks it's complete)" })
  @ApiNotFound("Ad")
  setStatus(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: AdStatusDto) {
    return this.ads.setStatus(viewer, id, body.status);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an ad (it leaves the feed; its stats are kept)" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFound("Ad")
  async remove(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.ads.remove(viewer, id);
  }
}
