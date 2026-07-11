import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    Neighborhood,
    NeighborhoodDocument,
} from './schemas/neighborhood.schema';

@Injectable()
export class NeighborhoodsService {
    constructor(
        @InjectModel(Neighborhood.name)
        private readonly neighborhoodModel: Model<NeighborhoodDocument>,
    ) { }

    async create(data: Partial<Neighborhood>): Promise<NeighborhoodDocument> {
        const hood = new this.neighborhoodModel(data);
        return hood.save();
    }

    async findAll(): Promise<NeighborhoodDocument[]> {
        return this.neighborhoodModel.find({ isActive: true }).exec();
    }

    async findById(id: string): Promise<NeighborhoodDocument> {
        const hood = await this.neighborhoodModel.findById(id).exec();
        if (!hood) throw new NotFoundException(`Neighborhood ${id} not found`);
        return hood;
    }

    /** Find neighborhoods within `maxDistanceMeters` of a coordinate pair */
    async findNearby(
        longitude: number,
        latitude: number,
        maxDistanceMeters = 5000,
    ): Promise<NeighborhoodDocument[]> {
        return this.neighborhoodModel
            .find({
                location: {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                        $maxDistance: maxDistanceMeters,
                    },
                },
                isActive: true,
            })
            .exec();
    }
}
