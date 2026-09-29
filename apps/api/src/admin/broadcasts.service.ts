import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Model, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { Neighborhood, NeighborhoodDocument } from "../hoods/schemas/hood.schema";
import { NotificationsService } from "../notifications/notifications.service";
import type { Viewer } from "../shared/auth/viewer";
import { User, UserDocument } from "../users/schemas/user.schema";

export type Audience = { type: "all" } | { type: "hood"; hoodIds: string[] } | { type: "user"; uids: string[] };

@Schema({ timestamps: { createdAt: "sentAt", updatedAt: false }, collection: "broadcasts" })
export class Broadcast {
  @Prop({ required: true, maxlength: 60 }) title!: string;
  @Prop({ required: true, maxlength: 240 }) body!: string;
  @Prop({ type: Object, required: true }) audience!: Audience;
  @Prop({ required: true }) audienceLabel!: string;
  @Prop({ required: true }) reach!: number;
  @Prop({ required: true }) sentBy!: string;
  sentAt?: Date;
}
export const BroadcastSchema = SchemaFactory.createForClass(Broadcast);

/** Platform announcements to neighbours' notifications (contract §13.8). */
@Injectable()
export class BroadcastsService {
  constructor(
    @InjectModel(Broadcast.name) private readonly broadcasts: Model<Broadcast>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Neighborhood.name) private readonly hoods: Model<NeighborhoodDocument>,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private recipientFilter(a: Audience): QueryFilter<User> {
    const base: QueryFilter<User> = { deactivatedAt: null, accountStatus: { $ne: "suspended" as const } };
    if (a.type === "all") return { ...base, verificationStatus: "verified" as const };
    if (a.type === "hood") return { ...base, neighborhoodId: { $in: a.hoodIds } };
    return { ...base, uid: { $in: a.uids } };
  }

  estimate(a: Audience): Promise<number> {
    return this.users.countDocuments(this.recipientFilter(a)).exec();
  }

  async list() {
    const rows = await this.broadcasts.find().sort({ sentAt: -1 }).limit(100).lean<(Broadcast & { _id: unknown })[]>().exec();
    return rows.map((b) => ({ id: String(b._id), title: b.title, body: b.body, audience: b.audience, audienceLabel: b.audienceLabel, reach: b.reach, sentAt: b.sentAt?.toISOString(), sentBy: b.sentBy }));
  }

  async send(actor: Viewer, input: { title: string; body: string; audience: Audience }) {
    if (input.audience.type === "all" && actor.role === "moderator") throw new ForbiddenException("Only admins can message everyone.");
    const ids = input.audience.type === "hood" ? input.audience.hoodIds : input.audience.type === "user" ? input.audience.uids : ["all"];
    if (!ids.length) throw new BadRequestException("Choose who should receive this.");
    const recipients = (await this.users.find(this.recipientFilter(input.audience)).select({ uid: 1 }).limit(100_000).lean<Pick<User, "uid">[]>().exec()).map((u) => u.uid);
    const label =
      input.audience.type === "all"
        ? "Everyone"
        : input.audience.type === "hood"
          ? (await this.hoods.find({ _id: { $in: input.audience.hoodIds } }).select({ name: 1 }).lean<{ name: string }[]>().exec()).map((h) => h.name).join(", ")
          : `${input.audience.uids.length} neighbour(s)`;
    const doc = await this.broadcasts.create({ ...input, audienceLabel: label, reach: recipients.length, sentBy: actor.displayName ?? "Staff" });
    await this.notifications.notify({ uids: recipients, type: "system", title: input.title, body: input.body, href: "/notifications" });
    await this.audit.record(actor, "broadcast_send", { type: "broadcast", id: String(doc._id), label: input.title }, { reason: label });
    return { id: String(doc._id), estimatedReach: recipients.length };
  }
}
