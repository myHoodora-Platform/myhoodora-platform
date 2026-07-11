import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { NeighborhoodsService } from './neighborhoods.service';
import { Neighborhood } from './schemas/neighborhood.schema';

@ApiTags('neighborhoods')
@ApiBearerAuth('firebase-jwt')
@Controller('neighborhoods')
export class NeighborhoodsController {
    constructor(private readonly neighborhoodsService: NeighborhoodsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a neighbourhood' })
    @ApiResponse({ status: 201, description: 'Neighbourhood created.' })
    create(@Body() body: Partial<Neighborhood>) {
        return this.neighborhoodsService.create(body);
    }

    @Get()
    @ApiOperation({ summary: 'List all neighbourhoods' })
    @ApiResponse({ status: 200, description: 'Array of neighbourhoods.' })
    findAll() {
        return this.neighborhoodsService.findAll();
    }

    @Get('nearby')
    @ApiOperation({
        summary: 'Find nearby neighbourhoods',
        description: 'Returns neighbourhoods within `maxDistance` metres of the given coordinates.',
    })
    @ApiQuery({ name: 'lng', required: true, type: Number, description: 'Longitude', example: 2.3488 })
    @ApiQuery({ name: 'lat', required: true, type: Number, description: 'Latitude', example: 48.8534 })
    @ApiQuery({ name: 'maxDistance', required: false, type: Number, description: 'Radius in metres (default 5000)', example: 5000 })
    @ApiResponse({ status: 200, description: 'Array of nearby neighbourhoods.' })
    findNearby(
        @Query('lng') lng: string,
        @Query('lat') lat: string,
        @Query('maxDistance') maxDistance?: string,
    ) {
        return this.neighborhoodsService.findNearby(
            parseFloat(lng),
            parseFloat(lat),
            maxDistance ? parseInt(maxDistance) : undefined,
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a neighbourhood by ID' })
    @ApiParam({ name: 'id', description: 'Neighbourhood MongoDB ObjectId' })
    @ApiResponse({ status: 200, description: 'Neighbourhood document.' })
    @ApiResponse({ status: 404, description: 'Not found.' })
    findOne(@Param('id') id: string) {
        return this.neighborhoodsService.findById(id);
    }
}
