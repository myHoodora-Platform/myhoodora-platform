import type { User } from "firebase/auth";
import { ApiError } from "../client";
import { isLive } from "../config";
import { adminGet } from "./http";

export type Light = "green" | "amber" | "red";
export interface ActivationRow {
  hood: { id: string; name: string; city?: string };
  light: Light;
  missing: string[];
  neighbours: number;
  items: number;
  teamItems: number;
  leads: number;
  welcome: boolean;
  moderator: boolean;
}
export interface Activation {
  rows: ActivationRow[];
  counts: Record<Light, number>;
}
export interface ChallengeDashboard {
  startedAt: string;
  weekly: { week: string; signups: number; invited: number; invitedVerified: number }[];
  funnel: Record<string, number>;
  builders: number;
  hoods: Record<Light, number>;
  advice: "keep_going" | "push_harder" | "consider_ending";
  why: string;
}

function requireLive(): void {
  if (!isLive("invites")) throw new ApiError("Dashboards need the live API.", 503, "server");
}

/** live: GET /admin/dashboards/activation (contract §46). */
export async function getActivation(user: User): Promise<Activation> {
  requireLive();
  return adminGet<Activation>(user, "/dashboards/activation");
}

/** live: GET /admin/dashboards/challenge (contract §46). */
export async function getChallengeDashboard(user: User): Promise<ChallengeDashboard> {
  requireLive();
  return adminGet<ChallengeDashboard>(user, "/dashboards/challenge");
}
