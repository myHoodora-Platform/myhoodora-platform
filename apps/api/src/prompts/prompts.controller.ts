import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { PromptInputDto, PromptListQuery, PromptSettingsDto, PromptStatusDto, RespondDto, SignalDto } from "./prompts.dto";
import { PromptsService } from "./prompts.service";

/** What neighbours do, and the feedback prompts it shows (contract §33). */
@ApiTags("feedback")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller()
export class PromptsController {
  constructor(private readonly prompts: PromptsService) {}

  @Post("engagement/signal")
  @ApiOperation({ summary: "Something the neighbour just did (or the app opened) → { prompt | null, storeReview }" })
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  signal(@CurrentViewer() viewer: Viewer, @Body() body: SignalDto) {
    return this.prompts.signal(viewer, body.key, body.subjectId);
  }

  @Get("prompts/:id")
  @ApiOperation({ summary: "One prompt to answer (from a notification): 404 once closed, 409 if already answered" })
  @ApiNotFound("Prompt")
  get(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.prompts.forViewer(viewer, id);
  }

  @Post("prompts/:id/shown")
  @ApiOperation({ summary: "The app showed it (counts toward its limit and starts the cooldown)" })
  @HttpCode(HttpStatus.OK)
  shown(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.prompts.shown(viewer, id);
  }

  @Post("prompts/:id/dismiss")
  @ApiOperation({ summary: "Closed without answering" })
  @HttpCode(HttpStatus.OK)
  dismiss(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.prompts.dismiss(viewer, id);
  }

  @Post("prompts/:id/respond")
  @ApiOperation({ summary: "Answer (once) → { thanks }" })
  @Throttle({ medium: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiNotFound("Prompt")
  respond(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: RespondDto) {
    return this.prompts.respond(viewer, id, body);
  }
}

/** Writing, sending and reading feedback prompts, and the store-review rules: admins and the owner. */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("feedback.manage")
@Controller("admin/prompts")
export class AdminPromptsController {
  constructor(private readonly prompts: PromptsService) {}

  @Get()
  @ApiOperation({ summary: "Prompts with how many saw and answered them (?status&q)" })
  list(@Query() q: PromptListQuery) {
    return this.prompts.list(q);
  }

  @Get("settings")
  @ApiOperation({ summary: "Cooldown between prompts, and when the app asks for a store review" })
  settings() {
    return this.prompts.settings();
  }

  @Patch("settings")
  @ApiOperation({ summary: "Change them" })
  updateSettings(@CurrentViewer() viewer: Viewer, @Body() body: PromptSettingsDto) {
    return this.prompts.updateSettings(viewer, body);
  }

  @Get(":id")
  @ApiNotFound("Prompt")
  get(@Param("id", ParseObjectIdPipe) id: string) {
    return this.prompts.get(id);
  }

  @Get(":id/results")
  @ApiOperation({ summary: "Shown, answered, average or NPS, distribution, comments" })
  @ApiNotFound("Prompt")
  results(@Param("id", ParseObjectIdPipe) id: string) {
    return this.prompts.results(id);
  }

  @Get(":id/export.csv")
  @ApiOperation({ summary: "Every answer as CSV" })
  @Header("Content-Type", "text/csv; charset=utf-8")
  @ApiNotFound("Prompt")
  csv(@Param("id", ParseObjectIdPipe) id: string) {
    return this.prompts.csv(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a prompt (a draft)" })
  create(@CurrentViewer() viewer: Viewer, @Body() body: PromptInputDto) {
    return this.prompts.create(viewer, body);
  }

  @Patch(":id")
  @ApiNotFound("Prompt")
  update(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: PromptInputDto) {
    return this.prompts.update(viewer, id, body);
  }

  @Put(":id/status")
  @ApiOperation({ summary: "Go live, pause, end, back to draft" })
  @ApiNotFound("Prompt")
  setStatus(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: PromptStatusDto) {
    return this.prompts.setStatus(viewer, id, body.status);
  }

  @Post(":id/send")
  @ApiOperation({ summary: "Send a manual prompt now (shows on next app open; with push, a notification too)" })
  @HttpCode(HttpStatus.OK)
  @ApiNotFound("Prompt")
  send(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.prompts.send(viewer, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFound("Prompt")
  async remove(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.prompts.remove(viewer, id);
  }
}
