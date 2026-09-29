import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, type ClientSession, type QueryFilter } from "mongoose";
import type { Viewer } from "../shared/auth/viewer";
import { parseSort, searchRegex, type Page, type PageQuery } from "../shared/http/pagination";
import { AuditEvent, AuditEventDocument } from "./audit-event.schema";

export interface AuditRecord {
  id: string;
  at: string;
  actor: { uid: string; displayName: string; role: string };
  action: string;
  target: { type: string; id: string; label: string };
  reason?: string;
  note?: string;
}

export interface AuditQuery extends PageQuery {
  actorUid?: string;
  action?: string;
  targetType?: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditEvent.name) private readonly events: Model<AuditEventDocument>) {}

  async record(
    actor: Pick<Viewer, "uid" | "displayName" | "role">,
    action: string,
    target: { type: string; id: string; label: string },
    extra: { reason?: string; note?: string } = {},
    session?: ClientSession,
  ): Promise<AuditRecord> {
    const [doc] = await this.events.create(
      [{ actor: { uid: actor.uid, displayName: actor.displayName ?? "Staff", role: actor.role }, action, target: { ...target, label: target.label.slice(0, 120) }, ...extra }],
      { session },
    );
    return toRecord(doc!.toObject());
  }

  async forTarget(type: string, id: string, limit = 50): Promise<AuditRecord[]> {
    const rows = await this.events.find({ "target.type": type, "target.id": id }).sort({ at: -1 }).limit(limit).lean().exec();
    return rows.map(toRecord);
  }

  async recent(limit = 10): Promise<AuditRecord[]> {
    const rows = await this.events.find().sort({ at: -1 }).limit(limit).lean().exec();
    return rows.map(toRecord);
  }

  async list(q: AuditQuery): Promise<Page<AuditRecord>> {
    const re = searchRegex(q.q);
    const filter: QueryFilter<AuditEvent> = {
      ...(q.actorUid && { "actor.uid": q.actorUid }),
      ...(q.action && { action: q.action }),
      ...(q.targetType && { "target.type": q.targetType }),
      ...(re && { $or: [{ "actor.displayName": re }, { "target.label": re }, { reason: re }] }),
    };
    const [rows, total] = await Promise.all([
      this.events
        .find(filter)
        .sort(parseSort(q.sort, { at: "at" }, { at: -1 }))
        .skip((q.page - 1) * q.pageSize)
        .limit(q.pageSize)
        .lean()
        .exec(),
      this.events.countDocuments(filter).exec(),
    ]);
    return { items: rows.map(toRecord), page: q.page, pageSize: q.pageSize, total };
  }
}

function toRecord(e: AuditEvent & { _id: unknown }): AuditRecord {
  return { id: String(e._id), at: (e.at ?? new Date()).toISOString(), actor: e.actor, action: e.action, target: e.target, reason: e.reason, note: e.note };
}
