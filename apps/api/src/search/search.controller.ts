import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { ApiStandardErrors } from "../shared/http/api-docs";
import { SEARCH_TYPES, SearchService, type SearchType } from "./search.service";

export class SearchQuery {
  /** @example "plumber" */
  @IsString() @Length(2, 100) q!: string;
  /** One kind of result; omit for a few of each. */
  @IsOptional() @IsIn(SEARCH_TYPES) type?: SearchType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

@ApiTags("search")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: "Search your Hood: posts, For Sale & Free, neighbours",
    description:
      "Case-insensitive match on post text, listing title/description and neighbour names, in the caller's own Hood only. Same visibility as the lists they come from (blocks, removed, sold). Without `type`: up to 5 of each; with `type`: up to `limit` (default 20). Empty arrays if you haven't joined a Hood yet.",
  })
  @ApiOkResponse({ description: "`{ q, posts?, listings?, people? }`: only the requested types are present" })
  find(@CurrentViewer() viewer: Viewer, @Query() query: SearchQuery) {
    return this.search.search(viewer, query.q.trim(), query.type, query.limit);
  }
}
