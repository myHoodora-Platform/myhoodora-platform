import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ApiStandardErrors } from "../shared/http/api-docs";
import { ApproveHoodRequestDto, CreateHoodRequestDto, DeclineHoodRequestDto, HoodRequestChatDto, HoodRequestQuery, RemoveSecondaryHoodDto } from "./hood-requests.dto";
import { HoodRequestsService } from "./hood-requests.service";

/** A neighbour's own neighbourhoods and requests (contract §31). */
@ApiTags("users")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("users/me")
export class HoodRequestsController {
  constructor(private readonly service: HoodRequestsService) {}

  @Get("hoods")
  @ApiOperation({ summary: "Your home and secondary neighbourhoods, and your requests" })
  mine(@CurrentViewer() viewer: Viewer) {
    return this.service.mine(viewer);
  }

  @Post("hood-requests")
  @Throttle({ medium: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({
    summary: "Ask to follow another neighbourhood, or to move home",
    description:
      "`secondary`: `hoodId` (any open Hood) and a reason; up to 2 besides home, pending ones included. Read and alerts only once approved. `move`: the new `address`, `lat`, `lng` and a reason; one pending at a time. Verified neighbours only (403 otherwise). Staff decide.",
  })
  create(@CurrentViewer() viewer: Viewer, @Body() body: CreateHoodRequestDto) {
    return this.service.create(viewer, body);
  }

  @Delete("hood-requests/:id")
  @HttpCode(204)
  @ApiOperation({ summary: "Withdraw a pending request" })
  async withdraw(@CurrentViewer() viewer: Viewer, @Param("id") id: string) {
    await this.service.withdraw(viewer, id);
  }

  @Delete("secondary-hoods/:hoodId")
  @HttpCode(204)
  @ApiOperation({ summary: "Stop following a secondary neighbourhood" })
  async leave(@CurrentViewer() viewer: Viewer, @Param("hoodId") hoodId: string) {
    await this.service.leave(viewer, hoodId);
  }
}

/** Staff review of neighbourhood requests (contract §31). */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("admin")
@Can("verification.review")
export class AdminHoodRequestsController {
  constructor(private readonly service: HoodRequestsService) {}

  @Get("hood-requests")
  @ApiOperation({ summary: "Neighbourhood requests: pending (oldest first) or decided" })
  list(@CurrentViewer() viewer: Viewer, @Query() q: HoodRequestQuery) {
    return this.service.list(viewer, q);
  }

  @Post("hood-requests/:id/approve")
  @HttpCode(204)
  @ApiOperation({ summary: "Approve: add the secondary Hood, or move them (optionally to a Hood you choose)" })
  async approve(@CurrentViewer() viewer: Viewer, @Param("id") id: string, @Body() body: ApproveHoodRequestDto) {
    await this.service.approve(viewer, id, body);
  }

  @Post("hood-requests/:id/decline")
  @HttpCode(204)
  @ApiOperation({ summary: "Decline, with the reason the neighbour will see" })
  async decline(@CurrentViewer() viewer: Viewer, @Param("id") id: string, @Body() body: DeclineHoodRequestDto) {
    await this.service.decline(viewer, id, body.reason, body.note);
  }

  @Post("hood-requests/:id/chat")
  @ApiOperation({ summary: "Message the neighbour about it (opens or continues a support conversation)" })
  chat(@CurrentViewer() viewer: Viewer, @Param("id") id: string, @Body() body: HoodRequestChatDto) {
    return this.service.chat(viewer, id, body.body);
  }

  @Post("neighbours/:uid/secondary-hoods/:hoodId/remove")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove a secondary neighbourhood from a neighbour" })
  async removeSecondary(@CurrentViewer() viewer: Viewer, @Param("uid") uid: string, @Param("hoodId") hoodId: string, @Body() body: RemoveSecondaryHoodDto) {
    await this.service.removeSecondary(viewer, uid, hoodId, body.reason, body.note);
  }
}
