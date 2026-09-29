import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes } from "node:crypto";
import { Model, Types, type QueryFilter } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { CommunicationsService } from "../communications/communications.service";
import { messageEmail } from "../communications/templates/email-templates";
import { ModerationRegistry } from "../moderation/moderation-registry";
import type { Viewer } from "../shared/auth/viewer";
import { searchRegex, type Page } from "../shared/http/pagination";
import type { AdminBusinessQuery, BusinessActionDto, BusinessApplicationDto } from "./businesses.dto";
import { BUSINESS_CATEGORIES, BusinessPage, BusinessPageDocument, type BusinessStatus } from "./business.schema";

const CATEGORY_LABEL: Record<(typeof BUSINESS_CATEGORIES)[number], string> = {
  home_services: "Artisan / home services",
  food: "Food & catering",
  retail: "Shop / supermarket",
  beauty: "Beauty & wellness",
  education: "School / tutoring",
  property: "Property & facilities",
  health: "Health & pharmacy",
  other: "Something else",
};

export interface AdminBusinessRow {
  id: string;
  name: string;
  category: string;
  owner: { name: string; email: string; phone: string };
  areasServed: string[];
  status: BusinessStatus;
  cacNumber?: string;
  appliedAt: string;
  openReports: number;
}

type Row = BusinessPage & { _id: Types.ObjectId };
const APPLICATIONS_PER_PHONE_PER_DAY = 3;
const CLAIM_TTL_MS = 7 * 86_400_000;
const PUBLIC_FOOTER = "You're getting this because you applied for a myHoodora Business Page.";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

const NEXT: Record<BusinessActionDto["action"], BusinessStatus> = {
  approve: "verified",
  request_info: "info_requested",
  reject: "rejected",
  suspend: "suspended",
  reinstate: "verified",
};
/** Audit action names the admin UI already knows. */
const AUDIT: Record<BusinessActionDto["action"], string> = {
  approve: "business_approve",
  request_info: "business_request_info",
  reject: "business_reject",
  suspend: "business_suspend",
  reinstate: "business_approve",
};

@Injectable()
export class BusinessesService implements OnModuleInit {
  constructor(
    @InjectModel(BusinessPage.name) private readonly pages: Model<BusinessPageDocument>,
    private readonly comms: CommunicationsService,
    private readonly audit: AuditService,
    private readonly registry: ModerationRegistry,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.registry.register({
      type: "business",
      load: async (id) => {
        const b = await this.raw(id);
        if (!b) return null;
        return {
          type: "business",
          id,
          preview: `${b.businessName}: ${b.description.slice(0, 120)}`,
          authorUid: b.ownerUid,
          removed: b.status === "suspended",
          content: { kind: "business", name: b.businessName, category: CATEGORY_LABEL[b.category], description: b.description, areasServed: b.areasServed, removed: b.status === "suspended" },
        };
      },
      setRemoved: async (id, removed, _actor, session) => {
        await this.pages.updateOne({ _id: id, status: removed ? "verified" : "suspended" }, { $set: { status: removed ? "suspended" : "verified" } }, { session }).exec();
      },
    });
  }

  private raw(id: string): Promise<Row | null> {
    return Types.ObjectId.isValid(id) ? this.pages.findById(id).lean<Row>().exec() : Promise.resolve(null);
  }

  // ── Public application ────────────────────────────────────────────────────

  async apply(dto: BusinessApplicationDto): Promise<{ id: string; status: "pending_review" }> {
    const recent = await this.pages.countDocuments({ phone: dto.phone, createdAt: { $gt: new Date(Date.now() - 86_400_000) } }).exec();
    if (recent >= APPLICATIONS_PER_PHONE_PER_DAY) throw new HttpException("We've already received applications from this number today.", HttpStatus.TOO_MANY_REQUESTS);
    const doc = await this.pages.create({
      ...dto,
      businessName: dto.businessName.trim(),
      description: dto.description.trim(),
      cacNumber: dto.cacNumber?.replace(/\s/g, "").toUpperCase(),
      checks: { phone: "pending", cac: dto.cacNumber ? "pending" : "not_provided" },
    });
    await this.comms.sendEmail({
      to: dto.email,
      type: "business_applied",
      email: messageEmail({
        subject: `We received your Business Page application for ${doc.businessName}`,
        name: dto.contactName,
        paragraphs: [
          "Thanks for applying. Our team will confirm your phone number and, if you gave one, check your CAC number.",
          "Once approved we'll email you a link to claim your page with your myHoodora account. This usually takes 1–3 working days.",
        ],
        footer: PUBLIC_FOOTER,
      }),
      idempotencyKey: `business-applied:${doc._id}`,
    });
    return { id: String(doc._id), status: "pending_review" };
  }

  /** POST /business-pages/claim — link an approved page to the signed-in account. */
  async claim(viewer: Viewer, token: string): Promise<{ id: string; businessName: string }> {
    const page = await this.pages
      .findOneAndUpdate(
        { claimTokenHash: hash(token), claimTokenExpiresAt: { $gt: new Date() }, status: "verified" },
        { $set: { ownerUid: viewer.uid }, $unset: { claimTokenHash: 1, claimTokenExpiresAt: 1 } },
        { returnDocument: "after" },
      )
      .lean<Row>()
      .exec();
    if (!page) throw new BadRequestException("This claim link is invalid or has expired. Ask us for a new one.");
    await this.audit.record(viewer, "business_claim", { type: "business", id: String(page._id), label: page.businessName });
    return { id: String(page._id), businessName: page.businessName };
  }

  async mine(viewer: Viewer) {
    const rows = await this.pages.find({ ownerUid: viewer.uid }).lean<Row[]>().exec();
    return rows.map((b) => ({ id: String(b._id), businessName: b.businessName, category: b.category, status: b.status, areasServed: b.areasServed }));
  }

  // ── Staff (§13.7) ──────────────────────────────────────────────────────────

  pendingCount(): Promise<number> {
    return this.pages.countDocuments({ status: { $in: ["applied", "info_requested"] } }).exec();
  }

  async adminList(q: AdminBusinessQuery, openReports: (ids: string[]) => Promise<Map<string, number>>): Promise<Page<AdminBusinessRow>> {
    const tab = q.tab ?? "applications";
    const re = searchRegex(q.q);
    const filter: QueryFilter<BusinessPage> = {
      ...(tab === "applications" && { status: { $in: ["applied", "info_requested"] } }),
      ...(tab === "verified" && { status: "verified" }),
      ...(tab === "rejected" && { status: "rejected" }),
      ...(q.category && { category: q.category as BusinessPage["category"] }),
      ...(q.area && { areasServed: q.area }),
      ...(re && { $or: [{ businessName: re }, { contactName: re }, { email: re }, { areasServed: re }] }),
    };
    let rows = await this.pages.find(filter).sort({ createdAt: 1 }).limit(tab === "reported" ? 1000 : q.page * q.pageSize).lean<Row[]>().exec();
    const counts = await openReports(rows.map((r) => String(r._id)));
    if (tab === "reported") rows = rows.filter((r) => (counts.get(String(r._id)) ?? 0) > 0 || r.status === "suspended");
    const total = tab === "reported" ? rows.length : await this.pages.countDocuments(filter).exec();
    return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((b) => this.toRow(b, counts)), page: q.page, pageSize: q.pageSize, total };
  }

  async adminDetail(id: string, openReports: (ids: string[]) => Promise<Map<string, number>>) {
    const b = await this.raw(id);
    if (!b) throw new NotFoundException("Business not found.");
    const [counts, timeline] = await Promise.all([openReports([id]), this.audit.forTarget("business", id)]);
    return { ...this.toRow(b, counts), description: b.description, address: b.address, checks: b.checks, wantsAdsUpdates: b.wantsAdsUpdates, claimed: Boolean(b.ownerUid), timeline };
  }

  async act(actor: Viewer, id: string, dto: BusinessActionDto): Promise<void> {
    const b = await this.raw(id);
    if (!b) throw new NotFoundException("Business not found.");
    if ((dto.action === "request_info" || dto.action === "reject") && !dto.message?.trim() && !dto.reason?.trim()) {
      throw new BadRequestException("Tell the applicant what you need or why.");
    }
    if (dto.action === "reinstate" && b.status !== "suspended") throw new ConflictException("Only suspended pages can be reinstated.");
    if (dto.action === "suspend" && b.status !== "verified") throw new ConflictException("Only live pages can be suspended.");

    const set: Record<string, unknown> = { status: NEXT[dto.action] };
    if (dto.cac) set["checks.cac"] = dto.cac;
    let claimToken: string | undefined;
    if (dto.action === "approve") {
      // Approving means staff confirmed the phone number.
      set["checks.phone"] = "verified";
      if (!b.ownerUid) {
        claimToken = randomBytes(32).toString("base64url");
        set.claimTokenHash = hash(claimToken);
        set.claimTokenExpiresAt = new Date(Date.now() + CLAIM_TTL_MS);
      }
    }
    await this.pages.updateOne({ _id: id }, { $set: set }).exec();
    await this.audit.record(actor, AUDIT[dto.action], { type: "business", id, label: b.businessName }, { reason: dto.reason, note: dto.message });
    await this.emailApplicant(b, dto, claimToken);
  }

  private async emailApplicant(b: Row, dto: BusinessActionDto, claimToken?: string): Promise<void> {
    const appUrl = this.config.get<string>("appUrl");
    const copy: Record<BusinessActionDto["action"], { subject: string; paragraphs: string[]; cta?: { href: string; label: string } }> = {
      approve: {
        subject: `${b.businessName} is approved on myHoodora`,
        paragraphs: claimToken
          ? ["Good news: your Business Page is approved. Claim it with your myHoodora account to manage it. Sign in (or create an account) with any email, then open the link below. It works once and expires in 7 days."]
          : ["Good news: your Business Page is approved and live."],
        cta: claimToken ? { href: `${appUrl}/business/claim?token=${encodeURIComponent(claimToken)}`, label: "Claim my page" } : undefined,
      },
      request_info: { subject: `We need a little more about ${b.businessName}`, paragraphs: [dto.message?.trim() || dto.reason!, "Reply to this email with the details and we'll continue the review."] },
      reject: { subject: `Your Business Page application for ${b.businessName}`, paragraphs: ["Thanks for applying. We couldn't approve this page.", dto.message?.trim() || `Reason: ${dto.reason}`] },
      suspend: { subject: `${b.businessName} has been suspended`, paragraphs: [`Your Business Page is hidden while we review it.${dto.message ? `\n\n${dto.message}` : dto.reason ? ` Reason: ${dto.reason}.` : ""}`, "Reply to this email if you think this is a mistake."] },
      reinstate: { subject: `${b.businessName} is live again`, paragraphs: ["Your Business Page is visible to neighbours again. Thanks for your patience."] },
    };
    const c = copy[dto.action];
    await this.comms.sendEmail({
      uid: b.ownerUid,
      to: b.email,
      type: `business_${dto.action}`,
      email: messageEmail({ subject: c.subject, name: b.contactName, paragraphs: c.paragraphs, cta: c.cta, footer: PUBLIC_FOOTER }),
      idempotencyKey: `business:${b._id}:${dto.action}:${Date.now()}`,
    });
  }

  /** Business owners who asked for Local Ads updates (admin sign-ups list). */
  async adsWaitlist() {
    const rows = await this.pages.find({ wantsAdsUpdates: true }).sort({ createdAt: -1 }).limit(1000).lean<Row[]>().exec();
    return rows.map((b) => ({
      id: String(b._id),
      type: "business_ads" as const,
      name: b.contactName,
      email: b.email,
      detail: `${b.businessName} · ${CATEGORY_LABEL[b.category]} · ${b.areasServed.join(", ")}`,
      at: (b.createdAt ?? new Date()).toISOString(),
    }));
  }

  private toRow(b: Row, counts: Map<string, number>): AdminBusinessRow {
    return {
      id: String(b._id),
      name: b.businessName,
      category: CATEGORY_LABEL[b.category] ?? b.category,
      owner: { name: b.contactName, email: b.email, phone: b.phone },
      areasServed: b.areasServed,
      status: b.status,
      cacNumber: b.cacNumber,
      appliedAt: (b.createdAt ?? new Date()).toISOString(),
      openReports: counts.get(String(b._id)) ?? 0,
    };
  }
}
