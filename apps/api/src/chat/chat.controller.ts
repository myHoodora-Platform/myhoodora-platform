import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { SendMessageDto, StartConversationDto } from "./chat.dto";
import { ChatService } from "./chat.service";
import { ApiStandardErrors } from "../shared/http/api-docs";

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
  start(@CurrentViewer() viewer: Viewer, @Body() body: StartConversationDto) {
    return this.chat.start(viewer, body);
  }

  @Get(":id")
  @ApiOperation({ summary: "One conversation (participants only)" })
  get(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.chat.get(viewer, id);
  }

  @Get(":id/messages")
  @ApiOperation({ summary: "Messages, oldest first. Marks the conversation read for you" })
  messages(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.chat.listMessages(viewer, id);
  }

  @Post(":id/messages")
  @Can("messages.send")
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Send a message (1–2000 chars); notifies the other neighbour" })
  send(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: SendMessageDto) {
    return this.chat.send(viewer, id, body.body);
  }
}
