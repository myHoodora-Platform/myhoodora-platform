import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { ActivationDto, CalendarDayDto, ComposeDto, ContentItemDto, DailySettingsDto, ImportDto, ItemListQuery, PinDto, ScheduledListQuery } from "./hood-content.dto";
import { HoodContentService } from "./hood-content.service";

/** What neighbours get from the Hood Team's content bank. */
@ApiTags("hood-content")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("hood-content")
export class HoodContentController {
  constructor(private readonly content: HoodContentService) {}

  @Get("starters")
  @ApiOperation({ summary: "Conversation starters for the composer, filled in for your Hood ([] before you join one)" })
  starters(@CurrentViewer() viewer: Viewer) {
    return this.content.starters(viewer);
  }
}

/**
 * The Hood Team's tools (docs/product/hood-activation-plan.md): every staff member can look,
 * `content.manage` (admins, owner) can change and post.
 */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("admin.access")
@Controller("admin/hood-content")
export class AdminHoodContentController {
  constructor(private readonly content: HoodContentService) {}

  @Get("items")
  @ApiOperation({ summary: "The content bank (?tag&q&active)" })
  items(@Query() q: ItemListQuery) {
    return this.content.listItems(q);
  }

  @Post("items")
  @Can("admin.access", "content.manage")
  @ApiOperation({ summary: "Add an item" })
  createItem(@CurrentViewer() viewer: Viewer, @Body() body: ContentItemDto) {
    return this.content.createItem(viewer, body);
  }

  @Patch("items/:id")
  @Can("admin.access", "content.manage")
  @ApiOperation({ summary: "Change an item (text, city versions, switch on/off)" })
  @ApiNotFound("Item")
  updateItem(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ContentItemDto) {
    return this.content.updateItem(viewer, id, body);
  }

  @Delete("items/:id")
  @Can("admin.access", "content.manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({ summary: "Delete an item (posts already made stay)" })
  async deleteItem(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.content.deleteItem(viewer, id);
  }

  @Post("items/import")
  @Can("admin.access", "content.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Import docs/product/hood-content-bank.md → { added, updated, unchanged, problems }" })
  import(@CurrentViewer() viewer: Viewer, @Body() body: ImportDto) {
    return this.content.importBank(viewer, body);
  }

  @Post("compose")
  @Can("admin.access", "content.manage")
  @ApiOperation({ summary: "Post as the Hood Team in the chosen Hoods, now or at runAt" })
  compose(@CurrentViewer() viewer: Viewer, @Body() body: ComposeDto) {
    return this.content.compose(viewer, body);
  }

  @Post("activation")
  @Can("admin.access", "content.manage")
  @ApiOperation({ summary: "Schedule the first-ten-days plan in the chosen Hoods that are still quiet" })
  activation(@CurrentViewer() viewer: Viewer, @Body() body: ActivationDto) {
    return this.content.applyActivation(viewer, body);
  }

  @Get("scheduled")
  @ApiOperation({ summary: "Hood Team posts: waiting, published, cancelled, failed (?status&source&hoodId&batchId&limit)" })
  scheduled(@Query() q: ScheduledListQuery) {
    return this.content.listScheduled(q);
  }

  @Post("scheduled/:id/cancel")
  @Can("admin.access", "content.manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({ summary: "Cancel one post that hasn't gone out" })
  async cancel(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.content.cancel(viewer, id);
  }

  @Post("batches/:batchId/cancel")
  @Can("admin.access", "content.manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel everything in one batch that hasn't gone out → { cancelled }" })
  cancelBatch(@CurrentViewer() viewer: Viewer, @Param("batchId") batchId: string) {
    if (!/^[\w-]{1,60}$/.test(batchId)) throw new BadRequestException("That isn't a batch.");
    return this.content.cancelBatch(viewer, batchId);
  }

  @Get("daily")
  @ApiOperation({ summary: "Daily prompt settings and the next 14 days" })
  daily() {
    return this.content.dailySettings();
  }

  @Patch("daily")
  @Can("admin.access", "content.manage")
  @ApiOperation({ summary: "Switch the daily prompt on/off, its hour, the smallest Hood that gets it" })
  updateDaily(@CurrentViewer() viewer: Viewer, @Body() body: DailySettingsDto) {
    return this.content.updateDaily(viewer, body);
  }

  @Put("daily/calendar/:date")
  @Can("admin.access", "content.manage")
  @ApiOperation({ summary: "Choose the item for one day ({ code: null } goes back to the rotation)" })
  setDay(@CurrentViewer() viewer: Viewer, @Param("date") date: string, @Body() body: CalendarDayDto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException("Dates look like 2026-12-25.");
    return this.content.setCalendarDay(viewer, date, body.code ?? null);
  }

  @Patch("posts/:id/pin")
  @Can("admin.access", "content.manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({ summary: "Pin a Hood Team post for N days (0 unpins)" })
  async pin(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: PinDto) {
    await this.content.pin(viewer, id, body.days);
  }
}
