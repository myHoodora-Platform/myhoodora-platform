import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { NeighborhoodsService } from "../neighborhoods/neighborhoods.service";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly neighborhoodsService: NeighborhoodsService,
  ) {}

  async findByUid(uid: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ uid }).exec();
  }

  async findOrCreate(
    uid: string,
    partial: Partial<User>,
  ): Promise<UserDocument> {
    const existing = await this.findByUid(uid);
    if (existing) return existing;

    const created = new this.userModel({ uid, ...partial });
    return created.save();
  }

  async completeOnboarding(
    uid: string,
    payload: {
      displayName?: string;
      location?: { lat?: number; lng?: number; address?: string };
    },
  ): Promise<UserDocument> {
    const updates: Partial<User> = {
      isOnboarded: true,
      ...payload,
    };
    return this.update(uid, updates);
  }

  /**
   * Verifies a user's coordinates against neighborhood boundaries: assigns
   * the nearest neighborhood whose own `radiusMeters` covers the point, or
   * leaves the user unverified with an "outside_coverage" reason.
   */
  async verifyLocation(
    uid: string,
    coords: { lat: number; lng: number },
  ): Promise<{
    verificationStatus: string;
    neighborhoodId?: string;
    distanceMeters?: number;
    reason?: string;
  }> {
    const { lat, lng } = coords;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      throw new BadRequestException("lat and lng must be valid numbers");
    }

    const match = await this.neighborhoodsService.findVerifiedMatch(
      lat,
      lng,
    );
    const lastKnownLocation = { lat, lng };

    if (!match) {
      await this.update(uid, {
        verificationStatus: "unverified",
        lastKnownLocation,
      });
      return { verificationStatus: "unverified", reason: "outside_coverage" };
    }

    await this.update(uid, {
      neighborhoodId: match.neighborhoodId,
      verificationStatus: "verified",
      verifiedAt: new Date(),
      lastKnownLocation,
    });

    return {
      verificationStatus: "verified",
      neighborhoodId: match.neighborhoodId,
      distanceMeters: match.distanceMeters,
    };
  }

  async update(uid: string, updates: Partial<User>): Promise<UserDocument> {
    const user = await this.userModel
      .findOneAndUpdate({ uid }, updates, { new: true })
      .exec();
    if (!user) throw new NotFoundException(`User ${uid} not found`);
    return user;
  }
}
