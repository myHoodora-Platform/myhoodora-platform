import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuditService } from "../audit/audit.service";
import type { Viewer } from "../shared/auth/viewer";
import { User } from "../users/schemas/user.schema";
import { IntegrationEventsService } from "./integration-events.service";
import { AI_CLIENT_ID } from "./oauth.config";
import { IntegrationLink } from "./oauth.schemas";

export interface AiOperatorStatus {
  /** myHoodora has granted the myHoodoraAI operator role. */
  granted: boolean;
  /** They have signed in to myHoodoraAI, so the role can no longer be granted (§5.4). */
  signedIn: boolean;
}

/**
 * The myHoodoraAI operator role (docs/integrations/myhoodora-ai.md §5.4). myHoodora's admins and
 * owners grant it (`team.manage`) to an account that hasn't signed in to myHoodoraAI yet, where an
 * account holds one role; it reaches myHoodoraAI as `hm_ai_role` at their first sign-in. Revoking
 * it tells myHoodoraAI at once (`account.updated` with `ai_role: null`), which returns them to no role.
 */
@Injectable()
export class AiOperatorService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(IntegrationLink.name)
    private readonly links: Model<IntegrationLink>,
    private readonly audit: AuditService,
    private readonly events: IntegrationEventsService,
  ) {}

  async status(uid: string): Promise<AiOperatorStatus> {
    const [user, linked] = await Promise.all([
      this.users
        .findOne({ uid })
        .select({ aiOperator: 1 })
        .lean<Pick<User, "aiOperator">>()
        .exec(),
      this.links.exists({ clientId: AI_CLIENT_ID, uid }).exec(),
    ]);
    return { granted: Boolean(user?.aiOperator), signedIn: Boolean(linked) };
  }

  async set(
    actor: Viewer,
    uid: string,
    grant: boolean,
    reason: string,
    note?: string,
  ): Promise<AiOperatorStatus> {
    const user = await this.users.findOne({ uid }).exec();
    if (!user || user.purgedAt)
      throw new NotFoundException("Neighbour not found.");
    const current = await this.status(uid);

    if (grant) {
      if (current.granted) return current;
      if (current.signedIn) {
        throw new ConflictException(
          "This account has already signed in to myHoodora AI, where an account holds one role. Grant the role to an account that hasn't.",
        );
      }
      user.aiOperator = { grantedAt: new Date(), grantedBy: actor.uid };
    } else {
      if (!current.granted) return current;
      user.aiOperator = null;
    }
    await user.save();
    await this.audit.record(
      actor,
      grant ? "ai_operator_grant" : "ai_operator_revoke",
      { type: "user", id: uid, label: user.displayName ?? "Neighbour" },
      { reason, note },
    );
    // Only a revocation can concern someone already signed in there; events go only to linked people.
    if (!grant) await this.events.accountChanged(uid);
    return { granted: grant, signedIn: current.signedIn };
  }
}
