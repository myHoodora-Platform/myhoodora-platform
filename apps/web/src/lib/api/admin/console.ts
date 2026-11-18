import type { User } from "firebase/auth";
import { ApiError, apiFetch } from "../client";
import { isLive } from "../config";
import { adminGet, adminSend } from "./http";

/** GET /admin/console/needs-reply (contract §45). */
export interface NeedsReplyItem {
  postId: string;
  hood: { id: string; name: string };
  author: { uid: string; displayName: string; newcomer: boolean };
  firstPost: boolean;
  category: string;
  excerpt: string;
  createdAt: string;
  waitingMinutes: number;
  overdue: boolean;
}
export interface NeedsReply {
  items: NeedsReplyItem[];
  waiting: number;
  overdue: number;
  myHoods: number;
}
export interface ConsoleStats {
  posts: number;
  replied: number;
  medianMinutesToFirstReply: number | null;
  firstRepliesByStaff: { uid: string; displayName: string; count: number }[];
}
export interface Assignments {
  staff: { uid: string; displayName: string; role: string; hoods: { id: string; name: string }[] }[];
}

function requireLive(): void {
  if (!isLive("invites")) throw new ApiError("The console needs the live API. Turn off preview mode to use it.", 503, "server");
}

export async function getNeedsReply(user: User, mine: boolean): Promise<NeedsReply> {
  requireLive();
  return adminGet<NeedsReply>(user, "/console/needs-reply", mine ? { mine: "true" } : {});
}

export async function consoleReply(user: User, postId: string, content: string, as: "self" | "team"): Promise<unknown> {
  requireLive();
  return adminSend(user, "/console/reply", { postId, content, as });
}

export async function getConsoleStats(user: User): Promise<ConsoleStats> {
  requireLive();
  return adminGet<ConsoleStats>(user, "/console/stats");
}

export async function getAssignments(user: User): Promise<Assignments> {
  requireLive();
  return adminGet<Assignments>(user, "/console/assignments");
}

export async function setAssignment(user: User, uid: string, hoodIds: string[]): Promise<Assignments> {
  requireLive();
  return apiFetch<Assignments>(user, `/admin/console/assignments/${encodeURIComponent(uid)}`, { method: "PUT", json: { hoodIds } });
}
