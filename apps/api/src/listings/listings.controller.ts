import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { CreateListingDto, ListingQuery, UpdateListingDto } from "./listings.dto";
import { ListingsService } from "./listings.service";
import { ApiStandardErrors } from "../shared/http/api-docs";

/** Contract §4: For Sale & Free. Always scoped to the caller's own Hood. */
@ApiTags("listings")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("listings")
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @ApiOperation({ summary: "Listings in your Hood, newest first (sold items hidden except your own)" })
  @ApiNotFoundResponse({ description: "Not in a Hood, or another Hood's id" })
  list(@CurrentViewer() viewer: Viewer, @Query() q: ListingQuery) {
    return this.listings.list(viewer, q);
  }

  @Get(":id")
  @ApiOperation({ summary: "One listing" })
  get(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.listings.get(viewer, id);
  }

  @Post()
  @Can("content.create")
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "List an item (verified neighbours; 10 a day)" })
  @ApiTooManyRequestsResponse({ description: "Daily listing limit reached" })
  create(@CurrentViewer() viewer: Viewer, @Body() body: CreateListingDto) {
    return this.listings.create(viewer, body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Mark available / pending / sold (seller only)" })
  setStatus(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: UpdateListingDto) {
    return this.listings.setStatus(viewer, id, body.status);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete your listing" })
  @ApiNoContentResponse()
  async delete(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.listings.delete(viewer, id);
  }
}
