import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditService } from "../audit/audit.service";
import { CreateHoodDto, UpdateHoodDto } from "../hoods/dto/hood.dto";
import { HoodsService } from "../hoods/hoods.service";
import { ModerationRegistry } from "../moderation/moderation-registry";
import { ModerationService } from "../moderation/moderation.service";
import { ALERT_CATEGORIES } from "../platform/platform-settings.schema";
import { PlatformSettingsService } from "../platform/platform-settings.service";
import { PostsService } from "../posts/posts.service";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { StaffUsersService } from "../users/staff-users.service";
import {
  AdminPostQuery,
  AdminReportQuery,
  AlertActionDto,
  AlertQueryDto,
  AuditQueryDto,
  BroadcastDto,
  BulkNeighbourDto,
  ContentActionDto,
  DecisionDto,
  EstimateDto,
  HoodQueryDto,
  NeighbourActionDto,
  NeighbourQueryDto,
  SettingsDto,
  TeamRoleDto,
  VerificationQueryDto,
} from "./admin.dto";
import { AdminReadService } from "./admin-read.service";
import { BroadcastsService, type Audience } from "./broadcasts.service";

/** §13.1 capability names exposed to the web (owner-only ones omitted). */
const CONTRACT_CAPABILITIES = ["moderation.act", "moderation.suspend", "verification.review", "hoods.manage", "businesses.review", "broadcasts.send", "team.manage", "settings.manage", "team.manage.admins"];

@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@Can("admin.access")
@Controller("admin")
export class AdminController {
  constructor(
    private readonly read: AdminReadService,
    private readonly moderation: ModerationService,
    private readonly audit: AuditService,
    private readonly staffUsers: StaffUsersService,
    private readonly hoods: HoodsService,
    private readonly posts: PostsService,
    private readonly registry: ModerationRegistry,
    private readonly settings: PlatformSettingsService,
    private readonly broadcasts: BroadcastsService,
  ) {}

  // ── 13.1 Session & overview ────────────────────────────────────────────────

  @Get("me")
  me(@CurrentViewer() v: Viewer) {
    return { uid: v.uid, displayName: v.displayName ?? "Staff", role: v.role, can: v.capabilities.filter((c) => CONTRACT_CAPABILITIES.includes(c)) };
  }

  @Get("overview")
  overview() {
    return this.read.overview();
  }

  // ── 13.2 Moderation ────────────────────────────────────────────────────────

  @Get("reports")
  @Can("moderation.act")
  reports(@Query() q: AdminReportQuery) {
    return this.moderation.list(q);
  }

  @Get("reports/:id")
  @Can("moderation.act")
  report(@Param("id", ParseObjectIdPipe) id: string) {
    return this.moderation.detail(id);
  }

  @Post("reports/:id/claim")
  @Can("moderation.act")
  claim(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.moderation.setClaim(v, id, true);
  }

  @Post("reports/:id/release")
  @Can("moderation.act")
  release(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.moderation.setClaim(v, id, false);
  }

  @Post("reports/:id/actions")
  @Can("moderation.act")
  decide(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: DecisionDto) {
    return this.moderation.decide(v, id, body);
  }

  @Get("audit")
  @Can("moderation.act")
  auditLog(@Query() q: AuditQueryDto) {
    return this.audit.list(q);
  }

  // ── 13.3 Neighbours ────────────────────────────────────────────────────────

  @Get("neighbours")
  async neighbours(@Query() q: NeighbourQueryDto) {
    const page = await this.staffUsers.list(q);
    const items = await Promise.all(page.items.map(async (n) => ({ ...n, counts: await this.read.neighbourCounts(n.uid) })));
    return { ...page, items };
  }

  @Get("neighbours/:uid")
  async neighbour(@Param("uid") uid: string) {
    const u = await this.staffUsers.get(uid);
    const [row] = await this.staffUsers.toRows([u]);
    return {
      ...row!,
      counts: await this.read.neighbourCounts(uid),
      location: u.location?.address ? { address: u.location.address, lat: u.location.lat ?? 0, lng: u.location.lng ?? 0 } : undefined,
      verificationAttempts: (u.verificationAttempts ?? []).map((a) => ({ at: a.at.toISOString(), address: a.address ?? "", point: { lat: a.lat, lng: a.lng }, result: a.result })),
      timeline: await this.audit.forTarget("user", uid),
    };
  }

  @Get("neighbours/:uid/posts")
  neighbourPosts(@Param("uid") uid: string, @Query() q: AdminPostQuery) {
    return this.read.listPosts({ ...q, authorUid: uid, reported: q.reported === "true" });
  }

  @Get("neighbours/:uid/reports")
  neighbourReports(@Param("uid") uid: string, @Query() q: AdminReportQuery) {
    return this.moderation.list({ ...q, authorUid: uid, status: q.status ?? "all" });
  }

  @Post("neighbours/bulk")
  async bulk(@CurrentViewer() v: Viewer, @Body() body: BulkNeighbourDto) {
    this.assertNeighbourCapability(v, body.action);
    const { uids, ...input } = body;
    for (const uid of uids) await this.staffUsers.act(v, uid, input);
    return { updated: uids.length };
  }

  @Post("neighbours/:uid/actions")
  async act(@CurrentViewer() v: Viewer, @Param("uid") uid: string, @Body() body: NeighbourActionDto) {
    this.assertNeighbourCapability(v, body.action);
    await this.staffUsers.act(v, uid, body);
    return this.neighbour(uid);
  }

  private assertNeighbourCapability(v: Viewer, action: NeighbourActionDto["action"]) {
    const needs = action === "verify" || action === "reject_verification" || action === "change_hood" ? "verification.review" : "moderation.act";
    if (!v.capabilities.includes(needs)) throw new ForbiddenException("You don't have access to this.");
  }

  // ── 13.4 Verification queue ────────────────────────────────────────────────

  @Get("verification")
  @Can("verification.review")
  verification(@Query() q: VerificationQueryDto) {
    return this.staffUsers.verificationQueue(q);
  }

  // ── 13.5 Hoods ─────────────────────────────────────────────────────────────

  @Get("hoods")
  hoodsList(@Query() q: HoodQueryDto) {
    return this.read.listHoods(q);
  }

  @Get("hoods/:id")
  hood(@Param("id", ParseObjectIdPipe) id: string) {
    return this.read.hoodDetail(id);
  }

  @Get("hoods/:id/members")
  hoodMembers(@Param("id", ParseObjectIdPipe) id: string, @Query() q: NeighbourQueryDto) {
    return this.staffUsers.list({ ...q, hoodId: id });
  }

  @Get("hoods/:id/posts")
  hoodPosts(@Param("id", ParseObjectIdPipe) id: string, @Query() q: AdminPostQuery) {
    return this.read.listPosts({ ...q, hoodId: id, reported: q.reported === "true" });
  }

  @Get("hoods/:id/reports")
  hoodReports(@Param("id", ParseObjectIdPipe) id: string, @Query() q: AdminReportQuery) {
    return this.moderation.list({ ...q, hoodId: id, status: q.status ?? "active" });
  }

  @Post("hoods")
  @Can("hoods.manage")
  async createHood(@CurrentViewer() v: Viewer, @Body() body: CreateHoodDto) {
    const hood = await this.hoods.create(body);
    await this.audit.record(v, "hood_create", { type: "hood", id: hood.id as string, label: hood.name });
    return this.read.hoodDetail(hood.id as string);
  }

  @Patch("hoods/:id")
  @Can("hoods.manage")
  async updateHood(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: UpdateHoodDto) {
    const { reason, ...patch } = body;
    const hood = await this.hoods.update(id, patch);
    await this.audit.record(v, patch.status === "archived" ? "hood_archive" : "hood_update", { type: "hood", id, label: hood.name }, { reason });
    return this.read.hoodDetail(id);
  }

  // ── 13.6 Content ───────────────────────────────────────────────────────────

  @Get("posts")
  postsList(@Query() q: AdminPostQuery) {
    return this.read.listPosts({ ...q, reported: q.reported === "true" });
  }

  @Get("posts/:id")
  post(@Param("id", ParseObjectIdPipe) id: string) {
    return this.read.postDetail(id);
  }

  @Post("posts/:id/actions")
  @Can("moderation.act")
  postAction(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ContentActionDto) {
    return this.contentAction(v, "post", id, body);
  }

  @Post("comments/:id/actions")
  @Can("moderation.act")
  commentAction(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ContentActionDto) {
    return this.contentAction(v, "comment", id, body);
  }

  private async contentAction(v: Viewer, type: "post" | "comment", id: string, body: ContentActionDto) {
    const handler = this.registry.get(type)!;
    const snap = await handler.load(id);
    if (!snap) throw new NotFoundException("Not found.");
    await handler.setRemoved(id, body.action === "remove", v.uid);
    await this.audit.record(v, body.action === "remove" ? "remove_content" : "restore_content", { type, id, label: `“${snap.preview.slice(0, 60)}”` }, { reason: body.reason, note: body.note });
    return { ok: true };
  }

  @Get("alerts")
  alerts(@Query() q: AlertQueryDto) {
    return this.read.listAlerts(q);
  }

  @Post("alerts/:id/actions")
  @Can("moderation.act")
  async alertAction(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: AlertActionDto) {
    const snap = await this.registry.get("post")!.load(id);
    if (!snap) throw new NotFoundException("Alert not found.");
    if (body.action === "remove") await this.registry.get("post")!.setRemoved(id, true, v.uid);
    else await this.posts.staffAlertAction(id, body.action, v.uid);
    const action = body.action === "end" ? "alert_end" : body.action === "downgrade" ? "alert_downgrade" : "remove_content";
    await this.audit.record(v, action, { type: "post", id, label: `“${snap.preview.slice(0, 60)}”` }, { reason: body.reason });
    return { ok: true };
  }

  // ── 13.8 Broadcasts ────────────────────────────────────────────────────────

  @Get("broadcasts")
  @Can("broadcasts.send")
  broadcastList() {
    return this.broadcasts.list();
  }

  @Post("broadcasts/estimate")
  @Can("broadcasts.send")
  async estimate(@Body() body: EstimateDto) {
    return { estimatedReach: await this.broadcasts.estimate(toAudience(body.audience)) };
  }

  @Post("broadcasts")
  @Can("broadcasts.send")
  send(@CurrentViewer() v: Viewer, @Body() body: BroadcastDto) {
    return this.broadcasts.send(v, { title: body.title, body: body.body, audience: toAudience(body.audience) });
  }

  // ── 13.9 Insights, team, settings ──────────────────────────────────────────

  @Get("insights")
  insights() {
    return this.read.insights();
  }

  @Get("team")
  @Can("team.manage")
  async team() {
    return this.staffUsers.team();
  }

  @Patch("team/:uid")
  @Can("team.manage")
  async setRole(@CurrentViewer() v: Viewer, @Param("uid") uid: string, @Body() body: TeamRoleDto) {
    if (uid === v.uid) throw new BadRequestException("You can't change your own role.");
    await this.staffUsers.setRole(v, uid, body.role);
    return this.staffUsers.team();
  }

  @Get("settings")
  @Can("settings.manage")
  async getSettings() {
    const [settings, coverageCities] = await Promise.all([this.settings.get(), this.hoods.coverageCities()]);
    return { ...settings, coverageCities };
  }

  @Patch("settings")
  @Can("settings.manage")
  async updateSettings(@CurrentViewer() v: Viewer, @Body() body: SettingsDto) {
    for (const [k, hours] of Object.entries(body.alertWindows ?? {})) {
      if (!(ALERT_CATEGORIES as readonly string[]).includes(k) || typeof hours !== "number" || hours < 1 || hours > 24 * 30) {
        throw new BadRequestException("Alert windows must be between 1 hour and 30 days.");
      }
    }
    const next = await this.settings.update({ alertWindows: body.alertWindows, reportReasons: body.reportReasons?.map(({ id, severity, staffOnly }) => ({ id, severity, staffOnly })) });
    await this.audit.record(v, "settings_update", { type: "settings", id: "platform", label: "Platform settings" });
    return { ...next, coverageCities: await this.hoods.coverageCities() };
  }
}

function toAudience(a: { type: "all" | "hood" | "user"; hoodIds?: string[]; uids?: string[] }): Audience {
  if (a.type === "hood") return { type: "hood", hoodIds: a.hoodIds ?? [] };
  if (a.type === "user") return { type: "user", uids: a.uids ?? [] };
  return { type: "all" };
}
