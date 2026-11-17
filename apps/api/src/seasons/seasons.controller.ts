import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";
import { SeasonInputDto } from "./seasons.dto";
import { SeasonsService } from "./seasons.service";

/** Festive seasons (contract §41): Admin → Settings → Seasons. Every change audited. */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("admin.access", "settings.manage")
@Controller("admin/seasons")
export class AdminSeasonsController {
  constructor(private readonly seasons: SeasonsService) {}

  @Get()
  @ApiOperation({ summary: "Every season, newest first, with whether it's on now" })
  list() {
    return this.seasons.list();
  }

  @Post()
  @ApiOperation({ summary: "Add a season (key, label, startsAt, endsAt, look, greeting)" })
  create(@CurrentViewer() viewer: Viewer, @Body() body: SeasonInputDto) {
    return this.seasons.create(viewer, body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Change a season (dates, look, greeting, on/off)" })
  @ApiNotFound("Season")
  update(@CurrentViewer() viewer: Viewer, @Param("id") id: string, @Body() body: SeasonInputDto) {
    return this.seasons.update(viewer, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFound("Season")
  async remove(@CurrentViewer() viewer: Viewer, @Param("id") id: string) {
    await this.seasons.remove(viewer, id);
  }
}
