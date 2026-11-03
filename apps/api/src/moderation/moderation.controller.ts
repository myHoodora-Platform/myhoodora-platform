import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsString, Length } from "class-validator";
import { AllowSuspended, CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { AppealsService } from "./appeals.service";
import { HoodLeadsService } from "./hood-leads.service";
import { checkKindness } from "./kindness";
import { LEAD_VOTES, type LeadVoteValue } from "./moderation.schemas";
import { ApiStandardErrors } from "../shared/http/api-docs";

class VoteDto {
  @IsIn(LEAD_VOTES) vote!: LeadVoteValue;
}

class KindnessCheckDto {
  /** @example "Whoever keeps parking across my gate is an idiot" */
  @IsString() @Length(1, 9000) text!: string;
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
  @ApiOkResponse({ description: "Open cases in your Hood awaiting your vote" })
  queue(@CurrentViewer() viewer: Viewer) {
    return this.leads.queue(viewer);
  }

  @Post("check")
  @HttpCode(200)
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: "Kindness Reminder check before posting or commenting",
    description:
      "A gentle nudge, not moderation: nothing is stored or reported. `reasons` can include `insult` (name-calling), `threat` (first-person threats) and `shouting` (mostly capitals). The client shows a reminder and lets the person edit or post anyway.",
  })
  @ApiOkResponse({ description: "Check result", schema: { example: { flagged: true, reasons: ["insult"] } } })
  check(@Body() body: KindnessCheckDto) {
    return checkKindness(body.text);
  }

  @Post("cases/:id/votes")
  @HttpCode(200)
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Vote keep / maybe_remove / remove (Leads). ≥3 votes and a 2/3 majority decide; otherwise staff after 48 h" })
  @ApiConflictResponse({ description: "Voting has closed" })
  @ApiOkResponse({ description: "Vote recorded; the case resolves once enough Leads agree" })
  vote(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: VoteDto) {
    return this.leads.vote(viewer, id, body.vote);
  }

  // A suspension is itself a decision that can be appealed, so the person it shuts out must reach these two.
  // Both act only on the caller's own cases.
  @Get("my-decisions")
  @AllowSuspended()
  @ApiOperation({ summary: "Decisions about my content and outcomes of my reports (90 days), with appeal status" })
  mine(@CurrentViewer() viewer: Viewer) {
    return this.appeals.myDecisions(viewer);
  }

  @Post("cases/:id/appeals")
  @AllowSuspended()
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Appeal a decision (author, or a reporter when we kept the content) within 30 days → { id, status }" })
  @ApiConflictResponse({ description: "Already appealed" })
  @ApiCreatedResponse({ description: "Appeal submitted for staff review" })
  appeal(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: AppealDto) {
    return this.appeals.file(viewer, id, body.reason);
  }
}
