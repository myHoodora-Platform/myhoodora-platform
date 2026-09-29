import type { User } from "firebase/auth";
import { isLive } from "../config";
import { adminGet, mock } from "./http";
import type { AdminRole, AdminSession, Capability } from "./types";

/**
 * What each role may do. Mirrors the backend RolesGuard (contract §13.1);
 * the UI only uses it to hide actions — the API still enforces every call.
 */
export const ROLE_CAPABILITIES: Record<AdminRole, Capability[]> = {
  moderator: ["moderation.act", "verification.review"],
  admin: [
    "moderation.act",
    "moderation.suspend",
    "verification.review",
    "hoods.manage",
    "businesses.review",
    "broadcasts.send",
    "team.manage",
    "settings.manage",
  ],
};

const PREVIEW_KEY = "mh-admin-preview-role";

/** Mock mode only: which role to preview the admin as. */
export function previewRole(): AdminRole {
  try {
    return window.localStorage.getItem(PREVIEW_KEY) === "moderator" ? "moderator" : "admin";
  } catch {
    return "admin";
  }
}

export function setPreviewRole(role: AdminRole) {
  try {
    window.localStorage.setItem(PREVIEW_KEY, role);
  } catch {
    // Storage blocked — the preview simply stays on the default role.
  }
}

/**
 * live: GET /admin/me. 403 for non-staff.
 * Mock: real staff roles are respected; anyone else previews the admin with
 * a clearly labelled local role so the UI can be reviewed without a backend.
 */
export async function getAdminSession(user: User, profileRole?: string): Promise<AdminSession> {
  if (isLive("admin.session")) return adminGet<AdminSession>(user, "/me");
  return mock(() => {
    const real = profileRole === "admin" || profileRole === "moderator" ? profileRole : null;
    const role = real ?? previewRole();
    return {
      uid: user.uid,
      displayName: user.displayName ?? user.email?.split("@")[0] ?? "Staff",
      role,
      can: ROLE_CAPABILITIES[role],
      preview: !real,
    };
  }, 150);
}
