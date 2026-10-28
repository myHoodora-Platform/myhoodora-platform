import { BadRequestException, ForbiddenException, GoneException, HttpException, HttpStatus, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types, type QueryFilter } from "mongoose";
import { ListingsService } from "../listings/listings.service";
import { ModerationRegistry } from "../moderation/moderation-registry";
import { RealtimeService, TYPING_SIGNAL_MS } from "../realtime/realtime.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { THREAD_PAGE_MAX, type ThreadPageQuery } from "../shared/http/pagination";
import { User, UserDocument } from "../users/schemas/user.schema";
import { AccountLifecycle, DELETED_USER_UID } from "../users/account-lifecycle";
import { UsersService } from "../users/users.service";
import { StorageService } from "../storage/storage.service";
import type { MUTE_FOR, StartConversationDto } from "./chat.dto";
import { Conversation, ConversationDocument, Message, type ChatContext, type ConversationMember } from "./chat.schemas";

export interface ConversationView {
  _id: string;
  participantUids: string[];
  participants: { uid: string; displayName: string; photoURL?: string }[];
  context?: ChatContext;
  lastMessage?: { body: string; senderUid: string; createdAt: string };
  unreadCount: number;
  readBy: { uid: string; lastReadAt?: string }[];
  updatedAt: string;
  /** Viewer-relative (2026-10-28): you archived it; you muted it (until when). */
  archived: boolean;
  mutedUntil?: string;
}

export interface MessageView {
  _id: string;
  conversationId: string;
  senderUid: string;
  body: string;
  /** Photos sent with it (2026-10-28). */
  photos?: string[];
  createdAt: string;
}

type ConvRow = Conversation & { _id: Types.ObjectId; updatedAt?: Date };
/** Anti-spam: new threads a neighbour may start per rolling day. */
const MAX_NEW_THREADS_PER_DAY = 20;
const MAX_PHOTOS = 4;
const HOUR_MS = 3_600_000;
/** "Until I turn it back on": far enough to never come. */
const MUTED_FOREVER = new Date("9999-12-31T00:00:00Z");
/** What the inbox shows for a message that is only photos. */
const PHOTO_PREVIEW = "📷 Photo";

const memberOf = (c: Pick<ConvRow, "members">, uid: string): ConversationMember | undefined => c.members.find((m) => m.uid === uid);
/** Deleted for them, and nothing new since: it stays out of their inbox. */
const clearedFor = (c: ConvRow, uid: string) => {
  const cleared = memberOf(c, uid)?.clearedAt;
  return !!cleared && (!c.lastMessage || new Date(c.lastMessage.createdAt) <= new Date(cleared));
};
const isMuted = (m: ConversationMember | undefined, now = Date.now()) => !!m?.mutedUntil && new Date(m.mutedUntil).getTime() > now;

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
    private readonly accounts: AccountLifecycle,
    private readonly storage: StorageService,
  ) {}

  /** Reports use targetType "message" with the conversation id (contract §5). */
  onModuleInit() {
    this.accounts.register({ name: "chat", purge: (uid, dryRun) => this.purgeParticipant(uid, dryRun) });
    // A photo stays while a message carries it (StorageService.sweepUnreferenced).
    this.storage.registerReferenceSource({
      name: "messages",
      inUse: async (urls) => {
        const rows = await this.messages.find({ photos: { $in: urls } }).select({ photos: 1 }).lean<Pick<Message, "photos">[]>().exec();
        return rows.flatMap((r) => r.photos ?? []);
      },
    });
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
          // No single author: the reported party is whoever didn't file the report (ModerationService.fileReport).
          participantUids: c.participantUids,
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

  /**
   * An account is being deleted. The other person keeps every conversation, with both sides of it:
   * it is their correspondence too. What goes is the deleted person's id, replaced everywhere by a
   * stand-in that clients show as "Deleted User" and that points at nobody.
   */
  private async purgeParticipant(uid: string, dryRun: boolean): Promise<Record<string, number>> {
    const theirs = await this.conversations.find({ participantUids: uid }).lean<ConvRow[]>().exec();
    const ids = theirs.map((c) => String(c._id));
    const sent = { conversationId: { $in: ids }, senderUid: uid };
    const counts = { conversations: ids.length, messages: ids.length ? await this.messages.countDocuments(sent).exec() : 0 };
    if (dryRun || !ids.length) return counts;
    const swap = (u: string) => (u === uid ? DELETED_USER_UID : u);
    await this.messages.updateMany(sent, { $set: { senderUid: DELETED_USER_UID } }).exec();
    for (const c of theirs) {
      await this.conversations
        .updateOne(
          { _id: c._id },
          {
            $set: {
              participantUids: c.participantUids.map(swap),
              members: c.members.map((m) => ({ ...m, uid: swap(m.uid) })),
              startedBy: swap(c.startedBy),
              // The key was built from both uids. Nobody can start a conversation with the stand-in, so it only has to stay unique.
              threadKey: `deleted:${String(c._id)}`,
              ...(c.lastMessage && { lastMessage: { ...c.lastMessage, senderUid: swap(c.lastMessage.senderUid) } }),
            },
          },
          // Not "activity": the other person's inbox keeps its order.
          { timestamps: false },
        )
        .exec();
    }
    return counts;
  }

  /** Has `from` ever sent `to` a message, in any conversation the two share? */
  private async hasWrittenTo(from: string, to: string): Promise<boolean> {
    const shared = await this.conversations.find({ participantUids: { $all: [from, to] } }).select({ _id: 1 }).lean<{ _id: Types.ObjectId }[]>().exec();
    if (!shared.length) return false;
    return Boolean(await this.messages.exists({ conversationId: { $in: shared.map((c) => String(c._id)) }, senderUid: from }).exec());
  }

  private async blockedBetween(a: string, b: string): Promise<boolean> {
    return (await this.users.hiddenAuthorsFor(a)).includes(b);
  }

  /**
   * Your conversations, newest activity first. Archived ones only with `archived` (and only them);
   * ones you deleted stay out until something new arrives.
   */
  async list(viewer: Viewer, opts: { archived?: boolean } = {}): Promise<ConversationView[]> {
    const hidden = await this.users.hiddenAuthorsFor(viewer.uid);
    const mine = { uid: viewer.uid, archivedAt: { $ne: null } };
    const rows = await this.conversations
      .find({
        participantUids: viewer.uid,
        removedAt: null,
        lastMessage: { $exists: true },
        members: opts.archived ? { $elemMatch: mine } : { $not: { $elemMatch: mine } },
      })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean<ConvRow[]>()
      .exec();
    return this.toViews(
      rows.filter((c) => !c.participantUids.some((u) => hidden.includes(u)) && !clearedFor(c, viewer.uid)),
      viewer.uid,
    );
  }

  /** Out of your inbox (or back in). Something new arriving brings it back by itself. */
  async setArchived(viewer: Viewer, id: string, archived: boolean): Promise<void> {
    await this.load(viewer, id);
    await this.conversations
      .updateOne({ _id: id }, { $set: { "members.$[me].archivedAt": archived ? new Date() : null } }, { arrayFilters: [{ "me.uid": viewer.uid }], timestamps: false })
      .exec();
  }

  /** No notifications from this conversation for a while, or until turned back on. Unread still counts. */
  async setMuted(viewer: Viewer, id: string, length: (typeof MUTE_FOR)[number]): Promise<{ mutedUntil: string | null }> {
    await this.load(viewer, id);
    const until = length === "off" ? null : length === "always" ? MUTED_FOREVER : new Date(Date.now() + (length === "8h" ? 8 : 7 * 24) * HOUR_MS);
    await this.conversations
      .updateOne({ _id: id }, { $set: { "members.$[me].mutedUntil": until } }, { arrayFilters: [{ "me.uid": viewer.uid }], timestamps: false })
      .exec();
    return { mutedUntil: until?.toISOString() ?? null };
  }

  /**
   * Delete for you (WhatsApp's "Delete chat"): it leaves your inbox and its messages so far are
   * hidden from you. The other person keeps everything. If they write again, the conversation comes
   * back with only the new messages.
   */
  async clearForMe(viewer: Viewer, id: string): Promise<void> {
    await this.load(viewer, id);
    await this.conversations
      .updateOne(
        { _id: id },
        { $set: { "members.$[me].clearedAt": new Date(), "members.$[me].archivedAt": null, "members.$[me].unread": 0 } },
        { arrayFilters: [{ "me.uid": viewer.uid }], timestamps: false },
      )
      .exec();
    this.realtime.toUsers([viewer.uid], "chat.read", { conversationId: id });
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
    const recipient = await this.userModel.findOne({ uid: dto.recipientUid }).lean<User>().exec();
    if (recipient && (recipient.deactivatedAt || recipient.purgedAt)) {
      throw new GoneException("This account has been deactivated, so you can't message them.");
    }
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
    // "Only people I've messaged": someone the recipient has themselves written to, in any conversation between the two.
    const closed = pref === "nobody" || (pref === "contacts" && !(await this.hasWrittenTo(recipient.uid, viewer.uid)));
    const name = recipient.displayName ?? "This neighbour";
    if (closed) throw new ForbiddenException(`${name} has restricted who can message them and isn't accepting new messages.`);
    if (pref === "neighbourhood" && recipient.neighborhoodId !== viewer.hoodId && !context) {
      throw new ForbiddenException(`${name} is outside your neighbourhood, so you can't start a conversation. Neighbours can only message people in their own neighbourhood.`);
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

  /**
   * A page of the thread, oldest first: the newest messages, or with `before` the ones just earlier
   * than that message. (It used to be the oldest 500 with no way past them, so in a long thread
   * new messages were stored and never shown.) Opening the newest page marks the thread read for the caller.
   */
  async listMessages(viewer: Viewer, id: string, q: ThreadPageQuery = {}): Promise<MessageView[]> {
    const c = await this.load(viewer, id);
    const filter: QueryFilter<Message> = { conversationId: id };
    // Deleted for them: what came before stays hidden from them.
    const cleared = memberOf(c, viewer.uid)?.clearedAt;
    if (cleared) filter.createdAt = { $gt: new Date(cleared) };
    if (q.before) {
      const cursor = await this.messages.findOne({ _id: q.before, conversationId: id }).select({ createdAt: 1 }).lean<Pick<Message, "createdAt"> & { _id: Types.ObjectId }>().exec();
      // Not a message of this thread: there is nothing "before" it here.
      if (!cursor) return [];
      filter.$and = [{ $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }] }];
    }
    const newestFirst = await this.messages
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(q.limit ?? THREAD_PAGE_MAX)
      .lean<(Message & { _id: Types.ObjectId })[]>()
      .exec();
    const rows = newestFirst.reverse();
    // Reading back through earlier messages is not reading the new ones.
    if (q.before) return rows.map(toMessage);
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

  /** "… is typing": to the other member only; ephemeral, never stored. */
  async typing(viewer: Viewer, id: string): Promise<void> {
    if (!this.realtime.gate(`typing:${viewer.uid}:${id}`, TYPING_SIGNAL_MS)) return;
    const c = await this.load(viewer, id);
    this.realtime.toUsers(
      c.participantUids.filter((u) => u !== viewer.uid),
      "chat.typing",
      { conversationId: id },
    );
  }

  async send(viewer: Viewer, id: string, body: string | undefined, photos: string[] = []): Promise<MessageView> {
    const c = await this.load(viewer, id);
    const text = (body ?? "").trim();
    if (!text && !photos.length) throw new BadRequestException("Write a message first.");
    await this.assertOwnMessagePhotos(viewer, photos);
    const others = c.participantUids.filter((u) => u !== viewer.uid);
    // They can still read it; there is nobody left to write to.
    if (others.includes(DELETED_USER_UID)) throw new ForbiddenException("This person has deleted their account, so they can't receive messages.");
    if (await this.blockedBetween(viewer.uid, others[0]!)) throw new ForbiddenException("You can't message this neighbour.");

    const msg = await withTransaction(this.connection, async (session) => {
      const [m] = await this.messages.create([{ conversationId: id, senderUid: viewer.uid, body: text, ...(photos.length && { photos }) }], { session });
      await this.conversations
        .updateOne(
          { _id: id },
          {
            $set: {
              lastMessage: { body: (text || PHOTO_PREVIEW).slice(0, 200), senderUid: viewer.uid, createdAt: m!.createdAt },
              "members.$[me].lastReadAt": new Date(),
              "members.$[me].unread": 0,
              // Something new brings an archived conversation back to everyone's inbox.
              "members.$[].archivedAt": null,
            },
            $inc: { "members.$[other].unread": 1 },
          },
          { arrayFilters: [{ "me.uid": viewer.uid }, { "other.uid": { $ne: viewer.uid } }], session },
        )
        .exec();
      return m!;
    });

    // Muted: no notification, though it still counts as unread.
    const listening = others.filter((u) => !isMuted(memberOf(c, u)));
    if (listening.length) await this.notifications.notify({
      uids: listening,
      type: "message",
      actorUid: viewer.uid,
      title: `${viewer.displayName ?? "A neighbour"} ${text ? "sent you a message" : photos.length > 1 ? "sent you photos" : "sent you a photo"}`,
      body: (text || PHOTO_PREVIEW).slice(0, 140),
      href: `/inbox/${id}`,
      category: "messages",
      groupKey: `conversation:${id}`,
    });
    // Everyone in the thread, including the sender's other tabs.
    this.realtime.toUsers(c.participantUids, "chat.message", { conversationId: id });
    return toMessage(msg.toObject() as Message & { _id: Types.ObjectId });
  }

  /** Message photos must be photos the sender uploaded for messages: never someone else's, never a link to anywhere. */
  private async assertOwnMessagePhotos(viewer: Viewer, photos: string[]): Promise<void> {
    if (!photos.length) return;
    if (photos.length > MAX_PHOTOS) throw new BadRequestException(`Send up to ${MAX_PHOTOS} photos at a time.`);
    if (new Set(photos).size !== photos.length) throw new BadRequestException("The same photo is in there twice.");
    const known = await this.storage.describe(photos);
    const ok = photos.every((u) => {
      const a = known.get(u);
      return a && a.ownerUid === viewer.uid && a.purpose === "message" && a.resourceType === "image";
    });
    if (!ok) throw new BadRequestException("Those photos couldn't be attached. Add them again.");
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
      archived: !!memberOf(c, uid)?.archivedAt,
      ...(isMuted(memberOf(c, uid)) && { mutedUntil: new Date(memberOf(c, uid)!.mutedUntil!).toISOString() }),
    }));
  }
}

function toMessage(m: Message & { _id: Types.ObjectId }): MessageView {
  return {
    _id: String(m._id),
    conversationId: m.conversationId,
    senderUid: m.senderUid,
    body: m.body ?? "",
    ...(m.photos?.length && { photos: m.photos }),
    createdAt: (m.createdAt ?? new Date()).toISOString(),
  };
}
