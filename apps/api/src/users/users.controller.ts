import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiConflictResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { DecodedIdToken } from "firebase-admin/auth";
import { CurrentUser } from "../shared/auth/current-user.decorator";
import { AllowSuspended, CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { BlockDto, DeactivateDto, HoodRequestDto, OnboardingDto, PreferencesDto, UpdateMeDto, UserSearchQuery, VerifyLocationDto } from "./dto/users.dto";
import { UsersService } from "./users.service";
import { ApiNotFound, ApiStandardErrors, ErrorResponse } from "../shared/http/api-docs";

@ApiTags("users")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Creates the account on first call (welcome email once), returns it on every sign-in. */
  @Get("me")
  @AllowSuspended()
  @ApiOperation({ summary: "Get (or create on first sign-in) the current user" })
  getMe(@CurrentUser() token: DecodedIdToken) {
    return this.users.getOrCreateMe(token);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update display name, bio or photo (Hood changes go through verification)" })
  async updateMe(@CurrentViewer() viewer: Viewer, @CurrentUser() token: DecodedIdToken, @Body() body: UpdateMeDto) {
    await this.users.ensureAccount(viewer, token);
    return this.users.updateMe(viewer.uid, body);
  }

  @Patch("me/onboarding")
  @ApiOperation({ summary: "Finish onboarding (name, rough location)" })
  async completeOnboarding(@CurrentViewer() viewer: Viewer, @CurrentUser() token: DecodedIdToken, @Body() body: OnboardingDto) {
    // Self-heal: onboarding must never 404 because the first GET /users/me didn't create the account.
    await this.users.ensureAccount(viewer, token);
    return this.users.completeOnboarding(viewer.uid, body);
  }

  @Post("me/verify-location")
  @HttpCode(200)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: "Match the caller's coordinates to a Hood",
    description:
      "Verified: `{ verificationStatus: 'verified', neighborhoodId, distanceMeters }`. Outside every Hood: `{ verificationStatus, reason: 'outside_coverage', nearbyHoods }` where `nearbyHoods` (nearest first, max 3, may be empty) can be passed to `POST /users/me/hood-request`.",
  })
  async verifyLocation(@CurrentViewer() viewer: Viewer, @CurrentUser() token: DecodedIdToken, @Body() body: VerifyLocationDto) {
    await this.users.ensureAccount(viewer, token);
    return this.users.verifyLocation(viewer, body);
  }

  @Post("me/hood-request")
  @HttpCode(200)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: "Ask to join a nearby Hood (staff approve)",
    description:
      "For an address just outside every Hood. `hoodId` must be one of the `nearbyHoods` from your last verify-location. Sets you to `pending_review` with `requestedHood` until staff approve or reject. Re-requesting replaces the request. 400 if the Hood isn't near that address or isn't open; 403 if your verification was rejected.",
  })
  @ApiOkResponse({ description: "Your updated profile (same shape as GET /users/me)" })
  @ApiConflictResponse({ description: "You're already a verified neighbour", type: ErrorResponse })
  requestHood(@CurrentViewer() viewer: Viewer, @Body() body: HoodRequestDto) {
    return this.users.requestHood(viewer, body.hoodId);
  }

  @Delete("me/hood-request")
  @ApiOperation({ summary: "Withdraw your pending request to join a Hood" })
  @ApiOkResponse({ description: "Your updated profile, back to `unverified`" })
  @ApiConflictResponse({ description: "No pending request", type: ErrorResponse })
  cancelHoodRequest(@CurrentViewer() viewer: Viewer) {
    return this.users.cancelHoodRequest(viewer);
  }

  @Get("me/preferences")
  @ApiOperation({ summary: "Your notification, digest and privacy preferences" })
  getPreferences(@CurrentViewer() viewer: Viewer) {
    return this.users.getPreferences(viewer.uid);
  }

  @Patch("me/preferences")
  @ApiOperation({ summary: "Update notification, digest and privacy preferences" })
  updatePreferences(@CurrentViewer() viewer: Viewer, @Body() body: PreferencesDto) {
    return this.users.updatePreferences(viewer.uid, body);
  }

  @Get("me/blocks")
  @ApiOperation({ summary: "People you've blocked (uids)" })
  listBlocks(@CurrentViewer() viewer: Viewer) {
    return this.users.listBlocks(viewer.uid);
  }

  @Post("me/blocks")
  @ApiOperation({ summary: "Block a neighbour (hides them both ways)" })
  @HttpCode(204)
  async block(@CurrentViewer() viewer: Viewer, @Body() body: BlockDto) {
    await this.users.block(viewer.uid, body.uid);
  }

  @Delete("me/blocks/:uid")
  @ApiOperation({ summary: "Unblock" })
  @HttpCode(204)
  async unblock(@CurrentViewer() viewer: Viewer, @Param("uid") uid: string) {
    await this.users.unblock(viewer.uid, uid);
  }

  @Post("me/deactivate")
  @ApiOperation({ summary: "Deactivate your account (sign in within 30 days to restore)" })
  @AllowSuspended()
  @HttpCode(204)
  async deactivate(@CurrentViewer() viewer: Viewer, @Body() body: DeactivateDto) {
    await this.users.deactivate(viewer.uid, body);
  }

  @Get("search")
  @ApiOperation({ summary: "Find neighbours in your Hood by name (for group invites)" })
  search(@CurrentViewer() viewer: Viewer, @Query() q: UserSearchQuery) {
    return this.users.search(viewer, q.q ?? "");
  }

  @Get(":uid/public")
  @ApiOperation({ summary: "A neighbour's public profile (your Hood only; never an address)" })
  @ApiOkResponse()
  @ApiNotFound("Neighbour")
  publicProfile(@CurrentViewer() viewer: Viewer, @Param("uid") uid: string) {
    return this.users.publicProfile(viewer, uid);
  }
}
