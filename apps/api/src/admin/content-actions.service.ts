import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { ModerationRegistry, type TargetType } from "../moderation/moderation-registry";
import type { Viewer } from "../shared/auth/viewer";

/** Staff remove/restore on any registered content type, audited (§13.6). */
@Injectable()
export class ContentActionsService {
  constructor(
    private readonly registry: ModerationRegistry,
    private readonly audit: AuditService,
  ) {}

  async act(v: Viewer, type: TargetType, id: string, body: { action: "remove" | "restore"; reason: string; note?: string }): Promise<{ ok: true }> {
    const handler = this.registry.get(type);
    if (!handler) throw new BadRequestException("This can't be removed.");
    const snap = await handler.load(id);
    if (!snap) throw new NotFoundException("Not found.");
    await handler.setRemoved(id, body.action === "remove", v.uid);
    await this.registry.announce(type, id);
    await this.audit.record(v, body.action === "remove" ? "remove_content" : "restore_content", { type, id, label: `“${snap.preview.slice(0, 60)}”` }, { reason: body.reason, note: body.note });
    return { ok: true };
  }
}
