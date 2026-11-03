import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AuditEventDocument = HydratedDocument<AuditEvent>;

/**
 * Append-only record of every staff action (contract §13.0): who, what,
 * on which target, why. Never updated or deleted by the application.
 */
@Schema({ timestamps: { createdAt: "at", updatedAt: false }, collection: "audit_events" })
export class AuditEvent {
  @Prop({ required: true, type: Object })
  actor!: { uid: string; displayName: string; role: string };

  @Prop({ required: true, index: true })
  action!: string;

  // Plain object: a nested key named "type" would confuse Mongoose schema typing.
  @Prop({ required: true, type: Object })
  target!: { type: string; id: string; label: string };

  @Prop({ maxlength: 200 })
  reason?: string;

  /** Staff-only note. Never shown to the affected neighbour. */
  @Prop({ maxlength: 500 })
  note?: string;

  at?: Date;
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);
AuditEventSchema.index({ "target.type": 1, "target.id": 1, at: -1 });
AuditEventSchema.index({ "actor.uid": 1, at: -1 });
AuditEventSchema.index({ at: -1 });
