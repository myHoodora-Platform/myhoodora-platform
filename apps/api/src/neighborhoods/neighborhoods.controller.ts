import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { NeighborhoodsService } from "./neighborhoods.service";
import { Neighborhood } from "./schemas/neighborhood.schema";

@ApiTags("neighborhoods")
@ApiBearerAuth("firebase-jwt")
@Controller("neighborhoods")
export class NeighborhoodsController {
  constructor(private readonly neighborhoodsService: NeighborhoodsService) {}

  @Post()
  @ApiOperation({ summary: "Create a neighbourhood" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["name", "city", "country", "radiusMeters"],
      properties: {
        name: { type: "string", example: "Ikeja GRA" },
        description: {
          type: "string",
          example: "Upscale residential neighbourhood",
        },
        city: { type: "string", example: "Lagos" },
        country: { type: "string", example: "Nigeria" },
        radiusMeters: { type: "number", example: 1500 },
        isActive: { type: "boolean", example: true },
        location: {
          type: "object",
          properties: {
            type: { type: "string", example: "Point" },
            coordinates: {
              type: "array",
              items: { type: "number" },
              example: [3.3515, 6.5833],
              description: "[longitude, latitude]",
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Neighbourhood created." })
  create(@Body() body: Partial<Neighborhood>) {
    return this.neighborhoodsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: "List all neighbourhoods" })
  @ApiResponse({ status: 200, description: "Array of neighbourhoods." })
  findAll() {
    return this.neighborhoodsService.findAll();
  }

  @Get("nearby")
  @ApiOperation({
    summary: "Find nearby neighbourhoods",
    description:
      "Returns neighbourhoods within `maxDistance` metres of the given coordinates.",
  })
  @ApiQuery({
    name: "lng",
    required: true,
    type: Number,
    description: "Longitude",
    example: 2.3488,
  })
  @ApiQuery({
    name: "lat",
    required: true,
    type: Number,
    description: "Latitude",
    example: 48.8534,
  })
  @ApiQuery({
    name: "maxDistance",
    required: false,
    type: Number,
    description: "Radius in metres (default 5000)",
    example: 5000,
  })
  @ApiResponse({ status: 200, description: "Array of nearby neighbourhoods." })
  findNearby(
    @Query("lng") lng: string,
    @Query("lat") lat: string,
    @Query("maxDistance") maxDistance?: string,
  ) {
    return this.neighborhoodsService.findNearby(
      parseFloat(lng),
      parseFloat(lat),
      maxDistance ? parseInt(maxDistance) : undefined,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a neighbourhood by ID" })
  @ApiParam({ name: "id", description: "Neighbourhood MongoDB ObjectId" })
  @ApiResponse({ status: 200, description: "Neighbourhood document." })
  @ApiResponse({ status: 404, description: "Not found." })
  findOne(@Param("id") id: string) {
    return this.neighborhoodsService.findById(id);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a neighbourhood by ID" })
  @ApiParam({ name: "id", description: "Neighbourhood MongoDB ObjectId" })
  @ApiResponse({ status: 204, description: "Neighbourhood deleted." })
  @ApiResponse({ status: 404, description: "Not found." })
  async remove(@Param("id") id: string) {
    await this.neighborhoodsService.delete(id);
  }
}
