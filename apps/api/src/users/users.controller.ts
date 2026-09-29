import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { DecodedIdToken } from "firebase-admin/auth";
import { CurrentUser } from "../shared/auth/current-user.decorator";
import { AllowSuspended, CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { BlockDto, DeactivateDto, OnboardingDto, PreferencesDto, UpdateMeDto, VerifyLocationDto } from "./dto/users.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth("firebase-jwt")
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
  updateMe(@CurrentViewer() viewer: Viewer, @Body() body: UpdateMeDto) {
    return this.users.updateMe(viewer.uid, body);
  }

  @Patch("me/onboarding")
  completeOnboarding(@CurrentViewer() viewer: Viewer, @Body() body: OnboardingDto) {
    return this.users.completeOnboarding(viewer.uid, body);
  }

  @Post("me/verify-location")
  @HttpCode(200)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Match the caller's coordinates to a Hood" })
  verifyLocation(@CurrentViewer() viewer: Viewer, @Body() body: VerifyLocationDto) {
    return this.users.verifyLocation(viewer, body);
  }

  @Get("me/preferences")
  getPreferences(@CurrentViewer() viewer: Viewer) {
    return this.users.getPreferences(viewer.uid);
  }

  @Patch("me/preferences")
  updatePreferences(@CurrentViewer() viewer: Viewer, @Body() body: PreferencesDto) {
    return this.users.updatePreferences(viewer.uid, body);
  }

  @Get("me/blocks")
  listBlocks(@CurrentViewer() viewer: Viewer) {
    return this.users.listBlocks(viewer.uid);
  }

  @Post("me/blocks")
  @HttpCode(204)
  async block(@CurrentViewer() viewer: Viewer, @Body() body: BlockDto) {
    await this.users.block(viewer.uid, body.uid);
  }

  @Delete("me/blocks/:uid")
  @HttpCode(204)
  async unblock(@CurrentViewer() viewer: Viewer, @Param("uid") uid: string) {
    await this.users.unblock(viewer.uid, uid);
  }

  @Post("me/deactivate")
  @AllowSuspended()
  @HttpCode(204)
  async deactivate(@CurrentViewer() viewer: Viewer, @Body() body: DeactivateDto) {
    await this.users.deactivate(viewer.uid, body);
  }

  @Get(":uid/public")
  publicProfile(@CurrentViewer() viewer: Viewer, @Param("uid") uid: string) {
    return this.users.publicProfile(viewer, uid);
  }
}
