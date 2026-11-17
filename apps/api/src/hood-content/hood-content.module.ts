import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HoodsModule } from "../hoods/hoods.module";
import { PostsModule } from "../posts/posts.module";
import { UsersModule } from "../users/users.module";
import { AdminHoodContentController, HoodContentController } from "./hood-content.controller";
import { ContentItem, ContentItemSchema, HoodContentSettings, HoodContentSettingsSchema, ScheduledPost, ScheduledPostSchema } from "./hood-content.schemas";
import { HoodContentService } from "./hood-content.service";

/** The official Hood Team: content bank, scheduled posts, activation plans, daily prompts. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContentItem.name, schema: ContentItemSchema },
      { name: ScheduledPost.name, schema: ScheduledPostSchema },
      { name: HoodContentSettings.name, schema: HoodContentSettingsSchema },
    ]),
    HoodsModule,
    PostsModule,
    UsersModule,
  ],
  controllers: [HoodContentController, AdminHoodContentController],
  providers: [HoodContentService],
  exports: [HoodContentService],
})
export class HoodContentModule {}
