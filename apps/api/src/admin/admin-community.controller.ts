import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminBusinessQuery, BusinessActionDto } from "../businesses/businesses.dto";
import { BusinessesService } from "../businesses/businesses.service";
import { AdminGroupActionDto } from "../groups/groups.dto";
import { GroupsService } from "../groups/groups.service";
import { InboxQuery, InboxReplyDto, InboxUpdateDto, SignupQuery } from "../inbound/inbound.dto";
import { InboundService } from "../inbound/inbound.service";
import { ListingsService } from "../listings/listings.service";
import { AppealsService } from "../moderation/appeals.service";
import { LeadsRosterService } from "../moderation/leads-roster.service";
import { ModerationService } from "../moderation/moderation.service";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { AdminGroupQuery, AdminListingQuery, AppealDecisionDto, AppealQuery, ContentActionDto, HoodLeadsDto } from "./admin.dto";
import { ContentActionsService } from "./content-actions.service";
import { ApiStandardErrors } from "../shared/http/api-docs";

/**
 * §13.6–13.9 (pass 2): marketplace, groups, businesses, inbox, sign-ups,
 * Hood Leads and appeals. Same rules as AdminController: admin.access on
 * every route, finer capabilities per route, business logic in the domains.
 */
@ApiTags("admin")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Can("admin.access")
@Controller("admin")
export class AdminCommunityController {
  constructor(
    private readonly listings: ListingsService,
    private readonly groups: GroupsService,
    private readonly businesses: BusinessesService,
    private readonly inbound: InboundService,
    private readonly moderation: ModerationService,
    private readonly roster: LeadsRosterService,
    private readonly appeals: AppealsService,
    private readonly contentActions: ContentActionsService,
  ) {}

  // ── 13.6 Marketplace & groups ──────────────────────────────────────────────

  @Get("listings")
  @ApiOperation({ summary: "For Sale & Free listings (most reported first when filtered)" })
  listingsList(@Query() q: AdminListingQuery) {
    return this.listings.adminList({ ...q, reported: q.reported === "true" }, (ids) => this.moderation.openCountsByTarget("listing", ids));
  }

  @Post("listings/:id/actions")
  @Can("moderation.act")
  @ApiOperation({ summary: "Remove or restore a listing" })
  listingAction(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: ContentActionDto) {
    return this.contentActions.act(v, "listing", id, body);
  }

  @Get("groups")
  @ApiOperation({ summary: "Groups across Hoods" })
  groupsList(@Query() q: AdminGroupQuery) {
    return this.groups.adminList({ ...q, reported: q.reported === "true" }, (ids) => this.moderation.openCountsByTarget("group", ids));
  }

  @Post("groups/:id/actions")
  @Can("moderation.act")
  @ApiOperation({ summary: "Archive (or remove) / restore a group" })
  groupAction(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: AdminGroupActionDto) {
    return this.contentActions.act(v, "group", id, { ...body, action: body.action === "restore" ? "restore" : "remove" });
  }

  // ── 13.7 Businesses ────────────────────────────────────────────────────────

  @Get("businesses")
  @ApiOperation({ summary: "Business applications and pages by tab" })
  businessesList(@Query() q: AdminBusinessQuery) {
    return this.businesses.adminList(q, (ids) => this.moderation.openCountsByTarget("business", ids));
  }

  @Get("businesses/:id")
  @ApiOperation({ summary: "Business detail with checks and timeline" })
  business(@Param("id", ParseObjectIdPipe) id: string) {
    return this.businesses.adminDetail(id, (ids) => this.moderation.openCountsByTarget("business", ids));
  }

  @Post("businesses/:id/actions")
  @Can("businesses.review")
  @ApiOperation({ summary: "approve (emails a claim link) · request_info · reject · suspend · reinstate" })
  async businessAction(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: BusinessActionDto) {
    await this.businesses.act(v, id, body);
    return this.businesses.adminDetail(id, (ids) => this.moderation.openCountsByTarget("business", ids));
  }

  // ── 13.8 Support inbox ─────────────────────────────────────────────────────

  @Get("inbox")
  @ApiOperation({ summary: "Support inbox: in-app help, contact form and feedback" })
  inbox(@Query() q: InboxQuery) {
    return this.inbound.list(q);
  }

  @Get("inbox/:id")
  @ApiOperation({ summary: "One thread" })
  thread(@Param("id", ParseObjectIdPipe) id: string) {
    return this.inbound.get(id);
  }

  @Post("inbox/:id/reply")
  @HttpCode(200)
  @ApiOperation({ summary: "Reply (emailed, and notified in-app if they have an account)" })
  reply(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: InboxReplyDto) {
    return this.inbound.reply(v, id, body.body, body.resolve);
  }

  @Patch("inbox/:id")
  @ApiOperation({ summary: "Status, priority or assignee" })
  updateThread(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: InboxUpdateDto) {
    return this.inbound.update(v, id, body);
  }

  // ── 13.9 Sign-ups ──────────────────────────────────────────────────────────

  @Get("signups")
  @Can("settings.manage")
  @ApiOperation({ summary: "Read-only waitlists: AI pilot, talent network, Local Ads" })
  signups(@Query() q: SignupQuery) {
    return q.type === "business_ads" ? this.businesses.adsWaitlist() : this.inbound.signups(q.type);
  }

  // ── Hood Leads ─────────────────────────────────────────────────────────────

  @Get("hoods/:id/leads")
  @ApiOperation({ summary: "A Hood's volunteer Leads" })
  leads(@Param("id", ParseObjectIdPipe) id: string) {
    return this.roster.leadsOf(id);
  }

  @Put("hoods/:id/leads")
  @Can("hoods.manage")
  @ApiOperation({ summary: "Replace a Hood's Leads (verified, active neighbours of that Hood; max 15). Voting starts at 3" })
  setLeads(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: HoodLeadsDto) {
    return this.roster.setLeads(v, id, body.uids);
  }

  // ── Appeals ────────────────────────────────────────────────────────────────

  @Get("appeals")
  @Can("moderation.act")
  @ApiOperation({ summary: "Appeals on moderation decisions" })
  appealsList(@Query() q: AppealQuery) {
    return this.appeals.list(q);
  }

  @Post("appeals/:id/decide")
  @Can("moderation.act")
  @HttpCode(200)
  @ApiOperation({ summary: "Uphold or overturn (not by the original decider). Overturn reverses the enforcement" })
  decideAppeal(@CurrentViewer() v: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: AppealDecisionDto) {
    return this.appeals.decide(v, id, body.outcome, body.reason);
  }
}
