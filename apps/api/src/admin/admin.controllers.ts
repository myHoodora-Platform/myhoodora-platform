import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuditService } from "../audit/audit.service";
import { CreateHoodDto, UpdateHoodDto } from "../hoods/dto/hood.dto";
import { HoodsService } from "../hoods/hoods.service";
import { HoodLeadsService } from "../moderation/hood-leads.service";
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
import { ContentActionsService } from "./content-actions.service";
import { ApiStandardErrors } from "../shared/http/api-docs";

/** §13.1 capability names exposed to the web (owner-only ones omitted). */
const CONTRACT_CAPABILITIES = ["moderation.act", "moderation.suspend", "verification.review", "hoods.manage", "businesses.review", "broadcasts.send", "team.manage", "settings.manage", "team.manage.admins"];

@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
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
    private readonly leads: HoodLeadsService,
    private readonly contentActions: ContentActionsService,
  ) {}

  // ── 13.1 Session & overview ────────────────────────────────────────────────

  @Get("me")
  @ApiOperation({ summary: "Your staff session: role and capabilities (403 for non-staff)" })
  me(@CurrentViewer() v: Viewer) {
    return { uid: v.uid, displayName: v.displayName ?? "Staff", role: v.role, can: v.capabilities.filter((c) => CONTRACT_CAPABILITIES.includes(c)) };
  }

  @Get("overview")
  @ApiOperation({ summary: "What needs attention + weekly pulse + recent staff actions" })
  overview() {
    return this.read.overview();
  }

  // ── 13.2 Moderation ────────────────────────────────────────────────────────

  @Get("reports")
  @Can("moderation.act")
  @ApiOperation({ summary: "Report queue (one row per reported item), most severe and oldest first" })
  async reports(@Query() q: AdminReportQuery) {
    await this.leads.escalateStale();
    return this.moderation.list(q);
  }

  @Get("reports/:id")
  @Can("moderation.act")
  @ApiOperation({ summary: "Report detail: content, author, reporters (staff only), related, timeline, Lead votes" })
  async report(@Param("id", ParseObjectIdPipe) id: string) {
    const [detail, votes] = await Promise.all([this.moderation.detail(id), this.leads.votesFor(id)]);
    return { ...detail, leadVotes: detail.route === "leads" || votes.total ? votes : undefined };
  }

  @Post("reports/:id/claim")
  @ApiOperation({ summary: "Claim a report so no one else works on it (409 if taken)" })
  @Can("moderation.act")
  claim(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.moderation.setClaim(v, id, true);
  }

  @Post("reports/:id/release")
  @ApiOperation({ summary: "Release your claim on a report" })
  @Can("moderation.act")
  release(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.moderation.setClaim(v, id, false);
  }

  @Post("reports/:id/actions")
  @ApiOperation({ summary: "Decide: keep · remove_content · warn/restrict/suspend author · escalate" })
  @Can("moderation.act")
  decide(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: DecisionDto) {
    return this.moderation.decide(v, id, body);
  }

  @Get("audit")
  @ApiOperation({ summary: "Moderation history (append-only)" })
  @Can("moderation.act")
  auditLog(@Query() q: AuditQueryDto) {
    return this.audit.list(q);
  }

  // ── 13.3 Neighbours ────────────────────────────────────────────────────────

  @Get("neighbours")
  @ApiOperation({ summary: "Neighbours with filters" })
  async neighbours(@Query() q: NeighbourQueryDto) {
    const page = await this.staffUsers.list(q);
    const items = await Promise.all(page.items.map(async (n) => ({ ...n, counts: await this.read.neighbourCounts(n.uid) })));
    return { ...page, items };
  }

  @Get("neighbours/:uid")
  @ApiOperation({ summary: "Neighbour detail (address for admins only)" })
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
  @ApiOperation({ summary: "A neighbour's posts" })
  neighbourPosts(@Param("uid") uid: string, @Query() q: AdminPostQuery) {
    return this.read.listPosts({ ...q, authorUid: uid, reported: q.reported === "true" });
  }

  @Get("neighbours/:uid/reports")
  @ApiOperation({ summary: "Reports about a neighbour's content" })
  neighbourReports(@Param("uid") uid: string, @Query() q: AdminReportQuery) {
    return this.moderation.list({ ...q, authorUid: uid, status: q.status ?? "all" });
  }

  @Post("neighbours/bulk")
  @ApiOperation({ summary: "Bulk verify / restrict (max 100)" })
  async bulk(@CurrentViewer() v: Viewer, @Body() body: BulkNeighbourDto) {
    this.assertNeighbourCapability(v, body.action);
    const { uids, ...input } = body;
    for (const uid of uids) await this.staffUsers.act(v, uid, input);
    return { updated: uids.length };
  }

  @Post("neighbours/:uid/actions")
  @ApiOperation({ summary: "verify · reject_verification · change_hood · warn · restrict · suspend · reinstate" })
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
  @ApiOperation({ summary: "Address verification queue (pending review + failed attempts)" })
  @Can("verification.review")
  verification(@Query() q: VerificationQueryDto) {
    return this.staffUsers.verificationQueue(q);
  }

  // ── 13.5 Hoods ─────────────────────────────────────────────────────────────

  @Get("hoods")
  @ApiOperation({ summary: "Hoods with stats" })
  hoodsList(@Query() q: HoodQueryDto) {
    return this.read.listHoods(q);
  }

  @Get("hoods/:id")
  @ApiOperation({ summary: "Hood detail, 7-day members series and timeline" })
  hood(@Param("id", ParseObjectIdPipe) id: string) {
    return this.read.hoodDetail(id);
  }

  @Get("hoods/:id/members")
  @ApiOperation({ summary: "Members of a Hood" })
  hoodMembers(@Param("id", ParseObjectIdPipe) id: string, @Query() q: NeighbourQueryDto) {
    return this.staffUsers.list({ ...q, hoodId: id });
  }

  @Get("hoods/:id/posts")
  @ApiOperation({ summary: "Posts in a Hood" })
  hoodPosts(@Param("id", ParseObjectIdPipe) id: string, @Query() q: AdminPostQuery) {
    return this.read.listPosts({ ...q, hoodId: id, reported: q.reported === "true" });
  }

  @Get("hoods/:id/reports")
  @ApiOperation({ summary: "Reports in a Hood" })
  hoodReports(@Param("id", ParseObjectIdPipe) id: string, @Query() q: AdminReportQuery) {
    return this.moderation.list({ ...q, hoodId: id, status: q.status ?? "active" });
  }

  @Post("hoods")
  @ApiOperation({ summary: "Create a Hood (409 + overlaps if it overlaps another)" })
  @Can("hoods.manage")
  async createHood(@CurrentViewer() v: Viewer, @Body() body: CreateHoodDto) {
    const hood = await this.hoods.create(body);
    await this.audit.record(v, "hood_create", { type: "hood", id: hood.id as string, label: hood.name });
    return this.read.hoodDetail(hood.id as string);
  }

  @Patch("hoods/:id")
  @ApiOperation({ summary: "Rename, resize, pause or archive a Hood" })
  @Can("hoods.manage")
  async updateHood(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: UpdateHoodDto) {
    const { reason, ...patch } = body;
    const hood = await this.hoods.update(id, patch);
    await this.audit.record(v, patch.status === "archived" ? "hood_archive" : "hood_update", { type: "hood", id, label: hood.name }, { reason });
    return this.read.hoodDetail(id);
  }

  // ── 13.6 Content ───────────────────────────────────────────────────────────

  @Get("posts")
  @ApiOperation({ summary: "Posts across Hoods (filters incl. reported/removed)" })
  postsList(@Query() q: AdminPostQuery) {
    return this.read.listPosts({ ...q, reported: q.reported === "true" });
  }

  @Get("posts/:id")
  @ApiOperation({ summary: "Post with comments (incl. removed), reports and timeline" })
  post(@Param("id", ParseObjectIdPipe) id: string) {
    return this.read.postDetail(id);
  }

  @Post("posts/:id/actions")
  @ApiOperation({ summary: "Remove or restore a post" })
  @Can("moderation.act")
  postAction(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ContentActionDto) {
    return this.contentActions.act(v, "post", id, body);
  }

  @Post("comments/:id/actions")
  @ApiOperation({ summary: "Remove or restore a comment" })
  @Can("moderation.act")
  commentAction(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ContentActionDto) {
    return this.contentActions.act(v, "comment", id, body);
  }

  @Get("alerts")
  @ApiOperation({ summary: "Safety alerts by level (live, urgent, active, resolved, ended)" })
  alerts(@Query() q: AlertQueryDto) {
    return this.read.listAlerts(q);
  }

  @Post("alerts/:id/actions")
  @ApiOperation({ summary: "End, downgrade or remove an alert" })
  @Can("moderation.act")
  async alertAction(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: AlertActionDto) {
    const snap = await this.registry.get("post")!.load(id);
    if (!snap) throw new NotFoundException("Alert not found.");
    if (body.action === "remove") {
      await this.registry.get("post")!.setRemoved(id, true, v.uid);
      await this.registry.announce("post", id);
    }
    else await this.posts.staffAlertAction(id, body.action, v.uid);
    const action = body.action === "end" ? "alert_end" : body.action === "downgrade" ? "alert_downgrade" : "remove_content";
    await this.audit.record(v, action, { type: "post", id, label: `“${snap.preview.slice(0, 60)}”` }, { reason: body.reason });
    return { ok: true };
  }

  // ── 13.8 Broadcasts ────────────────────────────────────────────────────────

  @Get("broadcasts")
  @ApiOperation({ summary: "Sent broadcasts" })
  @Can("broadcasts.send")
  broadcastList() {
    return this.broadcasts.list();
  }

  @Post("broadcasts/estimate")
  @ApiOperation({ summary: "Estimated reach for an audience" })
  @Can("broadcasts.send")
  async estimate(@Body() body: EstimateDto) {
    return { estimatedReach: await this.broadcasts.estimate(toAudience(body.audience)) };
  }

  @Post("broadcasts")
  @ApiOperation({ summary: "Send a broadcast (in-app notification). 'Everyone' is admin only" })
  @Can("broadcasts.send")
  send(@CurrentViewer() v: Viewer, @Body() body: BroadcastDto) {
    return this.broadcasts.send(v, { title: body.title, body: body.body, audience: toAudience(body.audience) });
  }

  // ── 13.9 Insights, team, settings ──────────────────────────────────────────

  @Get("insights")
  @ApiOperation({ summary: "30-day insights: sign-ups, verification funnel, activity, reports, kindness reminders" })
  insights() {
    return this.read.insights();
  }

  @Get("team")
  @ApiOperation({ summary: "Staff list" })
  @Can("team.manage")
  async team() {
    return this.staffUsers.team();
  }

  @Patch("team/:uid")
  @ApiOperation({ summary: "Change a staff role (admin/owner changes need an owner)" })
  @Can("team.manage")
  async setRole(@CurrentViewer() v: Viewer, @Param("uid") uid: string, @Body() body: TeamRoleDto) {
    if (uid === v.uid) throw new BadRequestException("You can't change your own role.");
    await this.staffUsers.setRole(v, uid, body.role);
    return this.staffUsers.team();
  }

  @Get("settings")
  @ApiOperation({ summary: "Platform settings: report reasons, alert windows, coverage" })
  @Can("settings.manage")
  async getSettings() {
    const [settings, coverageCities] = await Promise.all([this.settings.get(), this.hoods.coverageCities()]);
    return { ...settings, coverageCities };
  }

  @Patch("settings")
  @ApiOperation({ summary: "Update report reasons and alert windows" })
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
