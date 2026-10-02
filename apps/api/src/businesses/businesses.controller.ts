import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
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
  @ApiCreatedResponse({ description: "Application received", schema: { example: { id: "6700000000000000000000bb", status: "pending_review" } } })
  apply(@Body() body: BusinessApplicationDto) {
    return this.businesses.apply(body);
  }

  @ApiBearerAuth("firebase-jwt")
  @Post("claim")
  @HttpCode(200)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Claim an approved page with the emailed link's token → { id, businessName }" })
  @ApiBadRequestResponse({ description: "Invalid, used or expired link" })
  @ApiOkResponse({ description: "Page claimed and linked to your account", schema: { example: { id: "6700000000000000000000cc", businessName: "Mama Nkechi's Kitchen" } } })
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
