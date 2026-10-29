/** Roles that can open the admin portal (the API decides what each can do there). Shared by web and app. */
export const STAFF_ROLES = ["owner", "admin", "moderator"] as const;

export function isStaff(role: string | null | undefined): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role ?? "");
}
