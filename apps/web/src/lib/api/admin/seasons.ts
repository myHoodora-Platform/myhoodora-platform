import type { User } from "firebase/auth";
import type { AdminSeason, AdminSeasonInput } from "@myhoodora/api-contract/seasons";
import { ApiError, apiFetch } from "../client";
import { isLive } from "../config";
import { adminGet, adminSend } from "./http";

function requireLive(): void {
  if (!isLive("admin.settings")) throw new ApiError("Seasons need the live API. Turn off preview mode to manage them.", 503, "server");
}

/** live: GET /admin/seasons */
export async function listSeasons(user: User): Promise<AdminSeason[]> {
  requireLive();
  return adminGet<AdminSeason[]>(user, "/seasons");
}

/** live: POST /admin/seasons */
export async function createSeason(user: User, input: AdminSeasonInput): Promise<AdminSeason> {
  requireLive();
  return adminSend<AdminSeason>(user, "/seasons", input);
}

/** live: PATCH /admin/seasons/:id */
export async function updateSeason(user: User, id: string, input: AdminSeasonInput): Promise<AdminSeason> {
  requireLive();
  return adminSend<AdminSeason>(user, `/seasons/${id}`, input, "PATCH");
}

/** live: DELETE /admin/seasons/:id */
export async function deleteSeason(user: User, id: string): Promise<void> {
  requireLive();
  await apiFetch<void>(user, `/admin/seasons/${id}`, { method: "DELETE" });
}
