import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsString, Length } from "class-validator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { CommentsService } from "./comments.service";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";

class CreateCommentDto {
  @IsString()
  @Length(1, 1000)
  content!: string;
}

@ApiTags("comments")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get("posts/:id/comments")
  @ApiOperation({ summary: "Comments on a post, oldest first (blocked people hidden)" })
  @ApiOkResponse()
  @ApiNotFound("Post")
  list(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.comments.list(viewer, id);
  }

  @Post("posts/:id/comments")
  @ApiOperation({ summary: "Comment on a post (verified neighbours); notifies the author" })
  @Can("content.create")
  @Throttle({ medium: { limit: 20, ttl: 60_000 } })
  @ApiCreatedResponse()
  @ApiNotFound("Post")
  create(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: CreateCommentDto) {
    return this.comments.create(viewer, id, body.content);
  }

  @Delete("comments/:id")
  @ApiOperation({ summary: "Delete a comment (author or staff)" })
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFound("Comment")
  async delete(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.comments.delete(viewer, id);
  }
}
