import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, mockId, save } from "./mock/store";
import { seedGroupPosts, seedGroups } from "./mock/seed";
import type { Group, GroupPost } from "./types";

const GROUPS_KEY = "groups";
const POSTS_KEY = "group-posts";
const membershipKey = (uid: string) => `group-membership:${uid}`;

type MembershipMap = Record<string, Group["membership"]>;

function withMembership(groups: Group[], uid: string): Group[] {
  const map = load<MembershipMap>(membershipKey(uid), () => ({}));
  return groups.map((g) => {
    const membership = map[g._id] ?? "none";
    // The viewer's own join counts toward the member total.
    const memberCount = g.memberCount + (membership === "member" ? 1 : 0);
    return { ...g, membership, memberCount };
  });
}

/** planned: GET /groups?neighborhoodId — includes viewer's `membership`. */
export async function listGroups(user: User, neighborhoodId: string): Promise<Group[]> {
  if (isLive("groups")) return apiFetch<Group[]>(user, `/groups?neighborhoodId=${neighborhoodId}`);
  await latency();
  return withMembership(load(GROUPS_KEY, seedGroups), user.uid);
}

/** planned: GET /groups/:id */
export async function getGroup(user: User, id: string): Promise<Group | null> {
  if (isLive("groups")) return apiFetch<Group>(user, `/groups/${id}`);
  await latency();
  return withMembership(load(GROUPS_KEY, seedGroups), user.uid).find((g) => g._id === id) ?? null;
}

/**
 * planned: POST /groups/:id/join → { membership }.
 * Open groups join instantly; private groups create a request for the lead.
 */
export async function joinGroup(user: User, group: Group): Promise<Group["membership"]> {
  if (isLive("groups")) {
    const res = await apiFetch<{ membership: Group["membership"] }>(user, `/groups/${group._id}/join`, { method: "POST" });
    return res.membership;
  }
  await latency();
  const membership = group.privacy === "open" ? "member" : "requested";
  const map = load<MembershipMap>(membershipKey(user.uid), () => ({}));
  save(membershipKey(user.uid), { ...map, [group._id]: membership });
  return membership;
}

/** planned: DELETE /groups/:id/membership (leave, or cancel a request). */
export async function leaveGroup(user: User, groupId: string): Promise<void> {
  if (isLive("groups")) {
    await apiFetch<void>(user, `/groups/${groupId}/membership`, { method: "DELETE" });
    return;
  }
  await latency();
  const map = load<MembershipMap>(membershipKey(user.uid), () => ({}));
  const next = { ...map };
  delete next[groupId];
  save(membershipKey(user.uid), next);
}

/** planned: GET /groups/:id/posts (members only for private groups). */
export async function listGroupPosts(user: User, groupId: string): Promise<GroupPost[]> {
  if (isLive("groups")) return apiFetch<GroupPost[]>(user, `/groups/${groupId}/posts`);
  await latency();
  return load(POSTS_KEY, seedGroupPosts)
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
  save(POSTS_KEY, [post, ...load(POSTS_KEY, seedGroupPosts)]);
  return post;
}
