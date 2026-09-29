import { Body, Controller, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Equals, IsBoolean } from "class-validator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { NotificationsService } from "./notifications.service";

class MarkReadDto {
  @IsBoolean()
  @Equals(true)
  read!: true;
}

/** Contract §6. Every query is filtered by the caller's uid. */
@ApiTags("notifications")
@ApiBearerAuth("firebase-jwt")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentViewer() viewer: Viewer) {
    return this.notifications.list(viewer.uid);
  }

  @Get("unread-count")
  async unread(@CurrentViewer() viewer: Viewer) {
    return { count: await this.notifications.unreadCount(viewer.uid) };
  }

  @Patch(":id")
  markRead(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() _body: MarkReadDto) {
    return this.notifications.markRead(viewer.uid, id);
  }

  @Post("read-all")
  @HttpCode(204)
  async readAll(@CurrentViewer() viewer: Viewer) {
    await this.notifications.markAllRead(viewer.uid);
  }
}
