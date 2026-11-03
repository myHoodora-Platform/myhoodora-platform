import { type ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerException, ThrottlerGuard, type ThrottlerLimitDetail } from "@nestjs/throttler";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { Response } from "express";

/** The one limit counted before sign-in is checked (see app.module.ts). */
export const FLOOD = "flood";

const TOO_MANY = "Too many requests. Please wait a moment and try again.";

/**
 * Both guards below answer 429 the same way: words a person can read, and the standard Retry-After
 * header (seconds). The library's own header is named after whichever limit was met
 * ("Retry-After-medium"), which a client shouldn't have to know.
 */
function refuse(context: ExecutionContext, detail: ThrottlerLimitDetail): never {
  context.switchToHttp().getResponse<Response>().header("Retry-After", String(detail.timeToBlockExpire));
  throw new ThrottlerException(TOO_MANY);
}

/**
 * Runs first, before anyone is identified, so it can only count by address. Browsers call the API
 * directly and a whole estate or mobile carrier can sit behind one address, so this is a high
 * ceiling against floods, not a fair-use limit: those are AccountThrottlerGuard's, per person.
 */
@Injectable()
export class FloodGuard extends ThrottlerGuard {
  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter((t) => t.name === FLOOD);
  }

  protected throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    return refuse(context, detail);
  }
}

/**
 * The fair-use limits (short, medium, long, and each route's own). Runs after FirebaseAuthGuard, so a
 * signed-in person is counted as themselves: neighbours sharing an address don't share an allowance.
 * Routes with no sign-in (@Public) are still counted by address, as before.
 *
 * A route can still choose its own key with `@Throttle({ …: { getTracker } })`, as the web server's
 * session routes do (auth.controller.ts).
 */
@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter((t) => t.name !== FLOOD);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const uid = (req.user as DecodedIdToken | undefined)?.uid;
    return uid ? `uid:${uid}` : `ip:${String(req.ip)}`;
  }

  protected throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    return refuse(context, detail);
  }
}
