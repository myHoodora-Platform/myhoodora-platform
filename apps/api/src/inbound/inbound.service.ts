import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { createHash } from "node:crypto";
import { Model, Types, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { CommunicationsService } from "../communications/communications.service";
import { messageEmail } from "../communications/templates/email-templates";
import { NotificationsService } from "../notifications/notifications.service";
import type { Viewer } from "../shared/auth/viewer";
import { searchRegex, type Page } from "../shared/http/pagination";
import { User, UserDocument } from "../users/schemas/user.schema";
import type { AiPilotDto, ContactDto, FeedbackDto, InboxQuery, InboxUpdateDto, SupportRequestDto, TalentDto } from "./inbound.dto";
import { AiPilotRequest, InboundMessage, InboundMessageDocument, TalentProfile, type InboxPriority, type InboxSource, type InboxStatus } from "./inbound.schemas";

export interface InboxThreadView {
  id: string;
  source: InboxSource;
  topic: string;
  subject: string;
  from: { uid?: string; name: string; email: string };
  status: InboxStatus;
  priority: InboxPriority;
  assignee?: { uid: string; displayName: string };
  messages: { from: "user" | "staff"; body: string; at: string; by?: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface SignupEntry {
  id: string;
  type: "ai_pilot" | "talent" | "business_ads";
  name: string;
  email: string;
  detail: string;
  at: string;
}

type Row = InboundMessage & { _id: Types.ObjectId };
const PUBLIC_FOOTER = "You're getting this because you contacted myHoodora.";
const PER_EMAIL_PER_DAY = 5;
const today = () => new Date().toISOString().slice(0, 10);
const keyOf = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex").slice(0, 16);
const titleCase = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1).replace(/_/g, " ")}`;

/**
 * Everything that comes *in* to the team: support, contact, feedback,
 * waitlists (contract §10, §11b, §11c) and the staff inbox (§13.8).
 */
@Injectable()
export class InboundService {
  constructor(
    @InjectModel(InboundMessage.name) private readonly inbound: Model<InboundMessageDocument>,
    @InjectModel(AiPilotRequest.name) private readonly pilots: Model<AiPilotRequest>,
    @InjectModel(TalentProfile.name) private readonly talent: Model<TalentProfile>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly comms: CommunicationsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  // ── Neighbours (signed in) ─────────────────────────────────────────────────

  async feedback(viewer: Viewer, dto: FeedbackDto): Promise<void> {
    await this.inbound.create({
      source: "feedback",
      kind: dto.kind,
      subject: `App feedback: ${dto.kind}`,
      uid: viewer.uid,
      name: viewer.displayName,
      email: viewer.email,
      path: dto.path,
      priority: dto.kind === "problem" ? "normal" : "low",
      messages: [{ from: "user", body: dto.message, at: new Date() }],
    });
  }

  async support(viewer: Viewer, dto: SupportRequestDto): Promise<{ id: string; status: "received" }> {
    const doc = await this.inbound.create({
      source: "in_app",
      kind: dto.topic,
      subject: `${titleCase(dto.topic)} help request`,
      uid: viewer.uid,
      name: viewer.displayName,
      email: viewer.email,
      priority: dto.topic === "safety" ? "high" : "normal",
      messages: [{ from: "user", body: dto.message, at: new Date() }],
    });
    return { id: String(doc._id), status: "received" };
  }

  // ── Public forms ───────────────────────────────────────────────────────────

  private async perEmailLimit(email: string): Promise<void> {
    const n = await this.inbound.countDocuments({ email: email.toLowerCase(), createdAt: { $gt: new Date(Date.now() - 86_400_000) } }).exec();
    if (n >= PER_EMAIL_PER_DAY) throw new HttpException("We've already received several messages from this address today. We'll reply soon.", HttpStatus.TOO_MANY_REQUESTS);
  }

  /** POST /contact. Safety messages are high priority (trust team first). */
  async contact(dto: ContactDto): Promise<{ id: string; status: "received" }> {
    await this.perEmailLimit(dto.email);
    const doc = await this.inbound.create({
      source: "contact_form",
      kind: dto.topic,
      subject: `${titleCase(dto.topic)} enquiry${dto.organisation ? ` · ${dto.organisation}` : ""}`,
      name: dto.name.trim(),
      email: dto.email,
      organisation: dto.organisation,
      priority: dto.topic === "safety" ? "high" : "normal",
      messages: [{ from: "user", body: dto.message.trim(), at: new Date() }],
    });
    await this.comms.sendEmail({
      to: dto.email,
      type: "contact_ack",
      email: messageEmail({
        subject: "We got your message",
        name: dto.name,
        paragraphs: [
          dto.topic === "safety"
            ? "Thanks for telling us. Our trust and safety team reads these first and will get back to you as soon as possible. If anyone is in immediate danger, call 112 or 767 (Lagos emergency) now."
            : "Thanks for getting in touch. A member of the team will reply to this address, usually within two working days.",
        ],
        footer: PUBLIC_FOOTER,
      }),
      // One acknowledgement per address per day, however many messages.
      idempotencyKey: `contact-ack:${keyOf(dto.email)}:${today()}`,
    });
    return { id: String(doc._id), status: "received" };
  }

  /** POST /careers/talent-network. Re-joining updates your details. */
  async joinTalent(dto: TalentDto): Promise<{ id: string; status: "joined" }> {
    const doc = await this.talent
      .findOneAndUpdate({ email: dto.email.toLowerCase() }, { $set: { ...dto, email: dto.email.toLowerCase() } }, { upsert: true, returnDocument: "after" })
      .lean<TalentProfile & { _id: Types.ObjectId }>()
      .exec();
    await this.comms.sendEmail({
      to: dto.email,
      type: "talent_ack",
      email: messageEmail({
        subject: "You're in the myHoodora talent network",
        name: dto.name,
        paragraphs: ["Thanks for your interest in building stronger hoods with us. We'll reach out when a role that fits you opens up."],
        footer: PUBLIC_FOOTER,
      }),
      idempotencyKey: `talent-ack:${keyOf(dto.email)}`,
    });
    return { id: String(doc!._id), status: "joined" };
  }

  /** POST /ai/pilot-requests. De-duplicated on email + institution. */
  async joinAiPilot(dto: AiPilotDto): Promise<{ id: string; status: "waitlisted" }> {
    const institutionKey = dto.institution.trim().toLowerCase().replace(/\s+/g, " ");
    const doc = await this.pilots
      .findOneAndUpdate(
        { email: dto.email.toLowerCase(), institutionKey },
        { $set: { ...dto, email: dto.email.toLowerCase(), institution: dto.institution.trim(), institutionKey } },
        { upsert: true, returnDocument: "after" },
      )
      .lean<AiPilotRequest & { _id: Types.ObjectId }>()
      .exec();
    await this.comms.sendEmail({
      to: dto.email,
      type: "ai_pilot_ack",
      email: messageEmail({
        subject: "You're on the myHoodora AI pilot waitlist",
        name: dto.name,
        paragraphs: [`Thanks for your interest in bringing myHoodora AI to ${dto.institution.trim()}. We're onboarding pilot schools in small groups and will email you when it's your turn.`],
        footer: PUBLIC_FOOTER,
      }),
      idempotencyKey: `ai-pilot-ack:${keyOf(`${dto.email}|${institutionKey}`)}`,
    });
    return { id: String(doc!._id), status: "waitlisted" };
  }

  // ── Staff inbox (§13.8) ────────────────────────────────────────────────────

  openCount(): Promise<number> {
    return this.inbound.countDocuments({ status: "open" }).exec();
  }

  async list(q: InboxQuery): Promise<Page<InboxThreadView>> {
    const re = searchRegex(q.q);
    const filter: QueryFilter<InboundMessage> = {
      ...(q.status && { status: q.status }),
      ...(q.source && { source: q.source === "contact_form" ? { $in: ["contact_form", "contact"] } : q.source }),
      ...(q.topic && { kind: q.topic }),
      ...(re && { $or: [{ subject: re }, { name: re }, { email: re }, { "messages.body": re }, { message: re }] }),
    };
    // Oldest first; each page is then ordered urgent-first.
    const [rows, total] = await Promise.all([
      this.inbound.find(filter).sort({ updatedAt: 1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean<Row[]>().exec(),
      this.inbound.countDocuments(filter).exec(),
    ]);
    const rank = { high: 0, normal: 1, low: 2 } as const;
    const views = await this.toViews(rows);
    views.sort((a, b) => rank[a.priority] - rank[b.priority] || a.updatedAt.localeCompare(b.updatedAt));
    return { items: views, page: q.page, pageSize: q.pageSize, total };
  }

  async get(id: string): Promise<InboxThreadView> {
    const row = Types.ObjectId.isValid(id) ? await this.inbound.findById(id).lean<Row>().exec() : null;
    if (!row) throw new NotFoundException("Conversation not found.");
    return (await this.toViews([row]))[0]!;
  }

  async reply(actor: Viewer, id: string, body: string, resolve = false): Promise<InboxThreadView> {
    const thread = await this.get(id);
    if (!thread.from.email && !thread.from.uid) throw new BadRequestException("There's no way to reach this person.");
    const at = new Date();
    await this.inbound
      .updateOne({ _id: id }, { $push: { messages: { from: "staff", body, at, by: actor.displayName ?? "myHoodora team" } }, $set: { status: resolve ? "resolved" : "waiting" } })
      .exec();
    await this.audit.record(actor, "inbox_reply", { type: "inbox", id, label: thread.subject });
    if (thread.from.uid) {
      await this.notifications.notify({ uids: [thread.from.uid], type: "system", title: "The myHoodora team replied", body: body.slice(0, 140), href: "/help" });
    }
    if (thread.from.email) {
      await this.comms.sendEmail({
        uid: thread.from.uid,
        to: thread.from.email,
        type: "inbox_reply",
        email: messageEmail({
          subject: `Re: ${thread.subject}`,
          name: thread.from.name,
          paragraphs: [body, "Reply to this email if you need anything else."],
          footer: thread.from.uid ? undefined : PUBLIC_FOOTER,
        }),
        idempotencyKey: `inbox-reply:${id}:${at.getTime()}`,
      });
    }
    return this.get(id);
  }

  async update(actor: Viewer, id: string, dto: InboxUpdateDto): Promise<InboxThreadView> {
    await this.get(id);
    const set: Record<string, unknown> = {};
    if (dto.status) set.status = dto.status;
    if (dto.priority) set.priority = dto.priority;
    if (dto.assignToMe) set.assignee = { uid: actor.uid, displayName: actor.displayName ?? "Staff" };
    else if (dto.assigneeUid) {
      const staff = await this.users.findOne({ uid: dto.assigneeUid, role: { $ne: "member" } }).lean<User>().exec();
      if (!staff) throw new BadRequestException("Assign to a member of the team.");
      set.assignee = { uid: staff.uid, displayName: staff.displayName ?? "Staff" };
    }
    await this.inbound.updateOne({ _id: id }, { $set: set }).exec();
    return this.get(id);
  }

  async signups(type: "ai_pilot" | "talent"): Promise<SignupEntry[]> {
    if (type === "ai_pilot") {
      const rows = await this.pilots.find().sort({ createdAt: -1 }).limit(1000).lean<(AiPilotRequest & { _id: Types.ObjectId })[]>().exec();
      return rows.map((r) => ({
        id: String(r._id),
        type,
        name: r.name,
        email: r.email,
        detail: [r.institution, r.institutionType, r.role, r.subjects].filter(Boolean).join(" · "),
        at: (r.createdAt ?? new Date()).toISOString(),
      }));
    }
    const rows = await this.talent.find().sort({ createdAt: -1 }).limit(1000).lean<(TalentProfile & { _id: Types.ObjectId })[]>().exec();
    return rows.map((r) => ({
      id: String(r._id),
      type,
      name: r.name,
      email: r.email,
      detail: [titleCase(r.team), r.city, r.link, r.note].filter(Boolean).join(" · "),
      at: (r.createdAt ?? new Date()).toISOString(),
    }));
  }

  private async toViews(rows: Row[]): Promise<InboxThreadView[]> {
    const uids = [...new Set(rows.filter((r) => r.uid && (!r.email || !r.name)).map((r) => r.uid!))];
    const users = uids.length ? await this.users.find({ uid: { $in: uids } }).select({ uid: 1, email: 1, displayName: 1 }).lean<User[]>().exec() : [];
    const byUid = new Map(users.map((u) => [u.uid, u]));
    return rows.map((r) => {
      const source: InboxSource = r.source === "contact" ? "contact_form" : (r.source as InboxSource);
      const u = r.uid ? byUid.get(r.uid) : undefined;
      // Pass-1 rows stored the first message in `message` only.
      const messages = r.messages?.length ? r.messages : r.message ? [{ from: "user" as const, body: r.message, at: r.createdAt ?? new Date() }] : [];
      return {
        id: String(r._id),
        source,
        topic: r.kind,
        subject: r.subject ?? (source === "feedback" ? "App feedback" : `${titleCase(r.kind)} enquiry`),
        from: { uid: r.uid, name: r.name ?? u?.displayName ?? "Neighbour", email: r.email ?? u?.email ?? "" },
        status: r.status,
        priority: r.priority ?? "normal",
        assignee: r.assignee,
        messages: messages.map((m) => ({ from: m.from, body: m.body, at: new Date(m.at).toISOString(), by: m.by })),
        createdAt: (r.createdAt ?? new Date()).toISOString(),
        updatedAt: (r.updatedAt ?? new Date()).toISOString(),
      };
    });
  }
}
