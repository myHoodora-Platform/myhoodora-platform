import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBearerAuth, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../shared/auth/public.decorator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { BusinessApplicationDto, ClaimBusinessDto } from "./businesses.dto";
import { BusinessesService } from "./businesses.service";

/** Contract §11: Business Pages. */
@ApiTags("business-pages")
@Controller("business-pages")
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Public()
  @Post("applications")
  @Throttle({ medium: { limit: 3, ttl: 60_000 }, long: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: "Apply for a free Business Page (public) → { id, status: 'pending_review' }" })
  @ApiTooManyRequestsResponse({ description: "Too many applications from this IP or phone number" })
  apply(@Body() body: BusinessApplicationDto) {
    return this.businesses.apply(body);
  }

  @ApiBearerAuth("firebase-jwt")
  @Post("claim")
  @HttpCode(200)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Claim an approved page with the emailed link's token → { id, businessName }" })
  @ApiBadRequestResponse({ description: "Invalid, used or expired link" })
  claim(@CurrentViewer() viewer: Viewer, @Body() body: ClaimBusinessDto) {
    return this.businesses.claim(viewer, body.token);
  }

  @ApiBearerAuth("firebase-jwt")
  @Get("mine")
  @ApiOperation({ summary: "Business Pages you manage" })
  mine(@CurrentViewer() viewer: Viewer) {
    return this.businesses.mine(viewer);
  }
}
