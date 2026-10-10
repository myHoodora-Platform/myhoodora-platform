import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { ModerationRegistry, type TargetType } from "../moderation/moderation-registry";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";

/** Staff remove/restore on any registered content type, audited (§13.6). */
@Injectable()
export class ContentActionsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly registry: ModerationRegistry,
    private readonly audit: AuditService,
  ) {}

  async act(v: Viewer, type: TargetType, id: string, body: { action: "remove" | "restore"; reason: string; note?: string }): Promise<{ ok: true }> {
    const handler = this.registry.get(type);
    if (!handler) throw new BadRequestException("This can't be removed.");
    const snap = await handler.load(id);
    if (!snap) throw new NotFoundException("Not found.");
    // The change and its audit record together, as moderation decisions already are: if the record
    // can't be written, the content is left as it was.
    await withTransaction(this.connection, async (session) => {
      await handler.setRemoved(id, body.action === "remove", v.uid, session);
      await this.audit.record(v, body.action === "remove" ? "remove_content" : "restore_content", { type, id, label: `“${snap.preview.slice(0, 60)}”` }, { reason: body.reason, note: body.note }, session);
    });
    await this.registry.announce(type, id);
    return { ok: true };
  }
}
