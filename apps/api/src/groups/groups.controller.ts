import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { Can } from "../shared/authz/can.decorator";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import {
  CreateGroupDto,
  GroupListQuery,
  GroupPostDto,
  GroupViewQuery,
  InviteLinkDto,
  InviteNeighboursDto,
  JoinGroupDto,
  MemberRoleDto,
  RemoveMemberDto,
  UpdateGroupDto,
} from "./groups.dto";
import { GroupsService } from "./groups.service";
import { ApiNotFound, ApiStandardErrors } from "../shared/http/api-docs";

/** Contract §8 (Nextdoor-style groups). Group admins moderate their own group. */
@ApiTags("groups")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("groups")
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @ApiOperation({ summary: "Groups you can find: your Hood, nearby/city boundaries, and ones you belong to. Official first, then by size" })
  list(@CurrentViewer() viewer: Viewer, @Query() q: GroupListQuery) {
    return this.groups.list(viewer, q.neighborhoodId);
  }

  @Get(":id")
  @ApiOperation({ summary: "One group (viewer-relative membership / isAdmin). `?invite=` lets invitees from elsewhere see it" })
  @ApiOkResponse()
  @ApiNotFound("Group")
  get(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Query() q: GroupViewQuery) {
    return this.groups.get(viewer, id, q.invite);
  }

  @Post()
  @Can("content.create")
  @ApiOperation({ summary: "Create a group; you become its first admin (verified neighbours, 3 a day)" })
  @ApiConflictResponse({ description: "Name already used in your Hood" })
  @ApiTooManyRequestsResponse({ description: "More than 3 groups in 24 h" })
  @ApiCreatedResponse({ description: "The new group, with you as admin" })
  create(@CurrentViewer() viewer: Viewer, @Body() body: CreateGroupDto) {
    return this.groups.create(viewer, body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit (group admins). Private → open approves every pending request" })
  update(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: UpdateGroupDto) {
    return this.groups.update(viewer, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete (group admins) — only while no one else has posted" })
  @ApiConflictResponse({ description: "Other members have posted" })
  @ApiNoContentResponse({ description: "Deleted" })
  async delete(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.groups.delete(viewer, id);
  }

  @Post(":id/join")
  @HttpCode(200)
  @Can("content.react")
  @ApiOperation({ summary: "Join an open group (or with an invite); request to join a private one → { membership }" })
  join(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: JoinGroupDto) {
    return this.groups.join(viewer, id, body.inviteToken);
  }

  @Delete(":id/membership")
  @HttpCode(204)
  @ApiOperation({ summary: "Leave, or cancel your request" })
  @ApiConflictResponse({ description: "You're the last admin while others remain" })
  @ApiNoContentResponse({ description: "Left the group, or request cancelled" })
  async leave(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.groups.leave(viewer, id);
  }

  @Post(":id/invite-link")
  @HttpCode(200)
  @ApiOperation({ summary: "Shareable invite link → { url }. Private groups: admins only. `reset: true` revokes old links" })
  inviteLink(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: InviteLinkDto) {
    return this.groups.inviteLink(viewer, id, body?.reset);
  }

  @Post(":id/invites")
  @HttpCode(204)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Invite neighbours (in-app notification each)" })
  @ApiNoContentResponse()
  async invite(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: InviteNeighboursDto) {
    await this.groups.invite(viewer, id, body.uids);
  }

  @Get(":id/members")
  @ApiOperation({ summary: "Members, admins first (private groups: members only)" })
  @ApiForbiddenResponse({ description: "Private group and you're not a member" })
  @ApiOkResponse({ description: "Members, admins first" })
  members(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.groups.listMembers(viewer, id);
  }

  @Get(":id/requests")
  @ApiOperation({ summary: "Pending join requests (group admins)" })
  requests(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.groups.listRequests(viewer, id);
  }

  @Post(":id/requests/:uid/approve")
  @HttpCode(204)
  @ApiOperation({ summary: "Approve a request (group admins); they're notified" })
  async approve(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("uid") uid: string) {
    await this.groups.approve(viewer, id, uid);
  }

  @Post(":id/requests/:uid/decline")
  @HttpCode(204)
  @ApiOperation({ summary: "Decline a request (group admins); not notified" })
  async decline(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("uid") uid: string) {
    await this.groups.decline(viewer, id, uid);
  }

  @Delete(":id/members/:uid")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove a member (group admins); they're told the reason" })
  async remove(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("uid") uid: string, @Body() body: RemoveMemberDto) {
    await this.groups.removeMember(viewer, id, uid, body?.reason);
  }

  @Patch(":id/members/:uid")
  @HttpCode(204)
  @ApiOperation({ summary: "Make admin / member (group admins)" })
  @ApiConflictResponse({ description: "Would leave the group without an admin" })
  @ApiNoContentResponse({ description: "Role changed" })
  async setRole(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("uid") uid: string, @Body() body: MemberRoleDto) {
    await this.groups.setRole(viewer, id, uid, body.role);
  }

  @Get(":id/posts")
  @ApiOperation({ summary: "Group posts, newest first (private: members only)" })
  posts(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.groups.listPosts(viewer, id);
  }

  @Post(":id/posts")
  @Can("content.create")
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Post in a group (members)" })
  createPost(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Body() body: GroupPostDto) {
    return this.groups.createPost(viewer, id, body.content);
  }

  @Delete(":id/posts/:postId")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a group post (author or a group admin)" })
  async deletePost(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string, @Param("postId", ParseObjectIdPipe) postId: string) {
    await this.groups.deletePost(viewer, id, postId);
  }
}
