import { BadRequestException, Injectable, type OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { HoodsService } from "../hoods/hoods.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { Viewer } from "../shared/auth/viewer";
import { withTransaction } from "../shared/db/transaction";
import { AccountLifecycle } from "../users/account-lifecycle";
import { User, UserDocument } from "../users/schemas/user.schema";
import { HoodRole } from "./moderation.schemas";

/** Minimum active Leads before a Hood's reports go to a vote (Nextdoor-style). */
export const MIN_LEADS_FOR_VOTING = 3;
export const MAX_LEADS_PER_HOOD = 15;

export interface LeadCard {
  uid: string;
  displayName: string;
  photoURL?: string;
  since: string;
}

/** Who leads which Hood. No dependency on the rest of moderation. */
@Injectable()
export class LeadsRosterService implements OnModuleInit {
  constructor(
    @InjectModel(HoodRole.name) private readonly roles: Model<HoodRole>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly hoods: HoodsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly accounts: AccountLifecycle,
  ) {}

  onModuleInit() {
    this.accounts.register({
      name: "hood-leads",
      purge: async (uid, dryRun) => ({ hoodLeadRoles: dryRun ? await this.roles.countDocuments({ uid }).exec() : (await this.roles.deleteMany({ uid }).exec()).deletedCount }),
    });
  }

  /** Leads who can still act (verified, active, still in that Hood). */
  private async activeLeadUids(hoodId: string): Promise<string[]> {
    const uids = (await this.roles.find({ hoodId }).select({ uid: 1 }).lean<Pick<HoodRole, "uid">[]>().exec()).map((r) => r.uid);
    if (!uids.length) return [];
    const ok = await this.users
      .find({ uid: { $in: uids }, neighborhoodId: hoodId, verificationStatus: "verified", accountStatus: "active", deactivatedAt: null })
      .select({ uid: 1 })
      .lean<Pick<User, "uid">[]>()
      .exec();
    return ok.map((u) => u.uid);
  }

  async activeLeadCount(hoodId: string): Promise<number> {
    return (await this.activeLeadUids(hoodId)).length;
  }

  async isActiveLead(uid: string, hoodId: string | null): Promise<boolean> {
    return Boolean(hoodId) && (await this.activeLeadUids(hoodId!)).includes(uid);
  }

  async leadsOf(hoodId: string): Promise<LeadCard[]> {
    const rows = await this.roles.find({ hoodId }).sort({ createdAt: 1 }).lean<HoodRole[]>().exec();
    const users = await this.users.find({ uid: { $in: rows.map((r) => r.uid) } }).select({ uid: 1, displayName: 1, photoURL: 1 }).lean<User[]>().exec();
    const byUid = new Map(users.map((u) => [u.uid, u]));
    return rows.map((r) => ({ uid: r.uid, displayName: byUid.get(r.uid)?.displayName ?? "Neighbour", photoURL: byUid.get(r.uid)?.photoURL, since: (r.createdAt ?? new Date()).toISOString() }));
  }

  /** PUT /admin/hoods/:id/leads — replace the roster (admins). */
  async setLeads(actor: Viewer, hoodId: string, uids: string[]): Promise<LeadCard[]> {
    const hood = await this.hoods.findById(hoodId);
    const wanted = [...new Set(uids)];
    if (wanted.length > MAX_LEADS_PER_HOOD) throw new BadRequestException(`A Hood can have up to ${MAX_LEADS_PER_HOOD} Leads.`);
    const eligible = await this.users
      .find({ uid: { $in: wanted }, neighborhoodId: hoodId, verificationStatus: "verified", accountStatus: "active", deactivatedAt: null })
      .select({ uid: 1 })
      .lean<Pick<User, "uid">[]>()
      .exec();
    if (eligible.length !== wanted.length) throw new BadRequestException("Leads must be active, verified neighbours of this Hood.");

    const current = (await this.roles.find({ hoodId }).lean<HoodRole[]>().exec()).map((r) => r.uid);
    const added = wanted.filter((u) => !current.includes(u));
    const removed = current.filter((u) => !wanted.includes(u));
    // The roster and its audit records together: an appointment nobody is recorded as making must not exist.
    await withTransaction(this.connection, async (session) => {
      if (removed.length) await this.roles.deleteMany({ hoodId, uid: { $in: removed } }, { session }).exec();
      if (added.length) await this.roles.insertMany(added.map((uid) => ({ hoodId, uid, role: "lead", appointedBy: actor.uid })), { session });
      for (const uid of added) await this.audit.record(actor, "lead_appoint", { type: "user", id: uid, label: hood.name }, {}, session);
      for (const uid of removed) await this.audit.record(actor, "lead_remove", { type: "user", id: uid, label: hood.name }, {}, session);
    });
    await this.notifications.notify({
      uids: added,
      type: "moderation",
      title: `You're now a Hood Lead for ${hood.name}`,
      body: "You'll help review reported posts in your neighbourhood. Thank you for looking out for your neighbours.",
      href: "/leads",
    });
    return this.leadsOf(hoodId);
  }
}
