import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { EngagementService } from "./engagement.service";
import { EventRemindersService } from "./event-reminders.service";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";
import { PostActionsService } from "./post-actions.service";
import { FeedPost, PollVote, PollVoteSchema, PostFollow, PostFollowSchema, PostSchema, PostShare, PostShareSchema, Reaction, ReactionSchema, Rsvp, RsvpSchema, SavedPost, SavedPostSchema } from "./schemas/post.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FeedPost.name, schema: PostSchema },
      { name: Reaction.name, schema: ReactionSchema },
      { name: PollVote.name, schema: PollVoteSchema },
      { name: Rsvp.name, schema: RsvpSchema },
      { name: SavedPost.name, schema: SavedPostSchema },
      { name: PostFollow.name, schema: PostFollowSchema },
      { name: PostShare.name, schema: PostShareSchema },
    ]),
    HoodsModule,
  ],
  controllers: [PostsController],
  providers: [PostsService, EngagementService, EventRemindersService, PostActionsService],
  exports: [PostsService, PostActionsService, MongooseModule],
})
export class PostsModule {}
