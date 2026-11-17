import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../shared/auth/public.decorator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";
import { ClaimInviteDto, InviteLeaderboardQuery, SetInviterDto } from "./invites.dto";
import { InvitesService } from "./invites.service";

/** Your invite code, and who you brought (contract §40). */
@ApiTags("invites")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("invites")
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get("me")
  @ApiOperation({ summary: "My invite code and link, who joined with it, who invited me, and whether to ask 'Who invited you?'" })
  me(@CurrentViewer() viewer: Viewer) {
    return this.invites.summary(viewer);
  }

  @Post("claim")
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Say who invited me (by code, or a neighbour in my Hood). First answer stays → { invitedBy: { name } }" })
  @ApiNotFound("Invite code")
  claim(@CurrentViewer() viewer: Viewer, @Body() body: ClaimInviteDto) {
    return this.invites.claim(viewer, body);
  }

  @Post("me/dismiss")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({ summary: "Close the 'Who invited you?' card without answering" })
  async dismiss(@CurrentViewer() viewer: Viewer) {
    await this.invites.dismissAsk(viewer);
  }
}

/** The landing page for a personal invite link, before signing in. */
@ApiTags("public")
@ApiStandardErrors()
@Controller("public/invites")
export class PublicInvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Public()
  @Get(":code")
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @Header("Cache-Control", "public, max-age=300")
  @ApiOperation({ summary: "Who a code belongs to: first name and Hood only (404 unknown)" })
  get(@Param("code") code: string) {
    return this.invites.publicInvite(code);
  }
}

/** The challenge leaderboard, and fixing who gets the credit (audited). */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("admin.access")
@Controller("admin/invites")
export class AdminInvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  @ApiOperation({ summary: "Top inviters and Hoods (?from&hoodId&limit; format=csv for a spreadsheet)" })
  async leaderboard(@Query() q: InviteLeaderboardQuery, @Res({ passthrough: true }) res: Response) {
    if (q.format !== "csv") return this.invites.leaderboard(q);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="invites.csv"');
    return this.invites.leaderboardCsv(q);
  }

  @Put(":uid")
  @Can("admin.access", "engagement.manage")
  @ApiOperation({ summary: "Credit someone else for inviting this neighbour (code), or nobody (null)" })
  @ApiNotFound("Neighbour")
  set(@CurrentViewer() viewer: Viewer, @Param("uid") uid: string, @Body() body: SetInviterDto) {
    return this.invites.setInviter(viewer, uid, body.code, body.reason.trim());
  }
}
