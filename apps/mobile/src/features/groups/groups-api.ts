import type { User } from "@firebase/auth";
import type { CreateGroupInput, Group, GroupBoundary, GroupCategory, GroupJoinRequest, GroupMember, GroupPost, GroupPrivacy, UpdateGroupInput } from "@myhoodora/api-contract/types";
import type { LucideIcon } from "lucide-react-native";
import { Briefcase, Building2, Globe, Heart, Home, Lock, MapPinned, Shield, Sparkles, Users } from "lucide-react-native";
import { apiFetch } from "@/core/api/client";
import type { AccentName } from "@/shared/theme/accents";

/** The web's labels and icons (apps/web/src/features/groups/constants.ts), with the app's accent colours. */
export const GROUP_CATEGORY: Record<GroupCategory, { label: string; Icon: LucideIcon; tone: AccentName }> = {
  safety: { label: "Safety", Icon: Shield, tone: "rose" },
  estate: { label: "Estate & street", Icon: Building2, tone: "green" },
  parents: { label: "Parents", Icon: Heart, tone: "amber" },
  hobbies: { label: "Hobbies", Icon: Sparkles, tone: "blue" },
  business: { label: "Local business", Icon: Briefcase, tone: "slate" },
  other: { label: "Community", Icon: Users, tone: "slate" },
};
export const CATEGORY_OPTIONS = (Object.keys(GROUP_CATEGORY) as GroupCategory[]).map((id) => ({ id, label: GROUP_CATEGORY[id].label }));

export const PRIVACY_OPTIONS: { id: GroupPrivacy; label: string; Icon: LucideIcon; description: string }[] = [
  { id: "open", label: "Open", Icon: Globe, description: "Anyone who can find it joins at once, and can see posts and members." },
  { id: "private", label: "Private", Icon: Lock, description: "Neighbours ask to join and an admin approves. Only members see posts." },
];

export const BOUNDARY_OPTIONS: { id: GroupBoundary; label: string; description: string; Icon: LucideIcon }[] = [
  { id: "neighbourhood", label: "My neighbourhood", description: "Only neighbours in your neighbourhood can find it", Icon: Home },
  { id: "nearby", label: "Nearby neighbourhoods", description: "Also the neighbourhoods around yours", Icon: MapPinned },
  { id: "city", label: "Whole city", description: "Anyone on myHoodora in your city", Icon: Building2 },
];

export const groupKeys = {
  all: ["groups"] as const,
  list: (hoodId: string) => ["groups", "list", hoodId] as const,
  one: (id: string) => ["groups", "one", id] as const,
  posts: (id: string) => ["groups", "posts", id] as const,
  members: (id: string) => ["groups", "members", id] as const,
  requests: (id: string) => ["groups", "requests", id] as const,
};

/** Contract §8: groups whose boundary includes you; official ones first, then the biggest. */
export function listGroups(user: User, hoodId: string): Promise<Group[]> {
  return apiFetch<Group[]>(user, `/groups?neighborhoodId=${encodeURIComponent(hoodId)}`);
}

/** An invite token (from a shared link) lets you see a group outside your area. */
export function getGroup(user: User, id: string, invite?: string): Promise<Group> {
  return apiFetch<Group>(user, `/groups/${id}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`);
}

export function createGroup(user: User, hoodId: string, input: CreateGroupInput): Promise<Group> {
  return apiFetch<Group>(user, "/groups", { method: "POST", json: { ...input, neighborhoodId: hoodId } });
}

export function updateGroup(user: User, id: string, input: UpdateGroupInput): Promise<Group> {
  return apiFetch<Group>(user, `/groups/${id}`, { method: "PATCH", json: input });
}

/** Admins; refused (409) once anyone else has posted, as on Nextdoor. */
export function deleteGroup(user: User, id: string): Promise<void> {
  return apiFetch<void>(user, `/groups/${id}`, { method: "DELETE" });
}

/** Open groups (or a valid invite) join at once; private ones become a request. */
export function joinGroup(user: User, id: string, inviteToken?: string): Promise<{ membership: Group["membership"] }> {
  return apiFetch(user, `/groups/${id}/join`, { method: "POST", json: inviteToken ? { inviteToken } : {} });
}

/** Leave, or cancel a request. The last admin must hand over first (409). */
export function leaveGroup(user: User, id: string): Promise<void> {
  return apiFetch<void>(user, `/groups/${id}/membership`, { method: "DELETE" });
}

export function getInviteLink(user: User, id: string): Promise<{ url: string }> {
  return apiFetch(user, `/groups/${id}/invite-link`, { method: "POST", json: {} });
}

export function inviteNeighbours(user: User, id: string, uids: string[]): Promise<void> {
  return apiFetch<void>(user, `/groups/${id}/invites`, { method: "POST", json: { uids } });
}

export function listMembers(user: User, id: string): Promise<GroupMember[]> {
  return apiFetch<GroupMember[]>(user, `/groups/${id}/members`);
}

export function listRequests(user: User, id: string): Promise<GroupJoinRequest[]> {
  return apiFetch<GroupJoinRequest[]>(user, `/groups/${id}/requests`);
}

export function answerRequest(user: User, id: string, uid: string, approve: boolean): Promise<void> {
  return apiFetch<void>(user, `/groups/${id}/requests/${encodeURIComponent(uid)}/${approve ? "approve" : "decline"}`, { method: "POST" });
}

/** The neighbour is told, with the reason if one is given. */
export function removeMember(user: User, id: string, uid: string, reason?: string): Promise<void> {
  return apiFetch<void>(user, `/groups/${id}/members/${encodeURIComponent(uid)}`, { method: "DELETE", json: reason ? { reason } : {} });
}

export function setMemberRole(user: User, id: string, uid: string, role: GroupMember["role"]): Promise<void> {
  return apiFetch<void>(user, `/groups/${id}/members/${encodeURIComponent(uid)}`, { method: "PATCH", json: { role } });
}

export function listGroupPosts(user: User, id: string): Promise<GroupPost[]> {
  return apiFetch<GroupPost[]>(user, `/groups/${id}/posts`);
}

export function createGroupPost(user: User, id: string, content: string): Promise<GroupPost> {
  return apiFetch<GroupPost>(user, `/groups/${id}/posts`, { method: "POST", json: { content } });
}

/** The author, or any group admin. */
export function deleteGroupPost(user: User, id: string, postId: string): Promise<void> {
  return apiFetch<void>(user, `/groups/${id}/posts/${postId}`, { method: "DELETE" });
}

export type GroupFormErrors = Partial<Record<"name" | "description", string>>;

/** The API's rules (CreateGroupDto), checked before sending. */
export function groupErrors(f: Pick<CreateGroupInput, "name" | "description">): GroupFormErrors | null {
  const e: GroupFormErrors = {};
  const name = f.name.trim();
  const description = f.description.trim();
  if (name.length < 3) e.name = "Give the group a name of at least 3 characters.";
  else if (name.length > 60) e.name = "Keep the name to 60 characters.";
  if (description.length < 10) e.description = "Say in a sentence what the group is for (at least 10 characters).";
  else if (description.length > 500) e.description = "Keep the description to 500 characters.";
  return Object.keys(e).length ? e : null;
}

/** "Open · 24 members", "Private · 1 member". */
export function groupMeta(g: Pick<Group, "privacy" | "memberCount">): string {
  return `${g.privacy === "private" ? "Private" : "Open"} · ${g.memberCount.toLocaleString()} member${g.memberCount === 1 ? "" : "s"}`;
}
