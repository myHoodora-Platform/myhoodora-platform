import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { CreatePostDto, FeedQuery, ReactionDto, ResolveAlertDto, RsvpDto, VoteDto } from "./dto/posts.dto";
import { EngagementService } from "./engagement.service";
import { PostsService } from "./posts.service";

@ApiTags("posts")
@ApiBearerAuth("firebase-jwt")
@Controller("posts")
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly engagement: EngagementService,
  ) {}

  @Post()
  @Can("content.create")
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Create a post in the caller's own Hood" })
  create(@CurrentViewer() viewer: Viewer, @Body() body: CreatePostDto) {
    return this.posts.create(viewer, body);
  }

  @Get("neighborhood/:id")
  @ApiOperation({ summary: "Feed for the caller's Hood (?limit&before|skip&category&since)" })
  feed(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Query() q: FeedQuery) {
    return this.posts.feed(viewer, id, q);
  }

  @Get(":id")
  get(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.posts.get(viewer, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.posts.delete(viewer, id);
  }

  @Patch(":id/like")
  @Can("content.react")
  toggleLike(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.toggleLike(viewer, id);
  }

  @Put(":id/reaction")
  @Can("content.react")
  react(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ReactionDto) {
    return this.engagement.react(viewer, id, body.type);
  }

  @Delete(":id/reaction")
  @Can("content.react")
  unreact(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.unreact(viewer, id);
  }

  @Get(":id/poll")
  poll(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.pollResults(viewer, id);
  }

  @Put(":id/poll/vote")
  @Can("content.react")
  vote(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: VoteDto) {
    return this.engagement.vote(viewer, id, body.optionId);
  }

  @Delete(":id/poll/vote")
  @Can("content.react")
  unvote(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.unvote(viewer, id);
  }

  @Patch(":id/alert")
  resolveAlert(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ResolveAlertDto) {
    return this.posts.resolveAlert(viewer, id, body.resolved);
  }

  @Get(":id/rsvp")
  rsvp(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.rsvpSummary(viewer, id);
  }

  @Put(":id/rsvp")
  setRsvp(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: RsvpDto) {
    return this.engagement.rsvp(viewer, id, body.status);
  }

  @Delete(":id/rsvp")
  cancelRsvp(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.cancelRsvp(viewer, id);
  }
}
