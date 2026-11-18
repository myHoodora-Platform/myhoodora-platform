import { Controller, Get, Header, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../shared/auth/public.decorator";
import { ApiStandardErrors } from "../shared/http/api-docs";
import { PublicPostsService } from "./public-posts.service";

/** Shared links, before signing in (contract §38). */
@ApiTags("public")
@ApiStandardErrors()
@Controller("public/posts")
export class PublicPostsController {
  constructor(private readonly previews: PublicPostsService) {}

  @Public()
  @Get(":id")
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @Header("Cache-Control", "public, max-age=60")
  @ApiOperation({ summary: "A shared post as someone not signed in sees it: full (Anyone) or a teaser; 404 unknown, 410 gone" })
  get(@Param("id") id: string) {
    return this.previews.preview(id);
  }
}
