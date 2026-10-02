import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types, type QueryFilter } from "mongoose";
import { HoodsService } from "../hoods/hoods.service";
import { ModerationRegistry } from "../moderation/moderation-registry";
import { RealtimeService } from "../realtime/realtime.service";
import type { Viewer } from "../shared/auth/viewer";
import { searchRegex, type Page, type PageQuery } from "../shared/http/pagination";
import { UsersService } from "../users/users.service";
import { StorageService } from "../storage/storage.service";
import type { CreateListingDto, ListingQuery } from "./listings.dto";
import { Listing, ListingDocument, type ListingStatus } from "./listing.schema";

/** Contract §4 shape, plus the seller card so the web never needs N+1 lookups. */
export interface ListingView {
  _id: string;
  sellerUid: string;
  seller: { uid: string; displayName: string; photoURL?: string };
  neighborhoodId: string;
  title: string;
  description: string;
  priceNaira: number | null;
  negotiable: boolean;
  category: Listing["category"];
  condition: Listing["condition"];
  photos: string[];
  /** width ÷ height of each `photos` entry (same order), or null when unknown. Lets the web frame a photo before it loads. */
  photoAspects: (number | null)[];
  status: ListingStatus;
  createdAt: string;
}

export interface AdminListingRow {
  id: string;
  title: string;
  priceNaira: number | null;
  category: string;
  seller: { uid: string; displayName: string };
  hood?: { id: string; name: string };
  createdAt: string;
  status: "active" | "sold" | "removed";
  openReports: number;
}

type Row = Listing & { _id: Types.ObjectId };

/** Nextdoor-style anti-spam: new listings per seller per rolling day. */
const MAX_LISTINGS_PER_DAY = 10;

@Injectable()
export class ListingsService implements OnModuleInit {
  constructor(
    @InjectModel(Listing.name) private readonly listings: Model<ListingDocument>,
    private readonly users: UsersService,
    private readonly hoods: HoodsService,
    private readonly storage: StorageService,
    private readonly registry: ModerationRegistry,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit() {
    this.registry.register({
      type: "listing",
      load: async (id) => {
        const l = await this.findRaw(id);
        if (!l || l.deletedAt) return null;
        return {
          type: "listing",
          id,
          preview: `${l.title} · ${l.priceNaira === null ? "Free" : `₦${l.priceNaira.toLocaleString("en-NG")}`}`,
          authorUid: l.sellerUid,
          hoodId: l.neighborhoodId,
          removed: Boolean(l.removedAt),
          content: { kind: "listing", title: l.title, description: l.description, priceNaira: l.priceNaira, photos: l.photos, status: l.status, createdAt: l.createdAt?.toISOString(), removed: Boolean(l.removedAt) },
        };
      },
      setRemoved: async (id, removed, _actor, session) => {
        await this.listings.updateOne({ _id: id }, { $set: { removedAt: removed ? new Date() : null } }, { session }).exec();
      },
      announce: async (id) => {
        const l = await this.findRaw(id);
        if (l) this.realtime.toHood(l.neighborhoodId, "listing.updated", { id });
      },
    });
  }

  private async findRaw(id: string): Promise<Row | null> {
    return Types.ObjectId.isValid(id) ? this.listings.findById(id).lean<Row>().exec() : null;
  }

  private requireHood(viewer: Viewer, hoodId?: string): string {
    // Only your own Hood; anything else looks like it doesn't exist.
    if (!viewer.hoodId || (hoodId && hoodId !== viewer.hoodId)) throw new NotFoundException("Join a neighbourhood to see For Sale & Free.");
    return viewer.hoodId;
  }

  async list(viewer: Viewer, q: ListingQuery): Promise<ListingView[]> {
    const hoodId = this.requireHood(viewer, q.neighborhoodId);
    const hidden = await this.users.hiddenAuthorsFor(viewer.uid);
    const filter: QueryFilter<Listing> = {
      neighborhoodId: hoodId,
      deletedAt: null,
      removedAt: null,
      // Sold items drop out of the list, except for their seller.
      $or: [{ status: { $ne: "sold" } }, { sellerUid: viewer.uid }],
      ...(q.category && { category: q.category }),
      ...(q.free && { priceNaira: null }),
      ...(q.seller ? { sellerUid: q.seller } : hidden.length ? { sellerUid: { $nin: hidden } } : {}),
    };
    const re = searchRegex(q.q);
    if (re) filter.$and = [{ $or: [{ title: re }, { description: re }] }];
    if (q.seller && hidden.includes(q.seller)) return [];
    const rows = await this.listings.find(filter).sort({ createdAt: -1 }).limit(q.limit ?? 60).lean<Row[]>().exec();
    return this.toViews(rows);
  }

  async get(viewer: Viewer, id: string): Promise<ListingView> {
    return (await this.toViews([await this.loadVisible(viewer, id)]))[0]!;
  }

  private async loadVisible(viewer: Viewer, id: string): Promise<Row> {
    const l = await this.findRaw(id);
    const staff = viewer.capabilities.includes("moderation.act");
    if (!l || l.deletedAt || (l.removedAt && !staff) || (l.neighborhoodId !== viewer.hoodId && l.sellerUid !== viewer.uid && !staff)) {
      throw new NotFoundException("This listing isn't available any more.");
    }
    if (l.sellerUid !== viewer.uid && (await this.users.hiddenAuthorsFor(viewer.uid)).includes(l.sellerUid)) {
      throw new NotFoundException("This listing isn't available any more.");
    }
    return l;
  }

  async create(viewer: Viewer, dto: CreateListingDto): Promise<ListingView> {
    const hoodId = this.requireHood(viewer, dto.neighborhoodId);
    const recent = await this.listings.countDocuments({ sellerUid: viewer.uid, createdAt: { $gt: new Date(Date.now() - 86_400_000) } }).exec();
    if (recent >= MAX_LISTINGS_PER_DAY) {
      throw new HttpException(`You can list up to ${MAX_LISTINGS_PER_DAY} items a day. Try again tomorrow.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const free = dto.priceNaira === null;
    const doc = await this.listings.create({
      sellerUid: viewer.uid,
      neighborhoodId: hoodId,
      title: dto.title.trim(),
      description: (dto.description ?? "").trim(),
      priceNaira: dto.priceNaira,
      negotiable: free ? false : Boolean(dto.negotiable),
      category: dto.category,
      condition: dto.condition,
      photos: dto.photos,
    });
    this.realtime.toHood(hoodId, "listing.created", { id: String(doc._id) });
    return (await this.toViews([doc.toObject() as Row]))[0]!;
  }

  async setStatus(viewer: Viewer, id: string, status: ListingStatus): Promise<ListingView> {
    const l = await this.loadVisible(viewer, id);
    if (l.sellerUid !== viewer.uid) throw new ForbiddenException("Only the seller can change this listing.");
    if (l.removedAt) throw new BadRequestException("This listing was removed by our team.");
    const updated = await this.listings.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: "after" }).lean<Row>().exec();
    this.realtime.toHood(l.neighborhoodId, "listing.updated", { id });
    return (await this.toViews([updated!]))[0]!;
  }

  async delete(viewer: Viewer, id: string): Promise<void> {
    const l = await this.loadVisible(viewer, id);
    if (l.sellerUid !== viewer.uid) throw new ForbiddenException("Only the seller can delete this listing.");
    await this.listings.updateOne({ _id: id }, { $set: { deletedAt: new Date() } }).exec();
    this.realtime.toHood(l.neighborhoodId, "listing.updated", { id });
  }

  private async toViews(rows: Row[]): Promise<ListingView[]> {
    const [cards, aspects] = await Promise.all([
      this.users.authorCards(rows.map((r) => r.sellerUid)),
      this.storage.aspectRatios(rows.flatMap((r) => r.photos ?? [])),
    ]);
    return rows.map((l) => {
      const c = cards.get(l.sellerUid);
      return {
        _id: String(l._id),
        sellerUid: l.sellerUid,
        seller: { uid: l.sellerUid, displayName: c?.displayName ?? "Neighbour", photoURL: c?.photoURL },
        neighborhoodId: l.neighborhoodId,
        title: l.title,
        description: l.description,
        priceNaira: l.priceNaira,
        negotiable: l.negotiable,
        category: l.category,
        condition: l.condition,
        photos: l.photos,
        photoAspects: (l.photos ?? []).map((url) => aspects.get(url) ?? null),
        status: l.status,
        createdAt: (l.createdAt ?? new Date()).toISOString(),
      };
    });
  }

  // ── Admin (§13.6) ──────────────────────────────────────────────────────────

  async adminList(
    q: PageQuery & { status?: AdminListingRow["status"]; reported?: boolean; hoodId?: string },
    openReports: (ids: string[]) => Promise<Map<string, number>>,
  ): Promise<Page<AdminListingRow>> {
    const re = searchRegex(q.q);
    const filter: QueryFilter<Listing> = {
      deletedAt: null,
      ...(q.hoodId && { neighborhoodId: q.hoodId }),
      ...(q.status === "removed" ? { removedAt: { $ne: null } } : q.status === "sold" ? { removedAt: null, status: "sold" } : q.status === "active" ? { removedAt: null, status: { $ne: "sold" } } : {}),
      ...(re && { title: re }),
    };
    let rows = await this.listings.find(filter).sort({ createdAt: -1 }).limit(q.reported ? 1000 : q.page * q.pageSize).lean<Row[]>().exec();
    const counts = await openReports(rows.map((r) => String(r._id)));
    if (q.reported) rows = rows.filter((r) => (counts.get(String(r._id)) ?? 0) > 0);
    const total = q.reported ? rows.length : await this.listings.countDocuments(filter).exec();
    const pageRows = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    const [cards, hoods] = await Promise.all([this.users.authorCards(pageRows.map((r) => r.sellerUid)), this.hoods.findManyByIds(pageRows.map((r) => r.neighborhoodId))]);
    return {
      items: pageRows.map((l) => ({
        id: String(l._id),
        title: l.title,
        priceNaira: l.priceNaira,
        category: l.category,
        seller: { uid: l.sellerUid, displayName: cards.get(l.sellerUid)?.displayName ?? "Neighbour" },
        hood: hoods.get(l.neighborhoodId) ? { id: l.neighborhoodId, name: hoods.get(l.neighborhoodId)!.name } : undefined,
        createdAt: (l.createdAt ?? new Date()).toISOString(),
        status: l.removedAt ? "removed" : l.status === "sold" ? "sold" : "active",
        openReports: counts.get(String(l._id)) ?? 0,
      })),
      page: q.page,
      pageSize: q.pageSize,
      total,
    };
  }

  countActive(): Promise<number> {
    return this.listings.countDocuments({ deletedAt: null, removedAt: null, status: { $ne: "sold" } }).exec();
  }
}
