import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsString, Length } from "class-validator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { AppealsService } from "./appeals.service";
import { HoodLeadsService } from "./hood-leads.service";
import { LEAD_VOTES, type LeadVoteValue } from "./moderation.schemas";
import { ApiStandardErrors } from "../shared/http/api-docs";

class VoteDto {
  @IsIn(LEAD_VOTES) vote!: LeadVoteValue;
}

class AppealDto {
  /** Why the decision should change (shown to staff). */
  @IsString() @Length(10, 1000) reason!: string;
}

/** Neighbour-side moderation: Hood Lead voting, your decisions, appeals. */
@ApiTags("moderation")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("moderation")
export class ModerationController {
  constructor(
    private readonly leads: HoodLeadsService,
    private readonly appeals: AppealsService,
  ) {}

  @Get("lead/status")
  @ApiOperation({ summary: "Am I a Hood Lead? → { isLead, hoodId, waiting }" })
  status(@CurrentViewer() viewer: Viewer) {
    return this.leads.status(viewer);
  }

  @Get("lead/queue")
  @ApiOperation({ summary: "Reports in my Hood waiting for Lead votes (Leads only). Reporters are never shown" })
  @ApiForbiddenResponse({ description: "Not a Hood Lead" })
  queue(@CurrentViewer() viewer: Viewer) {
    return this.leads.queue(viewer);
  }

  @Post("cases/:id/votes")
  @HttpCode(200)
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Vote keep / maybe_remove / remove (Leads). ≥3 votes and a 2/3 majority decide; otherwise staff after 48 h" })
  @ApiConflictResponse({ description: "Voting has closed" })
  vote(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: VoteDto) {
    return this.leads.vote(viewer, id, body.vote);
  }

  @Get("my-decisions")
  @ApiOperation({ summary: "Decisions about my content and outcomes of my reports (90 days), with appeal status" })
  mine(@CurrentViewer() viewer: Viewer) {
    return this.appeals.myDecisions(viewer);
  }

  @Post("cases/:id/appeals")
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Appeal a decision (author, or a reporter when we kept the content) within 30 days → { id, status }" })
  @ApiConflictResponse({ description: "Already appealed" })
  appeal(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: AppealDto) {
    return this.appeals.file(viewer, id, body.reason);
  }
}
