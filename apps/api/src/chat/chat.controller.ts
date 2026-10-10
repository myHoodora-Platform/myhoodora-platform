import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe, ThreadPageQuery } from "../shared/http/pagination";
import { SendMessageDto, StartConversationDto } from "./chat.dto";
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
  @ApiOperation({ summary: "Your conversations, newest activity first (viewer-relative unreadCount)" })
  list(@CurrentViewer() viewer: Viewer) {
    return this.chat.list(viewer);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Unread messages across all conversations → { count }" })
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

  @Post(":id/typing")
  @HttpCode(204)
  @ApiOperation({ summary: "Tell the other neighbour you're typing (live only, nothing stored). Send every few seconds while typing" })
  async typing(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.chat.typing(viewer, id);
  }

  @Post(":id/messages")
  @Can("messages.send")
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Send a message (1–2000 chars); notifies the other neighbour" })
  @ApiCreatedResponse()
  @ApiNotFound("Conversation")
  send(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: SendMessageDto) {
    return this.chat.send(viewer, id, body.body);
  }
}
