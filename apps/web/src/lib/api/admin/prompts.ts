import type { User } from "firebase/auth";
import type { AdminPrompt, AdminPromptInput, PromptResults, PromptSettings, PromptSettingsPatch, PromptStatus } from "@myhoodora/api-contract/prompts";
import { ApiError, apiFetch } from "../client";
import { API_BASE_URL, isLive } from "../config";
import { adminGet, adminSend } from "./http";

function requireLive(): void {
  if (!isLive("admin.prompts")) throw new ApiError("Feedback prompts need the live API. Turn off preview mode to manage them.", 503, "server");
}

/** live: GET /admin/prompts?status&q (contract §33) */
export async function listPrompts(user: User, query: { status?: PromptStatus | "all"; q?: string } = {}): Promise<AdminPrompt[]> {
  requireLive();
  return adminGet(user, "/prompts", query);
}

export async function getPrompt(user: User, id: string): Promise<AdminPrompt> {
  requireLive();
  return adminGet(user, `/prompts/${encodeURIComponent(id)}`);
}

export async function createPrompt(user: User, input: AdminPromptInput): Promise<AdminPrompt> {
  requireLive();
  return adminSend(user, "/prompts", input);
}

export async function updatePrompt(user: User, id: string, input: AdminPromptInput): Promise<AdminPrompt> {
  requireLive();
  return adminSend(user, `/prompts/${encodeURIComponent(id)}`, input, "PATCH");
}

export async function setPromptStatus(user: User, id: string, status: PromptStatus): Promise<AdminPrompt> {
  requireLive();
  return apiFetch(user, `/admin/prompts/${encodeURIComponent(id)}/status`, { method: "PUT", json: { status } });
}

/** Manual prompts: send now (once). */
export async function sendPrompt(user: User, id: string): Promise<AdminPrompt> {
  requireLive();
  return adminSend(user, `/prompts/${encodeURIComponent(id)}/send`, {});
}

export async function deletePrompt(user: User, id: string): Promise<void> {
  requireLive();
  await apiFetch<void>(user, `/admin/prompts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getPromptResults(user: User, id: string): Promise<PromptResults> {
  requireLive();
  return adminGet(user, `/prompts/${encodeURIComponent(id)}/results`);
}

/** The answers as a CSV file the browser downloads (the API's export, with the person's token). */
export async function downloadPromptCsv(user: User, id: string, filename: string): Promise<void> {
  requireLive();
  const res = await fetch(`${API_BASE_URL}/admin/prompts/${encodeURIComponent(id)}/export.csv`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  if (!res.ok) throw new ApiError("Couldn't export the answers. Try again.", res.status, res.status === 403 ? "forbidden" : "server");
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export async function getPromptSettings(user: User): Promise<PromptSettings> {
  requireLive();
  return adminGet(user, "/prompts/settings");
}

export async function updatePromptSettings(user: User, patch: PromptSettingsPatch): Promise<PromptSettings> {
  requireLive();
  return adminSend(user, "/prompts/settings", patch, "PATCH");
}
