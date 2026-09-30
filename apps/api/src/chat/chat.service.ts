import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types } from "mongoose";
import { ListingsService } from "../listings/listings.service";
import { ModerationRegistry } from "../moderation/moderation-registry";
import { RealtimeService } from "../realtime/realtime.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { User, UserDocument } from "../users/schemas/user.schema";
import { UsersService } from "../users/users.service";
import type { StartConversationDto } from "./chat.dto";
import { Conversation, ConversationDocument, Message, type ChatContext } from "./chat.schemas";

export interface ConversationView {
  _id: string;
  participantUids: string[];
  participants: { uid: string; displayName: string; photoURL?: string }[];
  context?: ChatContext;
  lastMessage?: { body: string; senderUid: string; createdAt: string };
  unreadCount: number;
  readBy: { uid: string; lastReadAt?: string }[];
  updatedAt: string;
}

export interface MessageView {
  _id: string;
  conversationId: string;
  senderUid: string;
  body: string;
  createdAt: string;
}

type ConvRow = Conversation & { _id: Types.ObjectId; updatedAt?: Date };
/** Anti-spam: new threads a neighbour may start per rolling day. */
const MAX_NEW_THREADS_PER_DAY = 20;

@Injectable()
export class ChatService implements OnModuleInit {
  constructor(
    @InjectModel(Conversation.name) private readonly conversations: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly users: UsersService,
    private readonly listings: ListingsService,
    private readonly notifications: NotificationsService,
    private readonly registry: ModerationRegistry,
    private readonly realtime: RealtimeService,
  ) {}

  /** Reports use targetType "message" with the conversation id (contract §5). */
  onModuleInit() {
    this.registry.register({
      type: "message",
      load: async (id) => {
        const c = Types.ObjectId.isValid(id) ? await this.conversations.findById(id).lean<ConvRow>().exec() : null;
        if (!c) return null;
        const recent = await this.messages.find({ conversationId: id }).sort({ createdAt: -1 }).limit(20).lean<Message[]>().exec();
        return {
          type: "message",
          id,
          preview: recent[0]?.body.slice(0, 200) ?? "Conversation",
          // The reported party is whoever didn't file the report; moderation shows both.
          authorUid: c.startedBy,
          removed: Boolean(c.removedAt),
          content: {
            kind: "conversation",
            participants: c.participantUids,
            messages: recent.reverse().map((m) => ({ senderUid: m.senderUid, body: m.body, createdAt: m.createdAt?.toISOString() })),
            removed: Boolean(c.removedAt),
          },
        };
      },
      setRemoved: async (id, removed, _actor, session) => {
        await this.conversations.updateOne({ _id: id }, { $set: { removedAt: removed ? new Date() : null } }, { session }).exec();
      },
    });
  }

  private async load(viewer: Viewer, id: string): Promise<ConvRow> {
    const c = Types.ObjectId.isValid(id) ? await this.conversations.findById(id).lean<ConvRow>().exec() : null;
    if (!c || c.removedAt || !c.participantUids.includes(viewer.uid)) throw new NotFoundException("Conversation not found.");
    return c;
  }

  private async blockedBetween(a: string, b: string): Promise<boolean> {
    return (await this.users.hiddenAuthorsFor(a)).includes(b);
  }

  async list(viewer: Viewer): Promise<ConversationView[]> {
    const hidden = await this.users.hiddenAuthorsFor(viewer.uid);
    const rows = await this.conversations
      .find({ participantUids: viewer.uid, removedAt: null, lastMessage: { $exists: true } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean<ConvRow[]>()
      .exec();
    return this.toViews(rows.filter((c) => !c.participantUids.some((u) => hidden.includes(u))), viewer.uid);
  }

  async get(viewer: Viewer, id: string): Promise<ConversationView> {
    return (await this.toViews([await this.load(viewer, id)], viewer.uid))[0]!;
  }

  async unreadCount(viewer: Viewer): Promise<{ count: number }> {
    const rows = await this.conversations
      .find({ participantUids: viewer.uid, removedAt: null })
      .select({ members: 1 })
      .lean<Pick<ConvRow, "members">[]>()
      .exec();
    return { count: rows.reduce((n, c) => n + (c.members.find((m) => m.uid === viewer.uid)?.unread ?? 0), 0) };
  }

  /** Idempotent per pair + context: tapping "Message seller" twice reuses the thread. */
  async start(viewer: Viewer, dto: StartConversationDto): Promise<ConversationView> {
    if (dto.recipientUid === viewer.uid) throw new BadRequestException("You can't message yourself.");
    const recipient = await this.userModel.findOne({ uid: dto.recipientUid, deactivatedAt: null }).lean<User>().exec();
    if (!recipient || recipient.accountStatus === "suspended" || (await this.blockedBetween(viewer.uid, dto.recipientUid))) {
      throw new NotFoundException("This neighbour isn't available.");
    }

    let context: ChatContext | undefined;
    if (dto.context) {
      // Never trust the client's copy of the listing.
      const l = await this.listings.get(viewer, dto.context.id);
      if (l.sellerUid !== dto.recipientUid) throw new BadRequestException("That listing belongs to someone else.");
      context = { type: "listing", id: l._id, title: l.title, photo: l.photos[0], priceNaira: l.priceNaira };
    }

    const participantUids = [viewer.uid, dto.recipientUid].sort();
    const threadKey = `${participantUids.join(":")}:${context?.id ?? "direct"}`;
    const existing = await this.conversations.findOne({ threadKey }).lean<ConvRow>().exec();
    if (existing) {
      if (existing.removedAt) throw new ForbiddenException("This conversation was closed by our team.");
      return (await this.toViews([existing], viewer.uid))[0]!;
    }

    // New thread: respect the recipient's messaging preference (contract §10).
    const pref = recipient.preferences?.privacy?.messaging ?? "neighbourhood";
    if (pref === "nobody" || pref === "contacts") throw new ForbiddenException(`${recipient.displayName ?? "This neighbour"} isn't accepting new messages.`);
    if (pref === "neighbourhood" && recipient.neighborhoodId !== viewer.hoodId && !context) {
      throw new ForbiddenException(`${recipient.displayName ?? "This neighbour"} only accepts messages from their neighbourhood.`);
    }
    const started = await this.conversations.countDocuments({ startedBy: viewer.uid, createdAt: { $gt: new Date(Date.now() - 86_400_000) } }).exec();
    if (started >= MAX_NEW_THREADS_PER_DAY) throw new HttpException("You've started a lot of conversations today. Try again tomorrow.", HttpStatus.TOO_MANY_REQUESTS);

    try {
      const doc = await this.conversations.create({
        threadKey,
        participantUids,
        members: participantUids.map((uid) => ({ uid, unread: 0 })),
        context,
        startedBy: viewer.uid,
      });
      return (await this.toViews([doc.toObject() as ConvRow], viewer.uid))[0]!;
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      const again = await this.conversations.findOne({ threadKey }).lean<ConvRow>().exec();
      return (await this.toViews([again!], viewer.uid))[0]!;
    }
  }

  /** Oldest first; marks the thread read for the caller. */
  async listMessages(viewer: Viewer, id: string): Promise<MessageView[]> {
    const c = await this.load(viewer, id);
    const rows = await this.messages.find({ conversationId: id }).sort({ createdAt: 1 }).limit(500).lean<(Message & { _id: Types.ObjectId })[]>().exec();
    // Only when there was something unread: announcing every open would make
    // two open threads refetch each other forever.
    const read = await this.conversations
      .updateOne(
        { _id: id, members: { $elemMatch: { uid: viewer.uid, unread: { $gt: 0 } } } },
        { $set: { "members.$[m].unread": 0, "members.$[m].lastReadAt": new Date() } },
        { arrayFilters: [{ "m.uid": viewer.uid }], timestamps: false },
      )
      .exec();
    if (read.modifiedCount) this.realtime.toUsers(c.participantUids, "chat.read", { conversationId: id });
    return rows.map(toMessage);
  }

  async send(viewer: Viewer, id: string, body: string): Promise<MessageView> {
    const c = await this.load(viewer, id);
    const text = body.trim();
    if (!text) throw new BadRequestException("Write a message first.");
    const others = c.participantUids.filter((u) => u !== viewer.uid);
    if (await this.blockedBetween(viewer.uid, others[0]!)) throw new ForbiddenException("You can't message this neighbour.");

    const msg = await withTransaction(this.connection, async (session) => {
      const [m] = await this.messages.create([{ conversationId: id, senderUid: viewer.uid, body: text }], { session });
      await this.conversations
        .updateOne(
          { _id: id },
          {
            $set: { lastMessage: { body: text.slice(0, 200), senderUid: viewer.uid, createdAt: m!.createdAt }, "members.$[me].lastReadAt": new Date(), "members.$[me].unread": 0 },
            $inc: { "members.$[other].unread": 1 },
          },
          { arrayFilters: [{ "me.uid": viewer.uid }, { "other.uid": { $ne: viewer.uid } }], session },
        )
        .exec();
      return m!;
    });

    await this.notifications.notify({
      uids: others,
      type: "message",
      actorUid: viewer.uid,
      title: `${viewer.displayName ?? "A neighbour"} sent you a message`,
      body: text.slice(0, 140),
      href: `/inbox/${id}`,
      category: "messages",
      groupKey: `conversation:${id}`,
    });
    // Everyone in the thread, including the sender's other tabs.
    this.realtime.toUsers(c.participantUids, "chat.message", { conversationId: id });
    return toMessage(msg.toObject() as Message & { _id: Types.ObjectId });
  }

  private async toViews(rows: ConvRow[], uid: string): Promise<ConversationView[]> {
    const cards = await this.users.authorCards(rows.flatMap((r) => r.participantUids));
    return rows.map((c) => ({
      _id: String(c._id),
      participantUids: c.participantUids,
      participants: c.participantUids.map((u) => ({ uid: u, displayName: cards.get(u)?.displayName ?? "Neighbour", photoURL: cards.get(u)?.photoURL })),
      context: c.context,
      lastMessage: c.lastMessage ? { ...c.lastMessage, createdAt: new Date(c.lastMessage.createdAt).toISOString() } : undefined,
      unreadCount: c.members.find((m) => m.uid === uid)?.unread ?? 0,
      // For "Seen": when each person last read the thread.
      readBy: c.members.map((m) => ({ uid: m.uid, lastReadAt: m.lastReadAt ? new Date(m.lastReadAt).toISOString() : undefined })),
      updatedAt: (c.updatedAt ?? new Date()).toISOString(),
    }));
  }
}

function toMessage(m: Message & { _id: Types.ObjectId }): MessageView {
  return { _id: String(m._id), conversationId: m.conversationId, senderUid: m.senderUid, body: m.body, createdAt: (m.createdAt ?? new Date()).toISOString() };
}
