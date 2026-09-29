import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsString, Length } from "class-validator";
import { Public } from "../shared/auth/public.decorator";
import { AllowSuspended, CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { EmailVerificationService } from "../verification/email-verification.service";
import { AuthService } from "./auth.service";

class ConfirmEmailDto {
  @IsString()
  @Length(20, 100)
  token!: string;
}

@ApiTags("auth")
@ApiBearerAuth("firebase-jwt")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Post("logout")
  @AllowSuspended()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Logout: revokes the user's Firebase refresh tokens" })
  async logout(@CurrentViewer() viewer: Viewer): Promise<void> {
    await this.authService.revokeTokens(viewer.uid);
  }

  /** Public: the link is opened from an email, possibly on another device. Strictly throttled against guessing. */
  @Public()
  @Throttle({ short: { limit: 3, ttl: 1_000 }, medium: { limit: 10, ttl: 60_000 } })
  @Post("email-verification/confirm")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Confirm an email-verification token" })
  async confirmEmail(@Body() body: ConfirmEmailDto): Promise<void> {
    await this.emailVerification.confirm(body.token);
  }

  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  @Post("email-verification/resend")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Send a new verification email (rate-limited)" })
  async resend(@CurrentViewer() viewer: Viewer): Promise<void> {
    await this.emailVerification.resend(viewer.uid);
  }
}
