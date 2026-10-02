import { createHash } from "node:crypto";
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { IsString, Length } from "class-validator";
import type { Request } from "express";
import { extractBearerToken } from "../shared/auth/firebase-auth.guard";
import { Public } from "../shared/auth/public.decorator";
import { SessionCookieAuth } from "../shared/auth/session-cookie-auth.decorator";
import { AllowSuspended, CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { EmailVerificationService } from "../verification/email-verification.service";
import { Can } from "../shared/authz/can.decorator";
import { AuthService, type WebSession } from "./auth.service";
import { ApiStandardErrors } from "../shared/http/api-docs";

/**
 * The session routes are called by the web server for every visitor, so they all arrive from one IP.
 * Rate-limit them per credential instead (hashed: the limiter never stores a token). No hourly window:
 * its counters would outlive a flood of made-up credentials by an hour; these last a minute at most.
 */
const perCredential = (req: Record<string, unknown>) =>
  createHash("sha256").update(extractBearerToken(req as unknown as Request) ?? String(req.ip)).digest("base64url");
const SESSION_THROTTLE = {
  short: { limit: 5, ttl: 1_000, getTracker: perCredential },
  medium: { limit: 30, ttl: 60_000, getTracker: perCredential },
};

class ConfirmEmailDto {
  @IsString()
  @Length(20, 100)
  token!: string;
}

@ApiTags("auth")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  /**
   * Web only: the Next.js server exchanges a visitor's ID token for the session cookie that gates page
   * routing. Suspended people need it too, to reach the page that tells them so.
   */
  @Post("session")
  @AllowSuspended()
  @Throttle(SESSION_THROTTLE)
  @SkipThrottle({ long: true })
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Exchange your ID token for a web session cookie (called by the web server)" })
  createSession(@Req() req: Request): Promise<WebSession> {
    return this.authService.createSession(extractBearerToken(req)!);
  }

  /**
   * Web only: the page gate for every signed-in page. The web server can check a cookie's signature and
   * expiry itself; only Firebase knows whether the session behind it was revoked (signed out everywhere,
   * password changed, account disabled or deleted). 204 while it is live, 401 once it isn't.
   */
  @Get("session")
  @SessionCookieAuth()
  @AllowSuspended()
  @Throttle(SESSION_THROTTLE)
  @SkipThrottle({ long: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Is this session cookie still live, i.e. not revoked? (called by the web server)" })
  checkSession(): void {}

  /** Web only: the admin portal's page gate. 204 for staff, 403 otherwise, 401 when the session is invalid or revoked. */
  @Get("session/staff")
  @SessionCookieAuth()
  @Can("admin.access")
  @Throttle(SESSION_THROTTLE)
  @SkipThrottle({ long: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Is this session cookie's owner staff? (called by the web server)" })
  staffSession(): void {}

  /**
   * "Sign out everywhere": ends every session on every device. Ordinary logout is client-side
   * (drop the Firebase session, clear the cookie) and leaves other devices signed in.
   */
  @Post("logout-everywhere")
  @AllowSuspended()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Sign out everywhere: revokes all of the user's Firebase refresh tokens and session cookies" })
  async logoutEverywhere(@CurrentViewer() viewer: Viewer): Promise<void> {
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
