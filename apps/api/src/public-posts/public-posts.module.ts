import { Module } from "@nestjs/common";
import { CommentsModule } from "../comments/comments.module";
import { HoodsModule } from "../hoods/hoods.module";
import { PostsModule } from "../posts/posts.module";
import { UsersModule } from "../users/users.module";
import { PublicPostsController } from "./public-posts.controller";
import { PublicPostsService } from "./public-posts.service";

/** GET /public/posts/:id: shared links before signing in. */
@Module({
  imports: [PostsModule, CommentsModule, HoodsModule, UsersModule],
  controllers: [PublicPostsController],
  providers: [PublicPostsService],
})
export class PublicPostsModule {}
