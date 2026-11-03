import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsLatitude, IsLongitude, IsOptional, IsInt, Min, Max } from "class-validator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { CreateHoodDto } from "./dto/hood.dto";
import { HoodsService } from "./hoods.service";
import type { NeighborhoodDocument } from "./schemas/hood.schema";
import { ApiStandardErrors } from "../shared/http/api-docs";

class NearbyQuery {
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50_000)
  maxDistance?: number;
}

/** What anyone signed in may know about a Hood: enough to name it, not enough to place it. */
export interface HoodSummary {
  _id: string;
  name: string;
  city: string;
  country: string;
}

/**
 * Public-facing Hood routes (URLs unchanged). Writes are staff-only —
 * the full management API is under /admin/hoods (contract §13.5).
 *
 * A Hood's centre and radius are exactly what POST /users/me/verify-location needs to be told to
 * verify into it, so they are not handed out: the full record goes to staff and to a Hood's own
 * verified members (the alerts map draws it). Everyone else gets a HoodSummary.
 */
@ApiTags("neighborhoods")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("neighborhoods")
export class HoodsController {
  private readonly strictHoodAccess: boolean;

  constructor(
    private readonly hoods: HoodsService,
    config: ConfigService,
  ) {
    this.strictHoodAccess = config.get<boolean>("verification.strictHoodAccess") !== false;
  }

  /** `viewer.hoodId` is only set for a verified neighbour, so "their own Hood" already means "verified". */
  private forViewer(viewer: Viewer, hood: NeighborhoodDocument): NeighborhoodDocument | HoodSummary {
    const full = !this.strictHoodAccess || viewer.capabilities.includes("admin.access") || (viewer.hoodId !== null && viewer.hoodId === hood.id);
    return full ? hood : { _id: hood.id as string, name: hood.name, city: hood.city, country: hood.country };
  }

  @Get()
  @ApiOperation({ summary: "List open neighbourhoods (centre and radius only for your own Hood, or for staff)" })
  async findAll(@CurrentViewer() viewer: Viewer) {
    return (await this.hoods.findAll()).map((h) => this.forViewer(viewer, h));
  }

  @Get("nearby")
  @ApiOperation({ summary: "Open neighbourhoods near a point (centre and radius only for your own Hood, or for staff)" })
  async findNearby(@CurrentViewer() viewer: Viewer, @Query() q: NearbyQuery) {
    return (await this.hoods.findNearby(q.lng, q.lat, q.maxDistance)).map((h) => this.forViewer(viewer, h));
  }

  @Get(":id")
  @ApiOperation({ summary: "One Hood (centre and radius only for your own Hood, or for staff)" })
  async findOne(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.forViewer(viewer, await this.hoods.findById(id));
  }

  // The two write routes below predate /admin/hoods and do the same things. They are kept for
  // existing callers, and are audited exactly like the admin ones.

  @Post()
  @Can("hoods.manage")
  @ApiOperation({ summary: "Create a neighbourhood (admins)" })
  create(@CurrentViewer() viewer: Viewer, @Body() body: CreateHoodDto) {
    return this.hoods.createAudited(viewer, body);
  }

  /** Archives (never hard-deletes); 204 as before. */
  @Delete(":id")
  @HttpCode(204)
  @Can("hoods.manage")
  @ApiOperation({ summary: "Archive a neighbourhood (admins)" })
  async remove(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.hoods.updateAudited(viewer, id, { status: "archived" });
  }
}
