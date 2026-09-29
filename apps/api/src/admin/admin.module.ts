import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CommentsModule } from "../comments/comments.module";
import { HoodsModule } from "../hoods/hoods.module";
import { InboundModule } from "../inbound/inbound.module";
import { ModerationModule } from "../moderation/moderation.module";
import { PostsModule } from "../posts/posts.module";
import { AdminReadService } from "./admin-read.service";
import { AdminController } from "./admin.controllers";
import { Broadcast, BroadcastSchema, BroadcastsService } from "./broadcasts.service";

/** Thin §13 API over the domain modules — no business rules of its own. */
@Module({
  imports: [MongooseModule.forFeature([{ name: Broadcast.name, schema: BroadcastSchema }]), HoodsModule, PostsModule, CommentsModule, ModerationModule, InboundModule],
  controllers: [AdminController],
  providers: [AdminReadService, BroadcastsService],
})
export class AdminModule {}
