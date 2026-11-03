import { BadRequestException, Controller, HttpCode, Logger, Post, Req, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../shared/auth/public.decorator";
import { CommunicationsService } from "./communications.service";
import { verifyWebhookSignature } from "./webhook-signature";

interface ResendEvent {
  type: string;
  created_at: string;
  data: { email_id?: string };
}

/**
 * POST /api/webhooks/resend — delivery events from Resend.
 * Verified (Standard Webhooks / Svix scheme) on the RAW body — any
 * re-serialisation breaks the signature — with a 5-minute replay window.
 */
@ApiExcludeController()
@Controller("webhooks")
export class ResendWebhookController {
  private readonly logger = new Logger("ResendWebhook");

  constructor(
    private readonly config: ConfigService,
    private readonly comms: CommunicationsService,
  ) {}

  @Public()
  @SkipThrottle()
  @Post("resend")
  @HttpCode(200)
  async handle(@Req() req: RawBodyRequest<Request>) {
    const secret = this.config.get<string>("mail.resendWebhookSecret");
    if (!secret) throw new ServiceUnavailableException("Webhook not configured.");
    if (!req.rawBody) throw new BadRequestException("Missing body.");

    const headers = {
      "svix-id": String(req.headers["svix-id"] ?? ""),
      "svix-timestamp": String(req.headers["svix-timestamp"] ?? ""),
      "svix-signature": String(req.headers["svix-signature"] ?? ""),
    };
    const raw = req.rawBody.toString("utf8");
    let event: ResendEvent;
    try {
      // Throws unless the signature matches and the timestamp is fresh (replay window).
      verifyWebhookSignature(secret, raw, { id: headers["svix-id"], timestamp: headers["svix-timestamp"], signature: headers["svix-signature"] });
      event = JSON.parse(raw) as ResendEvent;
    } catch {
      this.logger.warn("Rejected webhook with an invalid signature.");
      throw new BadRequestException("Invalid signature.");
    }

    const emailId = event.data?.email_id;
    if (!emailId) return { ok: true, result: "ignored" };
    const result = await this.comms.applyEmailEvent(headers["svix-id"], event.type, emailId, new Date(event.created_at));
    this.logger.log(`${event.type} ${result}`);
    return { ok: true, result };
  }
}
