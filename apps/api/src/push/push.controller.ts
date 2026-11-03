import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { AllowSuspended, CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { ApiStandardErrors } from "../shared/http/api-docs";
import { PUSH_PLATFORMS, type PushPlatform } from "./push-device.schema";
import { PushService } from "./push.service";

export class RegisterDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  token!: string;

  @IsIn(PUSH_PLATFORMS)
  platform!: PushPlatform;
}

/**
 * Contract §30. The mobile app registers its push token after sign-in (and on each launch), and
 * removes it on logout. Open to suspended accounts: the notice that says why is a notification too.
 */
@ApiTags("push")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("push/devices")
export class PushController {
  constructor(private readonly push: PushService) {}

  @Put()
  @AllowSuspended()
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Register this phone for push (idempotent)" })
  @ApiNoContentResponse()
  async register(@CurrentViewer() viewer: Viewer, @Body() body: RegisterDeviceDto): Promise<void> {
    await this.push.register(viewer.uid, body.token, body.platform);
  }

  @Delete(":token")
  @AllowSuspended()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Stop pushes to this phone (logout). URL-encode the token" })
  @ApiNoContentResponse()
  async unregister(@CurrentViewer() viewer: Viewer, @Param("token") token: string): Promise<void> {
    await this.push.unregister(viewer.uid, token);
  }
}
