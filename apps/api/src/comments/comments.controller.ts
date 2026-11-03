import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe, ThreadPageQuery } from "../shared/http/pagination";
import { CommentsService } from "./comments.service";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";

class CreateCommentDto {
  @IsString()
  @Length(1, 1000)
  content!: string;

  /** Reply to this comment (contract §2). */
  @IsOptional()
  @IsMongoId()
  parentId?: string;

  /** The app's id for this submission: sending it again returns the same comment. */
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, { message: "clientId must be 8 to 64 letters, digits, hyphens or underscores" })
  clientId?: string;
}

class CommentListQuery extends ThreadPageQuery {
  /** "root" for top-level comments (threaded view), or a comment id for its replies. Leave out for the old flat list. */
  @IsOptional()
  @Matches(/^(root|[a-f0-9]{24})$/i, { message: "thread must be root or a comment id" })
  thread?: string;

  /** Top-level order in the threaded view. Default top (most relevant). */
  @IsOptional()
  @IsIn(["top", "newest", "oldest"])
  sort?: "top" | "newest" | "oldest";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset?: number;
}

@ApiTags("comments")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get("posts/:id/comments")
  @ApiOperation({
    summary: "Comments on a post: the newest page, oldest first (blocked people hidden)",
    description: "Up to 500 at a time (`limit`). A full page means there may be earlier ones: pass the id of the oldest you have as `before` to get the page before it.",
  })
  @ApiOkResponse()
  @ApiNotFound("Post")
  list(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Query() q: CommentListQuery) {
    return this.comments.list(viewer, id, q);
  }

  @Post("posts/:id/comments")
  @ApiOperation({ summary: "Comment on a post (verified neighbours); notifies the author" })
  @Can("content.create")
  @Throttle({ medium: { limit: 20, ttl: 60_000 } })
  @ApiCreatedResponse()
  @ApiNotFound("Post")
  create(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: CreateCommentDto) {
    return this.comments.create(viewer, id, { content: body.content, parentId: body.parentId, clientId: body.clientId });
  }

  @Put("comments/:id/like")
  @ApiOperation({ summary: "Like a comment → { likeCount, liked }" })
  @Can("content.react")
  @ApiOkResponse()
  @ApiNotFound("Comment")
  like(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.comments.setLiked(viewer, id, true);
  }

  @Delete("comments/:id/like")
  @ApiOperation({ summary: "Take your like back → { likeCount, liked }" })
  @Can("content.react")
  @ApiOkResponse()
  @ApiNotFound("Comment")
  unlike(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.comments.setLiked(viewer, id, false);
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
