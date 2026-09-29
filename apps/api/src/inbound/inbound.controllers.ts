import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../shared/auth/public.decorator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { AiPilotDto, ContactDto, FeedbackDto, SupportRequestDto, TalentDto } from "./inbound.dto";
import { InboundService } from "./inbound.service";
import { ApiStandardErrors } from "../shared/http/api-docs";

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
  @ApiOperation({ summary: "Ask the team for help → { id, status: 'received' }. Replies arrive by email and notification" })
  support(@CurrentViewer() viewer: Viewer, @Body() body: SupportRequestDto) {
    return this.inbound.support(viewer, body);
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
