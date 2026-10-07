import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types, type ClientSession, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { Neighborhood, NeighborhoodDocument, type HoodStatus } from "./schemas/hood.schema";

export interface HoodInput {
  name: string;
  city: string;
  country?: string;
  description?: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
}

/** A Hood close to (but not covering) an address, offered as "ask to join" (contract §16). */
export interface NearbyHood {
  id: string;
  name: string;
  city: string;
  distanceMeters: number;
}

/** How close two Hoods' centres must be for them to count as "nearby" each other (groups, profile visibility). */
export const NEARBY_HOOD_METERS = 5_000;

/** Rows written before migration 002 still have isActive instead of status. */
const OPEN: QueryFilter<Neighborhood> = { $or: [{ status: "active" }, { status: { $exists: false }, isActive: { $ne: false } }] };

/** The same rule as OPEN, for a Hood already loaded. */
export function isOpenHood(h: Pick<Neighborhood, "status" | "isActive">): boolean {
  return h.status === "active" || (!h.status && h.isActive !== false);
}

@Injectable()
export class HoodsService {
  constructor(
    @InjectModel(Neighborhood.name) private readonly hoods: Model<NeighborhoodDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly audit: AuditService,
  ) {}

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
  async create(input: HoodInput, session?: ClientSession): Promise<NeighborhoodDocument> {
    const nameTaken = await this.hoods.exists({ name: { $regex: `^${escape(input.name)}$`, $options: "i" } });
    if (nameTaken) throw new ConflictException(`A Hood called “${input.name}” already exists.`);
    const overlaps = await this.overlapping(input.center, input.radiusMeters);
    if (overlaps.length) {
      throw new ConflictException(`This area overlaps ${overlaps.map((o) => o.name).join(", ")}. Shrink the radius or move the centre.`);
    }
    const [hood] = await this.hoods.create(
      [
        {
          name: input.name,
          city: input.city,
          country: input.country ?? "Nigeria",
          description: input.description,
          radiusMeters: input.radiusMeters,
          location: { type: "Point", coordinates: [input.center.lng, input.center.lat] },
          status: "active",
        },
      ],
      { session },
    );
    return hood!;
  }

  /**
   * 409 if a new radius would run into another Hood: two Hoods covering one address would make
   * "which Hood is this?" depend on which is nearer. The same rule as on creation.
   */
  async update(id: string, patch: Partial<Pick<Neighborhood, "name" | "description" | "radiusMeters" | "status">>, session?: ClientSession): Promise<NeighborhoodDocument> {
    if (patch.radiusMeters !== undefined) {
      const current = await this.findById(id);
      const [lng, lat] = current.location?.coordinates ?? [];
      if (lng !== undefined && lat !== undefined && patch.radiusMeters > current.radiusMeters) {
        const overlaps = await this.overlapping({ lat, lng }, patch.radiusMeters, id);
        if (overlaps.length) throw new ConflictException(`That radius would overlap ${overlaps.map((o) => o.name).join(", ")}. Choose a smaller one.`);
      }
    }
    const hood = await this.hoods.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true, session }).exec();
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

  // Staff writes come in through two sets of routes (/admin/hoods and the older /neighborhoods).
  // Both go through these, so every one is recorded, and recorded in the same transaction as the change.

  createAudited(actor: Viewer, input: HoodInput): Promise<NeighborhoodDocument> {
    return withTransaction(this.connection, async (session) => {
      const hood = await this.create(input, session);
      await this.audit.record(actor, "hood_create", { type: "hood", id: hood.id as string, label: hood.name }, {}, session);
      return hood;
    });
  }

  updateAudited(actor: Viewer, id: string, patch: Partial<Pick<Neighborhood, "name" | "description" | "radiusMeters" | "status">>, reason?: string): Promise<NeighborhoodDocument> {
    return withTransaction(this.connection, async (session) => {
      const hood = await this.update(id, patch, session);
      await this.audit.record(actor, patch.status === "archived" ? "hood_archive" : "hood_update", { type: "hood", id, label: hood.name }, { reason }, session);
      return hood;
    });
  }

  /** Open Hoods within `maxDistanceMeters` of a point. */
  async findNearby(lng: number, lat: number, maxDistanceMeters = 5000): Promise<NeighborhoodDocument[]> {
    return this.hoods
      .find({ ...OPEN, location: { $near: { $geometry: { type: "Point", coordinates: [lng, lat] }, $maxDistance: maxDistanceMeters } } })
      .exec();
  }

  /** The open Hoods that count as nearby this one, itself included. Empty if the Hood has no centre on record. */
  async nearbyHoodIds(hoodId: string): Promise<string[]> {
    const hood = Types.ObjectId.isValid(hoodId) ? await this.hoods.findById(hoodId).exec() : null;
    const point = hood?.location?.coordinates;
    if (!point) return [];
    return (await this.findNearby(point[0], point[1], NEARBY_HOOD_METERS)).map((h) => String(h._id));
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

  /**
   * Open Hoods whose edge is within `bufferMeters` of a point, nearest first.
   * The server decides "close"; clients never send a radius (contract §16).
   */
  async nearbyForJoin(lng: number, lat: number, bufferMeters: number, limit = 3): Promise<NearbyHood[]> {
    const rows = await this.hoods
      .aggregate<{ _id: Types.ObjectId; name: string; city: string; distanceMeters: number }>([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [lng, lat] },
            distanceField: "distanceMeters",
            spherical: true,
            maxDistance: bufferMeters + 20_000,
            query: OPEN,
          },
        },
        { $match: { $expr: { $lte: ["$distanceMeters", { $add: ["$radiusMeters", bufferMeters] }] } } },
        { $limit: limit },
        { $project: { name: 1, city: 1, distanceMeters: 1 } },
      ])
      .exec();
    return rows.map((r) => ({ id: r._id.toString(), name: r.name, city: r.city, distanceMeters: Math.round(r.distanceMeters) }));
  }

  /** Hoods (not archived) whose circle a circle here would cut into. `exceptId`: the Hood being resized. */
  private async overlapping(center: { lat: number; lng: number }, radiusMeters: number, exceptId?: string) {
    const candidates = await this.hoods
      .aggregate<{ name: string; radiusMeters: number; distanceMeters: number }>([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [center.lng, center.lat] },
            distanceField: "distanceMeters",
            spherical: true,
            maxDistance: radiusMeters + 20_000,
            query: { status: { $ne: "archived" }, ...(exceptId && { _id: { $ne: new Types.ObjectId(exceptId) } }) },
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
