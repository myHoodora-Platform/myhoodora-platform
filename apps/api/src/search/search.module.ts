import { Module } from "@nestjs/common";
import { ListingsModule } from "../listings/listings.module";
import { PostsModule } from "../posts/posts.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [PostsModule, ListingsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
