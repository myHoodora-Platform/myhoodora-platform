import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { EngagementService } from "./engagement.service";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";
import { FeedPost, PollVote, PollVoteSchema, PostSchema, Reaction, ReactionSchema, Rsvp, RsvpSchema } from "./schemas/post.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FeedPost.name, schema: PostSchema },
      { name: Reaction.name, schema: ReactionSchema },
      { name: PollVote.name, schema: PollVoteSchema },
      { name: Rsvp.name, schema: RsvpSchema },
    ]),
    HoodsModule,
  ],
  controllers: [PostsController],
  providers: [PostsService, EngagementService],
  exports: [PostsService, MongooseModule],
})
export class PostsModule {}
