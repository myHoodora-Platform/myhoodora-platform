import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NeighborhoodsController } from './neighborhoods.controller';
import { NeighborhoodsService } from './neighborhoods.service';
import {
    Neighborhood,
    NeighborhoodSchema,
} from './schemas/neighborhood.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Neighborhood.name, schema: NeighborhoodSchema },
        ]),
    ],
    controllers: [NeighborhoodsController],
    providers: [NeighborhoodsService],
    exports: [NeighborhoodsService],
})
export class NeighborhoodsModule { }
