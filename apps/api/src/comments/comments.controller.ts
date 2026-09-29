import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsString, Length } from "class-validator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { CommentsService } from "./comments.service";

class CreateCommentDto {
  @IsString()
  @Length(1, 1000)
  content!: string;
}

@ApiTags("comments")
@ApiBearerAuth("firebase-jwt")
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get("posts/:id/comments")
  list(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.comments.list(viewer, id);
  }

  @Post("posts/:id/comments")
  @Can("content.create")
  @Throttle({ medium: { limit: 20, ttl: 60_000 } })
  create(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: CreateCommentDto) {
    return this.comments.create(viewer, id, body.content);
  }

  @Delete("comments/:id")
  @HttpCode(204)
  async delete(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.comments.delete(viewer, id);
  }
}
