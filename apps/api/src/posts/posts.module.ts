import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Update, PostSchema } from './schemas/post.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Update.name, schema: PostSchema }]),
    ],
    controllers: [PostsController],
    providers: [PostsService],
    exports: [PostsService],
})
export class PostsModule { }
