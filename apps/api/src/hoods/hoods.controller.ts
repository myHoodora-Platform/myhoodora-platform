import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsLatitude, IsLongitude, IsOptional, IsInt, Min, Max } from "class-validator";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { CreateHoodDto } from "./dto/hood.dto";
import { HoodsService } from "./hoods.service";
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

/**
 * Public-facing Hood routes (URLs unchanged). Writes are staff-only —
 * the full management API is under /admin/hoods (contract §13.5).
 */
@ApiTags("neighborhoods")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("neighborhoods")
export class HoodsController {
  constructor(private readonly hoods: HoodsService) {}

  @Get()
  @ApiOperation({ summary: "List open neighbourhoods" })
  findAll() {
    return this.hoods.findAll();
  }

  @Get("nearby")
  @ApiOperation({ summary: "Open neighbourhoods near a point" })
  findNearby(@Query() q: NearbyQuery) {
    return this.hoods.findNearby(q.lng, q.lat, q.maxDistance);
  }

  @Get(":id")
  @ApiOperation({ summary: "One Hood" })
  findOne(@Param("id", ParseObjectIdPipe) id: string) {
    return this.hoods.findById(id);
  }

  @Post()
  @Can("hoods.manage")
  @ApiOperation({ summary: "Create a neighbourhood (admins)" })
  create(@Body() body: CreateHoodDto) {
    return this.hoods.create(body);
  }

  /** Archives (never hard-deletes); 204 as before. */
  @Delete(":id")
  @HttpCode(204)
  @Can("hoods.manage")
  @ApiOperation({ summary: "Archive a neighbourhood (admins)" })
  async remove(@Param("id", ParseObjectIdPipe) id: string) {
    await this.hoods.archive(id);
  }
}
