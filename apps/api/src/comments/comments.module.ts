import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PostsModule } from "../posts/posts.module";
import { Comment, CommentSchema } from "./comment.schema";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";

@Module({
  imports: [MongooseModule.forFeature([{ name: Comment.name, schema: CommentSchema }]), PostsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
