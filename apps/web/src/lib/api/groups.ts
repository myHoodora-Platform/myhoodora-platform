import type { User } from "firebase/auth";
import { ApiError, apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, mockId, save } from "./mock/store";
import {
  seedGroupMembers,
  seedGroupPosts,
  seedGroupRequests,
  seedGroups,
  MOCK_NEIGHBOURS,
  type StoredGroup,
} from "./mock/seed";
import type {
  CreateGroupInput,
  Group,
  GroupJoinRequest,
  GroupMember,
  GroupPost,
  UpdateGroupInput,
} from "./types";

/** Anti-spam: how many groups one neighbour may create per rolling 24h. */
export const MAX_GROUPS_PER_DAY = 3;

// ── Mock store ──────────────────────────────────────────────────────────────

type Members = Record<string, GroupMember[]>;
type Requests = Record<string, GroupJoinRequest[]>;

const groupsStore = () => load<StoredGroup[]>("groups", seedGroups);
const membersStore = (viewerUid: string) => load<Members>("group-members", () => seedGroupMembers(viewerUid));
const requestsStore = () => load<Requests>("group-requests", seedGroupRequests);
const postsStore = () => load<GroupPost[]>("group-posts", seedGroupPosts);
const invitesStore = () => load<Record<string, string[]>>("group-invites", () => ({}));

function viewerRelative(g: StoredGroup, uid: string): Group {
  const me = (membersStore(uid)[g._id] ?? []).find((m) => m.uid === uid);
  const requested = (requestsStore()[g._id] ?? []).some((r) => r.uid === uid);
  return {
    ...g,
    membership: me ? "member" : requested ? "requested" : "none",
    isAdmin: me?.role === "admin",
  };
}

function findStored(id: string): StoredGroup {
  const g = groupsStore().find((x) => x._id === id);
  if (!g) throw new ApiError("This group doesn't exist any more.", 404, "not_found");
  return g;
}

function saveGroup(next: StoredGroup) {
  save("groups", groupsStore().map((g) => (g._id === next._id ? next : g)));
}

function assertAdmin(user: User, groupId: string) {
  const me = (membersStore(user.uid)[groupId] ?? []).find((m) => m.uid === user.uid);
  if (me?.role !== "admin") throw new ApiError("Only group admins can do that.", 403, "forbidden");
}

function setMembers(uid: string, groupId: string, list: GroupMember[]) {
  save("group-members", { ...membersStore(uid), [groupId]: list });
}

function setRequests(groupId: string, list: GroupJoinRequest[]) {
  save("group-requests", { ...requestsStore(), [groupId]: list });
}

function adjustCount(groupId: string, delta: number) {
  const g = findStored(groupId);
  saveGroup({ ...g, memberCount: Math.max(0, g.memberCount + delta) });
}

// ── Browse ──────────────────────────────────────────────────────────────────

/** planned: GET /groups?neighborhoodId — viewer-relative membership/isAdmin. */
export async function listGroups(user: User, neighborhoodId: string): Promise<Group[]> {
  if (isLive("groups")) return apiFetch<Group[]>(user, `/groups?neighborhoodId=${neighborhoodId}`);
  await latency();
  return groupsStore()
    .map((g) => viewerRelative(g, user.uid))
    .sort((a, b) => Number(b.official) - Number(a.official) || b.memberCount - a.memberCount);
}

/** planned: GET /groups/:id */
export async function getGroup(user: User, id: string): Promise<Group | null> {
  if (isLive("groups")) return apiFetch<Group>(user, `/groups/${id}`);
  await latency();
  const g = groupsStore().find((x) => x._id === id);
  return g ? viewerRelative(g, user.uid) : null;
}

// ── Create / edit / delete ──────────────────────────────────────────────────

/**
 * planned: POST /groups → Group. Verified neighbours only; the creator
 * becomes the first admin. 409 on a duplicate name in the neighbourhood,
 * 429 past MAX_GROUPS_PER_DAY.
 */
export async function createGroup(user: User, neighborhoodId: string, input: CreateGroupInput): Promise<Group> {
  if (isLive("groups")) return apiFetch<Group>(user, "/groups", { method: "POST", json: { ...input, neighborhoodId } });
  await latency(400);
  const all = groupsStore();
  const dayAgo = Date.now() - 86_400_000;
  if (all.filter((g) => g.createdBy === user.uid && new Date(g.createdAt).getTime() > dayAgo).length >= MAX_GROUPS_PER_DAY) {
    throw new ApiError(`You can create up to ${MAX_GROUPS_PER_DAY} groups a day. Try again tomorrow.`, 429, "client");
  }
  const clash = all.some(
    (g) => g.neighborhoodId === neighborhoodId && g.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (clash) throw new ApiError("A group with this name already exists in your neighbourhood.", 409, "client");

  const now = new Date().toISOString();
  const group: StoredGroup = {
    ...input,
    _id: mockId("mg"),
    neighborhoodId,
    createdBy: user.uid,
    official: false,
    memberCount: 1,
    createdAt: now,
  };
  save("groups", [group, ...all]);
  setMembers(user.uid, group._id, [{ uid: user.uid, role: "admin", joinedAt: now }]);
  return viewerRelative(group, user.uid);
}

/** planned: PATCH /groups/:id (admins) → Group */
export async function updateGroup(user: User, id: string, input: UpdateGroupInput): Promise<Group> {
  if (isLive("groups")) return apiFetch<Group>(user, `/groups/${id}`, { method: "PATCH", json: input });
  await latency();
  assertAdmin(user, id);
  const next = { ...findStored(id), ...input };
  saveGroup(next);
  // Opening a private group lets everyone who asked straight in.
  if (input.privacy === "open") {
    const waiting = requestsStore()[id] ?? [];
    for (const r of waiting) await approveRequest(user, id, r.uid);
  }
  return viewerRelative(findStored(id), user.uid);
}

/** Nextdoor rule: a group can only be deleted while nobody else has posted in it. */
export function canDeleteGroup(groupId: string, adminUid: string): boolean {
  return !postsStore().some((p) => p.groupId === groupId && p.authorUid !== adminUid);
}

/** planned: DELETE /groups/:id (admins) — 409 if other members have posted. */
export async function deleteGroup(user: User, id: string): Promise<void> {
  if (isLive("groups")) {
    await apiFetch<void>(user, `/groups/${id}`, { method: "DELETE" });
    return;
  }
  await latency();
  assertAdmin(user, id);
  if (!canDeleteGroup(id, user.uid)) {
    throw new ApiError("Other neighbours have posted here, so the group can't be deleted. You can leave it or hand it to another admin.", 409, "client");
  }
  save("groups", groupsStore().filter((g) => g._id !== id));
  save("group-posts", postsStore().filter((p) => p.groupId !== id));
}

// ── Joining ─────────────────────────────────────────────────────────────────

/**
 * planned: POST /groups/:id/join { inviteToken? } → { membership }.
 * Open groups (or a valid invite) join instantly; private groups create a
 * request for the admins.
 */
export async function joinGroup(user: User, group: Group, inviteToken?: string): Promise<Group["membership"]> {
  if (isLive("groups")) {
    const res = await apiFetch<{ membership: Group["membership"] }>(user, `/groups/${group._id}/join`, {
      method: "POST",
      json: { inviteToken },
    });
    return res.membership;
  }
  await latency();
  const invited = !!inviteToken && inviteToken === inviteTokenFor(group._id);
  if (group.privacy === "open" || invited) {
    const members = membersStore(user.uid)[group._id] ?? [];
    if (!members.some((m) => m.uid === user.uid)) {
      setMembers(user.uid, group._id, [...members, { uid: user.uid, role: "member", joinedAt: new Date().toISOString() }]);
      adjustCount(group._id, 1);
    }
    setRequests(group._id, (requestsStore()[group._id] ?? []).filter((r) => r.uid !== user.uid));
    return "member";
  }
  const requests = requestsStore()[group._id] ?? [];
  if (!requests.some((r) => r.uid === user.uid)) {
    setRequests(group._id, [...requests, { uid: user.uid, requestedAt: new Date().toISOString() }]);
  }
  return "requested";
}

/**
 * planned: DELETE /groups/:id/membership — leave, or cancel a request.
 * 409 for the last admin while other members remain (hand over first).
 */
export async function leaveGroup(user: User, groupId: string): Promise<void> {
  if (isLive("groups")) {
    await apiFetch<void>(user, `/groups/${groupId}/membership`, { method: "DELETE" });
    return;
  }
  await latency();
  const members = membersStore(user.uid)[groupId] ?? [];
  const me = members.find((m) => m.uid === user.uid);
  if (me) {
    const otherAdmins = members.filter((m) => m.role === "admin" && m.uid !== user.uid);
    if (me.role === "admin" && otherAdmins.length === 0 && members.length > 1) {
      throw new ApiError("You're the only admin. Make another member an admin before you leave.", 409, "client");
    }
    setMembers(user.uid, groupId, members.filter((m) => m.uid !== user.uid));
    adjustCount(groupId, -1);
  }
  setRequests(groupId, (requestsStore()[groupId] ?? []).filter((r) => r.uid !== user.uid));
}

// ── Invites ─────────────────────────────────────────────────────────────────

function inviteTokenFor(groupId: string): string {
  return `inv_${groupId}`;
}

/**
 * planned: POST /groups/:id/invite-link → { url } (members; admins only for
 * private groups). The token lets a private group be joined without a request.
 */
export async function getInviteLink(user: User, groupId: string): Promise<string> {
  if (isLive("groups")) {
    const res = await apiFetch<{ url: string }>(user, `/groups/${groupId}/invite-link`, { method: "POST" });
    return res.url;
  }
  await latency(120);
  return `${window.location.origin}/g/${groupId}?invite=${inviteTokenFor(groupId)}`;
}

/** planned: POST /groups/:id/invites { uids } — notifies each invited neighbour. */
export async function inviteNeighbours(user: User, groupId: string, uids: string[]): Promise<void> {
  if (isLive("groups")) {
    await apiFetch<void>(user, `/groups/${groupId}/invites`, { method: "POST", json: { uids } });
    return;
  }
  await latency(250);
  const all = invitesStore();
  save("group-invites", { ...all, [groupId]: Array.from(new Set([...(all[groupId] ?? []), ...uids])) });
}

/** Neighbours already invited (preview). planned: part of GET /groups/:id/members?include=invited */
export function invitedUids(groupId: string): string[] {
  if (typeof window === "undefined") return [];
  return invitesStore()[groupId] ?? [];
}

/** planned: GET /users/search?q&neighborhoodId (people you can invite). */
export async function searchNeighbours(user: User, query: string) {
  if (isLive("users.publicProfile")) {
    return apiFetch<typeof MOCK_NEIGHBOURS>(user, `/users/search?q=${encodeURIComponent(query)}`);
  }
  await latency(120);
  const q = query.trim().toLowerCase();
  return MOCK_NEIGHBOURS.filter((n) => n.kind !== "organisation" && (!q || n.displayName.toLowerCase().includes(q)));
}

// ── Admin: members & requests ───────────────────────────────────────────────

/** planned: GET /groups/:id/members (members of private groups; anyone for open). */
export async function listMembers(user: User, groupId: string): Promise<GroupMember[]> {
  if (isLive("groups")) return apiFetch<GroupMember[]>(user, `/groups/${groupId}/members`);
  await latency();
  return [...(membersStore(user.uid)[groupId] ?? [])].sort(
    (a, b) => Number(b.role === "admin") - Number(a.role === "admin") || a.joinedAt.localeCompare(b.joinedAt),
  );
}

/** planned: GET /groups/:id/requests (admins) */
export async function listRequests(user: User, groupId: string): Promise<GroupJoinRequest[]> {
  if (isLive("groups")) return apiFetch<GroupJoinRequest[]>(user, `/groups/${groupId}/requests`);
  await latency();
  assertAdmin(user, groupId);
  return requestsStore()[groupId] ?? [];
}

/** planned: POST /groups/:id/requests/:uid/approve (admins) */
export async function approveRequest(user: User, groupId: string, uid: string): Promise<void> {
  if (isLive("groups")) {
    await apiFetch<void>(user, `/groups/${groupId}/requests/${uid}/approve`, { method: "POST" });
    return;
  }
  assertAdmin(user, groupId);
  setRequests(groupId, (requestsStore()[groupId] ?? []).filter((r) => r.uid !== uid));
  const members = membersStore(user.uid)[groupId] ?? [];
  if (!members.some((m) => m.uid === uid)) {
    setMembers(user.uid, groupId, [...members, { uid, role: "member", joinedAt: new Date().toISOString() }]);
    adjustCount(groupId, 1);
  }
}

/** planned: POST /groups/:id/requests/:uid/decline (admins) — the neighbour isn't told why. */
export async function declineRequest(user: User, groupId: string, uid: string): Promise<void> {
  if (isLive("groups")) {
    await apiFetch<void>(user, `/groups/${groupId}/requests/${uid}/decline`, { method: "POST" });
    return;
  }
  await latency();
  assertAdmin(user, groupId);
  setRequests(groupId, (requestsStore()[groupId] ?? []).filter((r) => r.uid !== uid));
}

/** planned: DELETE /groups/:id/members/:uid { reason? } (admins) — the member is notified, with the reason. */
export async function removeMember(user: User, groupId: string, uid: string, reason?: string): Promise<void> {
  if (isLive("groups")) {
    await apiFetch<void>(user, `/groups/${groupId}/members/${uid}`, { method: "DELETE", json: { reason } });
    return;
  }
  await latency();
  assertAdmin(user, groupId);
  if (uid === user.uid) throw new ApiError("Use “Leave group” to remove yourself.", 400, "client");
  setMembers(user.uid, groupId, (membersStore(user.uid)[groupId] ?? []).filter((m) => m.uid !== uid));
  adjustCount(groupId, -1);
}

/** planned: PATCH /groups/:id/members/:uid { role } (admins) */
export async function setMemberRole(user: User, groupId: string, uid: string, role: GroupMember["role"]): Promise<void> {
  if (isLive("groups")) {
    await apiFetch<void>(user, `/groups/${groupId}/members/${uid}`, { method: "PATCH", json: { role } });
    return;
  }
  await latency();
  assertAdmin(user, groupId);
  const members = membersStore(user.uid)[groupId] ?? [];
  if (role === "member" && members.filter((m) => m.role === "admin").length <= 1) {
    throw new ApiError("A group needs at least one admin.", 409, "client");
  }
  setMembers(user.uid, groupId, members.map((m) => (m.uid === uid ? { ...m, role } : m)));
}

// ── Group posts ─────────────────────────────────────────────────────────────

/** planned: GET /groups/:id/posts (members only for private groups). */
export async function listGroupPosts(user: User, groupId: string): Promise<GroupPost[]> {
  if (isLive("groups")) return apiFetch<GroupPost[]>(user, `/groups/${groupId}/posts`);
  await latency();
  return postsStore()
    .filter((p) => p.groupId === groupId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** planned: POST /groups/:id/posts { content } (members only). */
export async function createGroupPost(user: User, groupId: string, content: string): Promise<GroupPost> {
  if (isLive("groups")) {
    return apiFetch<GroupPost>(user, `/groups/${groupId}/posts`, { method: "POST", json: { content } });
  }
  await latency();
  const post: GroupPost = { _id: mockId("mgp"), groupId, authorUid: user.uid, content, createdAt: new Date().toISOString() };
  save("group-posts", [post, ...postsStore()]);
  return post;
}

/** planned: DELETE /groups/:id/posts/:postId (author or group admin). */
export async function deleteGroupPost(user: User, groupId: string, postId: string): Promise<void> {
  if (isLive("groups")) {
    await apiFetch<void>(user, `/groups/${groupId}/posts/${postId}`, { method: "DELETE" });
    return;
  }
  await latency();
  const post = postsStore().find((p) => p._id === postId);
  if (!post) return;
  if (post.authorUid !== user.uid) assertAdmin(user, groupId);
  save("group-posts", postsStore().filter((p) => p._id !== postId));
}
