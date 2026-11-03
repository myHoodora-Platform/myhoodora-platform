import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe, ThreadPageQuery } from "../shared/http/pagination";
import { AddGroupMembersDto, ArchiveConversationDto, ConversationListQuery, CreateGroupChatDto, EditMessageDto, GroupAdminDto, RenameGroupChatDto, ForwardMessageDto, MuteConversationDto, PinChatDto, PinMessageDto, ReactDto, SendMessageDto, StartConversationDto } from "./chat.dto";
import { ChatService } from "./chat.service";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";

/** Contract §5: private messages between neighbours. Participants only. */
@ApiTags("chat")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("conversations")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  @ApiOperation({ summary: "Your conversations, newest activity first (viewer-relative unreadCount). `archived=true`: only the ones you archived; `requests=true`: only message requests" })
  list(@CurrentViewer() viewer: Viewer, @Query() q: ConversationListQuery) {
    return this.chat.list(viewer, { archived: q.archived === "true", requests: q.requests === "true" });
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Unread messages in your inbox (requests not counted), and message requests waiting → { count, requests }" })
  unread(@CurrentViewer() viewer: Viewer) {
    return this.chat.unreadCount(viewer);
  }

  @Post()
  @Can("messages.send")
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Start (or reuse) a conversation with a neighbour, optionally about a listing. Idempotent" })
  @ApiForbiddenResponse({ description: "The recipient doesn't accept messages from you" })
  @ApiTooManyRequestsResponse({ description: "More than 20 new conversations in 24 h" })
  @ApiCreatedResponse({ description: "The conversation (an existing one is returned if you already have one about the same thing)" })
  start(@CurrentViewer() viewer: Viewer, @Body() body: StartConversationDto) {
    return this.chat.start(viewer, body);
  }

  @Post("groups")
  @Can("messages.send")
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Start a group chat: a name and up to 49 neighbours who accept messages from you. You're its admin" })
  @ApiForbiddenResponse({ description: "Someone chosen doesn't accept messages from you (each is named)" })
  createGroup(@CurrentViewer() viewer: Viewer, @Body() body: CreateGroupChatDto) {
    return this.chat.createGroup(viewer, body.title, body.memberUids);
  }

  @Post("for-group/:groupId")
  @Can("messages.send")
  @ApiOperation({ summary: "A community Group's own chat, for its members (made the first time). Its members follow the Group's" })
  groupChat(@CurrentViewer() viewer: Viewer, @Param("groupId", ParseObjectIdPipe) groupId: string) {
    return this.chat.groupChat(viewer, groupId);
  }

  @Get(":id")
  @ApiOperation({ summary: "One conversation (participants only)" })
  @ApiOkResponse()
  @ApiNotFound("Conversation")
  get(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.chat.get(viewer, id);
  }

  @Get(":id/messages")
  @ApiOperation({
    summary: "Messages: the newest page, oldest first. Marks the conversation read for you",
    description: "Up to 500 at a time (`limit`). A full page means there may be earlier ones: pass the id of the oldest you have as `before` to get the page before it. Earlier pages don't mark anything read.",
  })
  @ApiOkResponse()
  @ApiNotFound("Conversation")
  messages(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Query() q: ThreadPageQuery) {
    return this.chat.listMessages(viewer, id, q);
  }

  @Put(":id/archive")
  @HttpCode(204)
  @ApiOperation({ summary: "Archive (or unarchive) for you. A new message brings it back" })
  @ApiNotFound("Conversation")
  async archive(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ArchiveConversationDto) {
    await this.chat.setArchived(viewer, id, body.archived);
  }

  @Put(":id/pin")
  @ApiOperation({ summary: "Pin to (or off) the top of your inbox; up to 3 (409 past that). Only you see it" })
  @ApiNotFound("Conversation")
  pin(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: PinChatDto) {
    return this.chat.setPinned(viewer, id, body.pinned);
  }

  @Put(":id/messages/:messageId/pin")
  @ApiOperation({ summary: "Pin a message for everyone in the chat for 24h, 7d or 30d; a fourth replaces the oldest. Returns the conversation (with `pins`)" })
  @ApiNotFound("Message")
  pinMessage(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("messageId", ParseObjectIdPipe) messageId: string, @Body() body: PinMessageDto) {
    return this.chat.pinMessage(viewer, id, messageId, body.for);
  }

  @Delete(":id/messages/:messageId/pin")
  @ApiOperation({ summary: "Unpin a message. Returns the conversation" })
  @ApiNotFound("Conversation")
  unpinMessage(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("messageId", ParseObjectIdPipe) messageId: string) {
    return this.chat.unpinMessage(viewer, id, messageId);
  }

  @Put(":id/mute")
  @ApiOperation({ summary: "No notifications from it for 8 hours, a week, until turned back on, or `off`. Unread still counts" })
  @ApiNotFound("Conversation")
  mute(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: MuteConversationDto) {
    return this.chat.setMuted(viewer, id, body.for);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete for you: it leaves your inbox and its messages so far are hidden from you. The other person keeps everything" })
  @ApiNotFound("Conversation")
  async clear(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.chat.clearForMe(viewer, id);
  }

  @Post(":id/typing")
  @HttpCode(204)
  @ApiOperation({ summary: "Tell the other neighbour you're typing (live only, nothing stored). Send every few seconds while typing" })
  async typing(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.chat.typing(viewer, id);
  }

  @Post(":id/messages")
  @Can("messages.send")
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Send a message (up to 2000 chars, and/or up to 4 photos uploaded for messages); notifies the other neighbour unless they muted it" })
  @ApiCreatedResponse()
  @ApiNotFound("Conversation")
  send(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: SendMessageDto) {
    return this.chat.send(viewer, id, body.body, body.photos, body.replyTo);
  }

  @Put(":id/messages/:messageId/reaction")
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "React with one emoji (replaces yours), or `emoji: null` to take it back. Tells the sender" })
  @ApiNotFound("Message")
  react(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("messageId", ParseObjectIdPipe) messageId: string, @Body() body: ReactDto) {
    return this.chat.react(viewer, id, messageId, body.emoji);
  }

  @Patch(":id/messages/:messageId")
  @ApiOperation({ summary: "Edit your own message's words, within 15 minutes. Shows \"Edited\"" })
  @ApiNotFound("Message")
  edit(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("messageId", ParseObjectIdPipe) messageId: string, @Body() body: EditMessageDto) {
    return this.chat.edit(viewer, id, messageId, body.body);
  }

  @Delete(":id/messages/:messageId")
  @ApiOperation({ summary: "Delete your own message for everyone, within 2 days and 12 hours. Shows \"This message was deleted\"" })
  @ApiNotFound("Message")
  removeMessage(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("messageId", ParseObjectIdPipe) messageId: string) {
    return this.chat.removeMessage(viewer, id, messageId);
  }

  @Put(":id/messages/:messageId/hidden")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete for me: hide any message in the chat from yourself only. The other person keeps it" })
  @ApiNotFound("Message")
  async hide(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("messageId", ParseObjectIdPipe) messageId: string) {
    await this.chat.hideForMe(viewer, id, messageId);
  }

  @Post(":id/messages/:messageId/forward")
  @Can("messages.send")
  @Throttle({ medium: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Forward a message to up to 5 chats or neighbours, marked \"Forwarded\". Returns `{ sent: conversationIds, failed: [{ target, message }] }`" })
  @ApiCreatedResponse()
  @ApiNotFound("Message")
  forward(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("messageId", ParseObjectIdPipe) messageId: string, @Body() body: ForwardMessageDto) {
    return this.chat.forward(viewer, id, messageId, body);
  }

  @Put(":id/request")
  @ApiOperation({ summary: "Accept a message request: it moves to your inbox and the sender sees when you've read it" })
  accept(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.chat.acceptRequest(viewer, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Rename a group (its admins)" })
  rename(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: RenameGroupChatDto) {
    return this.chat.renameGroup(viewer, id, body.title);
  }

  @Post(":id/members")
  @Can("messages.send")
  @ApiOperation({ summary: "Add neighbours to a group (its admins). They see messages from now on" })
  addMembers(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: AddGroupMembersDto) {
    return this.chat.addMembers(viewer, id, body.uids);
  }

  @Delete(":id/members/:uid")
  @ApiOperation({ summary: "Remove someone from a group (its admins)" })
  removeMember(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("uid") uid: string) {
    return this.chat.removeMember(viewer, id, uid);
  }

  @Put(":id/admins/:uid")
  @ApiOperation({ summary: "Make someone a group admin, or not (its admins). A group always keeps one" })
  setAdmin(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("uid") uid: string, @Body() body: GroupAdminDto) {
    return this.chat.setAdmin(viewer, id, uid, body.admin);
  }

  @Post(":id/leave")
  @HttpCode(204)
  @ApiOperation({ summary: "Leave a group. If you were its last admin, whoever has been in it longest becomes admin" })
  leave(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.chat.leaveGroup(viewer, id);
  }
}
