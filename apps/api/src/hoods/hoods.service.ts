import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types, type QueryFilter } from "mongoose";
import { Neighborhood, NeighborhoodDocument, type HoodStatus } from "./schemas/hood.schema";

export interface HoodInput {
  name: string;
  city: string;
  country?: string;
  description?: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
}

/** Rows written before migration 002 still have isActive instead of status. */
const OPEN: QueryFilter<Neighborhood> = { $or: [{ status: "active" }, { status: { $exists: false }, isActive: { $ne: false } }] };

@Injectable()
export class HoodsService {
  constructor(@InjectModel(Neighborhood.name) private readonly hoods: Model<NeighborhoodDocument>) {}

  /** Hoods neighbours can see and verify into. */
  async findAll(): Promise<NeighborhoodDocument[]> {
    return this.hoods.find(OPEN).sort({ city: 1, name: 1 }).exec();
  }

  /** Open Hoods per city, for the admin settings page (contract §13.9). */
  async coverageCities(): Promise<{ city: string; hoods: number }[]> {
    const rows = await this.hoods.aggregate<{ _id: string; hoods: number }>([{ $match: OPEN }, { $group: { _id: "$city", hoods: { $sum: 1 } } }, { $sort: { hoods: -1, _id: 1 } }]).exec();
    return rows.map((r) => ({ city: r._id, hoods: r.hoods }));
  }

  async findById(id: string): Promise<NeighborhoodDocument> {
    const hood = Types.ObjectId.isValid(id) ? await this.hoods.findById(id).exec() : null;
    if (!hood) throw new NotFoundException("That neighbourhood doesn't exist.");
    return hood;
  }

  async findManyByIds(ids: string[]): Promise<Map<string, NeighborhoodDocument>> {
    const valid = [...new Set(ids)].filter((id) => Types.ObjectId.isValid(id));
    const docs = await this.hoods.find({ _id: { $in: valid } }).exec();
    return new Map(docs.map((d) => [d.id as string, d]));
  }

  /** Idempotent upsert keyed by name (seed script). */
  async upsertByName(data: Partial<Neighborhood> & { name: string }): Promise<NeighborhoodDocument> {
    const hood = await this.hoods
      .findOneAndUpdate({ name: data.name }, { status: "active", ...data }, { upsert: true, new: true, setDefaultsOnInsert: true })
      .exec();
    if (!hood) throw new Error(`Failed to upsert neighborhood "${data.name}"`);
    return hood;
  }

  /** Staff: create a Hood. 409 if the name exists or the circle overlaps an open Hood. */
  async create(input: HoodInput): Promise<NeighborhoodDocument> {
    const nameTaken = await this.hoods.exists({ name: { $regex: `^${escape(input.name)}$`, $options: "i" } });
    if (nameTaken) throw new ConflictException(`A Hood called “${input.name}” already exists.`);
    const overlaps = await this.overlapping(input.center, input.radiusMeters);
    if (overlaps.length) {
      throw new ConflictException(`This area overlaps ${overlaps.map((o) => o.name).join(", ")}. Shrink the radius or move the centre.`);
    }
    return this.hoods.create({
      name: input.name,
      city: input.city,
      country: input.country ?? "Nigeria",
      description: input.description,
      radiusMeters: input.radiusMeters,
      location: { type: "Point", coordinates: [input.center.lng, input.center.lat] },
      status: "active",
    });
  }

  async update(id: string, patch: Partial<Pick<Neighborhood, "name" | "description" | "radiusMeters" | "status">>): Promise<NeighborhoodDocument> {
    const hood = await this.hoods.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).exec();
    if (!hood) throw new NotFoundException("That neighbourhood doesn't exist.");
    return hood;
  }

  /** Never hard-delete: members, posts and history depend on the Hood (admin decision #4). */
  async archive(id: string): Promise<NeighborhoodDocument> {
    return this.setStatus(id, "archived");
  }

  async setStatus(id: string, status: HoodStatus): Promise<NeighborhoodDocument> {
    return this.update(id, { status });
  }

  /** Open Hoods within `maxDistanceMeters` of a point. */
  async findNearby(lng: number, lat: number, maxDistanceMeters = 5000): Promise<NeighborhoodDocument[]> {
    return this.hoods
      .find({ ...OPEN, location: { $near: { $geometry: { type: "Point", coordinates: [lng, lat] }, $maxDistance: maxDistanceMeters } } })
      .exec();
  }

  /** Nearest open Hood whose own radius covers the point. */
  async findVerifiedMatch(lng: number, lat: number): Promise<{ neighborhoodId: string; distanceMeters: number } | null> {
    const [match] = await this.hoods
      .aggregate<{ _id: Types.ObjectId; distanceMeters: number }>([
        { $geoNear: { near: { type: "Point", coordinates: [lng, lat] }, distanceField: "distanceMeters", spherical: true, query: OPEN } },
        { $match: { $expr: { $lte: ["$distanceMeters", "$radiusMeters"] } } },
        { $limit: 1 },
        { $project: { distanceMeters: 1 } },
      ])
      .exec();
    return match ? { neighborhoodId: match._id.toString(), distanceMeters: match.distanceMeters } : null;
  }

  /** Nearest Hoods to a point, for staff reviewing a failed verification. */
  async nearest(lng: number, lat: number, limit = 3): Promise<{ id: string; name: string; distanceMeters: number }[]> {
    const rows = await this.hoods
      .aggregate<{ _id: Types.ObjectId; name: string; distanceMeters: number }>([
        { $geoNear: { near: { type: "Point", coordinates: [lng, lat] }, distanceField: "distanceMeters", spherical: true, query: { status: { $ne: "archived" } } } },
        { $limit: limit },
        { $project: { name: 1, distanceMeters: 1 } },
      ])
      .exec();
    return rows.map((r) => ({ id: r._id.toString(), name: r.name, distanceMeters: Math.round(r.distanceMeters) }));
  }

  private async overlapping(center: { lat: number; lng: number }, radiusMeters: number) {
    const candidates = await this.hoods
      .aggregate<{ name: string; radiusMeters: number; distanceMeters: number }>([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [center.lng, center.lat] },
            distanceField: "distanceMeters",
            spherical: true,
            maxDistance: radiusMeters + 20_000,
            query: { status: { $ne: "archived" } },
          },
        },
        { $project: { name: 1, radiusMeters: 1, distanceMeters: 1 } },
      ])
      .exec();
    return candidates.filter((c) => c.distanceMeters < c.radiusMeters + radiusMeters);
  }
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
