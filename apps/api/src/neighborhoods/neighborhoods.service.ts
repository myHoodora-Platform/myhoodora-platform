import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Neighborhood,
  NeighborhoodDocument,
} from "./schemas/neighborhood.schema";

@Injectable()
export class NeighborhoodsService {
  constructor(
    @InjectModel(Neighborhood.name)
    private readonly neighborhoodModel: Model<NeighborhoodDocument>,
  ) {}

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
            $geometry: { type: "Point", coordinates: [longitude, latitude] },
            $maxDistance: maxDistanceMeters,
          },
        },
        isActive: true,
      })
      .exec();
  }

  /**
   * Find the nearest active neighborhood whose own `radiusMeters` actually
   * covers the given coordinate. Unlike `findNearby`, the distance cutoff is
   * per-document, so this can't be expressed with a single `$near` query.
   */
  async findVerifiedMatch(
    lat: number,
    lng: number,
  ): Promise<{ neighborhoodId: string; distanceMeters: number } | null> {
    const [match] = await this.neighborhoodModel
      .aggregate<{ _id: Types.ObjectId; distanceMeters: number }>([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [lng, lat] },
            distanceField: "distanceMeters",
            spherical: true,
            query: { isActive: true },
          },
        },
        { $match: { $expr: { $lte: ["$distanceMeters", "$radiusMeters"] } } },
        { $limit: 1 },
        { $project: { distanceMeters: 1 } },
      ])
      .exec();

    if (!match) return null;
    return {
      neighborhoodId: match._id.toString(),
      distanceMeters: match.distanceMeters,
    };
  }
}
