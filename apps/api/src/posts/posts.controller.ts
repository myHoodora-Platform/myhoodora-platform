import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { CreatePostDto, EditPostDto, FeedQuery, FollowPostDto, ReactionDto, ResolveAlertDto, RsvpDto, SavedQuery, VoteDto } from "./dto/posts.dto";
import { EngagementService } from "./engagement.service";
import { PostActionsService } from "./post-actions.service";
import { PostsService } from "./posts.service";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";

@ApiTags("posts")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("posts")
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly engagement: EngagementService,
    private readonly actions: PostActionsService,
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

  @Get("saved")
  @ApiOperation({ summary: "Posts you saved, newest saved first (?limit&before=savedAt)" })
  saved(@CurrentViewer() viewer: Viewer, @Query() q: SavedQuery) {
    return this.actions.listSaved(viewer, q);
  }

  @Get(":id")
  @ApiOperation({ summary: "One post (404 outside your Hood, removed or from someone you blocked)" })
  @ApiOkResponse()
  @ApiNotFound("Post")
  get(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.posts.get(viewer, id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete your post" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFound("Post")
  async delete(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.posts.delete(viewer, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit your post's text (shown as edited) → post" })
  @Can("content.create")
  @Throttle({ medium: { limit: 20, ttl: 60_000 } })
  @ApiOkResponse()
  @ApiNotFound("Post")
  edit(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: EditPostDto) {
    return this.actions.edit(viewer, id, body);
  }

  @Put(":id/save")
  @ApiOperation({ summary: "Save a post for later → { saved }" })
  @ApiNotFound("Post")
  save(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.actions.setSaved(viewer, id, true);
  }

  @Delete(":id/save")
  @ApiOperation({ summary: "Unsave → { saved }" })
  unsave(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.actions.setSaved(viewer, id, false);
  }

  @Put(":id/follow")
  @ApiOperation({ summary: "Turn this post's notifications on (follow) or off (mute) → { following }" })
  @ApiNotFound("Post")
  follow(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: FollowPostDto) {
    return this.actions.setFollowing(viewer, id, body.on);
  }

  @Post(":id/share")
  @ApiOperation({ summary: "Count a share (once per neighbour) → { shareCount }" })
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiNotFound("Post")
  share(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.actions.share(viewer, id);
  }

  @Patch(":id/like")
  @ApiOperation({ summary: "Toggle a 'like' (legacy alias of PUT /reaction)" })
  @Can("content.react")
  toggleLike(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.toggleLike(viewer, id);
  }

  @Put(":id/reaction")
  @ApiOperation({ summary: "Set your reaction (one per post; replaces the previous one) → post" })
  @Can("content.react")
  @ApiOkResponse()
  @ApiNotFound("Post")
  react(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ReactionDto) {
    return this.engagement.react(viewer, id, body.type);
  }

  @Delete(":id/reaction")
  @ApiOperation({ summary: "Remove your reaction → post" })
  @Can("content.react")
  unreact(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.unreact(viewer, id);
  }

  @Get(":id/poll")
  @ApiOperation({ summary: "Poll results (anonymous counts + your vote)" })
  @ApiOkResponse()
  @ApiNotFound("Post")
  poll(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.pollResults(viewer, id);
  }

  @Put(":id/poll/vote")
  @ApiOperation({ summary: "Vote or change your vote while the poll is open (410 once closed)" })
  @Can("content.react")
  vote(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: VoteDto) {
    return this.engagement.vote(viewer, id, body.optionId);
  }

  @Delete(":id/poll/vote")
  @ApiOperation({ summary: "Remove your vote while the poll is open" })
  @Can("content.react")
  unvote(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.unvote(viewer, id);
  }

  @Patch(":id/alert")
  @ApiOperation({ summary: "Mark your alert resolved (or reopen it) → { resolvedAt }" })
  resolveAlert(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ResolveAlertDto) {
    return this.posts.resolveAlert(viewer, id, body.resolved);
  }

  @Get(":id/rsvp")
  @ApiOperation({ summary: "Event RSVP counts + your status" })
  rsvp(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.rsvpSummary(viewer, id);
  }

  @Put(":id/rsvp")
  @ApiOperation({ summary: "RSVP going / interested (host is notified on 'going')" })
  @ApiOkResponse()
  @ApiNotFound("Post")
  setRsvp(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: RsvpDto) {
    return this.engagement.rsvp(viewer, id, body.status);
  }

  @Delete(":id/rsvp")
  @ApiOperation({ summary: "Cancel your RSVP" })
  cancelRsvp(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.engagement.cancelRsvp(viewer, id);
  }
}
