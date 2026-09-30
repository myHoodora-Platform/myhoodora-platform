import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../shared/auth/public.decorator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { AiPilotDto, ContactDto, FeedbackDto, SupportMessageDto, SupportRequestDto, TalentDto } from "./inbound.dto";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { InboundService } from "./inbound.service";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";

/** Contract §10: in-app feedback and help requests (signed in). */
@ApiTags("support")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller()
export class SupportController {
  constructor(private readonly inbound: InboundService) {}

  @Post("feedback")
  @HttpCode(204)
  @Throttle({ long: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({ summary: "Send app feedback to the team" })
  @ApiNoContentResponse()
  async feedback(@CurrentViewer() viewer: Viewer, @Body() body: FeedbackDto) {
    await this.inbound.feedback(viewer, body);
  }

  @Post("support")
  @Throttle({ long: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: "Ask the team for help → { id, status: 'received' }. Continue it at /support/threads/:id" })
  support(@CurrentViewer() viewer: Viewer, @Body() body: SupportRequestDto) {
    return this.inbound.support(viewer, body);
  }

  // ── Your support conversations (contract §18) ──

  @Get("support/threads")
  @ApiOperation({ summary: "Your support conversations, newest first" })
  myThreads(@CurrentViewer() viewer: Viewer) {
    return this.inbound.myThreads(viewer);
  }

  @Get("support/threads/unread-count")
  @ApiOperation({ summary: "How many of your conversations have an unread team reply" })
  unread(@CurrentViewer() viewer: Viewer) {
    return this.inbound.myUnreadCount(viewer);
  }

  @Get("support/threads/:id")
  @ApiOperation({ summary: "One of your conversations (marks it read)" })
  @ApiOkResponse()
  @ApiNotFound("Conversation")
  myThread(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.inbound.myThread(viewer, id);
  }

  @Post("support/threads/:id/typing")
  @HttpCode(204)
  @ApiOperation({ summary: "Tell the team you're typing (live only, nothing stored)" })
  async typing(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.inbound.userTyping(viewer, id);
  }

  @Post("support/threads/:id/messages")
  @HttpCode(200)
  @Throttle({ long: { limit: 60, ttl: 3_600_000 } })
  @ApiOperation({ summary: "Reply in your conversation (reopens it if it was resolved)" })
  @ApiOkResponse()
  @ApiNotFound("Conversation")
  reply(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: SupportMessageDto) {
    return this.inbound.userReply(viewer, id, body.body);
  }
}

/** Contract §11b, §11c: public forms (no account). Rate-limited by IP and email. */
@ApiTags("public")
@Controller()
export class PublicFormsController {
  constructor(private readonly inbound: InboundService) {}

  @Public()
  @Post("contact")
  @Throttle({ medium: { limit: 3, ttl: 60_000 }, long: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: "Contact form → { id, status: 'received' }. Safety topics go to the trust team first" })
  @ApiTooManyRequestsResponse({ description: "Too many messages from this IP or address" })
  @ApiCreatedResponse({ description: "Received; an acknowledgement is emailed", schema: { example: { id: "6700000000000000000000aa", status: "received" } } })
  contact(@Body() body: ContactDto) {
    return this.inbound.contact(body);
  }

  @Public()
  @Post("careers/talent-network")
  @Throttle({ medium: { limit: 3, ttl: 60_000 }, long: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: "Join the talent network → { id, status: 'joined' }" })
  talent(@Body() body: TalentDto) {
    return this.inbound.joinTalent(body);
  }

  @Public()
  @Post("ai/pilot-requests")
  @Throttle({ medium: { limit: 3, ttl: 60_000 }, long: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: "Join the myHoodora AI pilot waitlist → { id, status: 'waitlisted' }" })
  aiPilot(@Body() body: AiPilotDto) {
    return this.inbound.joinAiPilot(body);
  }
}
