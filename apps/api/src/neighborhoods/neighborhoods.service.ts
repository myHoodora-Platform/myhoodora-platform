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

  /**
   * Idempotent upsert keyed by the unique `name` field, so seed scripts can
   * be re-run safely without hitting duplicate-key errors.
   */
  async upsertByName(
    data: Partial<Neighborhood> & { name: string },
  ): Promise<NeighborhoodDocument> {
    const hood = await this.neighborhoodModel
      .findOneAndUpdate({ name: data.name }, data, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      })
      .exec();
    if (!hood) throw new Error(`Failed to upsert neighborhood "${data.name}"`);
    return hood;
  }

  async findAll(): Promise<NeighborhoodDocument[]> {
    return this.neighborhoodModel.find({ isActive: true }).exec();
  }

  async findById(id: string): Promise<NeighborhoodDocument> {
    const hood = await this.neighborhoodModel.findById(id).exec();
    if (!hood) throw new NotFoundException(`Neighborhood ${id} not found`);
    return hood;
  }

  async delete(id: string): Promise<void> {
    const hood = await this.neighborhoodModel.findByIdAndDelete(id).exec();
    if (!hood) throw new NotFoundException(`Neighborhood ${id} not found`);
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
    lng: number,
    lat: number,
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
      console.log("findVerifiedMatch result:", match);

    if (!match) return null;
    return {
      neighborhoodId: match._id.toString(),
      distanceMeters: match.distanceMeters,
    };
  }
}
