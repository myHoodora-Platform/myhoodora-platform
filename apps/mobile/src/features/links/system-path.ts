import { normaliseInviteCode } from "@myhoodora/api-contract/invites";
import { rememberInviteRef } from "@/core/invites/invite-ref";

/**
 * Links from outside the app (https://myhoodora.com/… app links, myhoodora://…): the web's paths, mapped
 * to the app's, and the sharer's invite code (`?ref=`) kept for sign-up. Never throws.
 */
export function systemPathToRoute({ path }: { path: string; initial?: boolean }): string {
  try {
    const url = new URL(path, "myhoodora://app");
    // myhoodora://p/<id> puts the first segment in the host.
    const pathname = url.protocol === "myhoodora:" && url.host && url.host !== "app" ? `/${url.host}${url.pathname}` : url.pathname;
    const ref = normaliseInviteCode(url.searchParams.get("ref"));
    if (ref) void rememberInviteRef(ref, pathname.startsWith("/p/") ? "post" : pathname.startsWith("/g/") ? "group" : "link");
    // The web's profile page is /profile/<uid>; the app's is /u/<uid>.
    const profile = /^\/profile\/([^/]+)\/?$/.exec(pathname);
    if (profile) return `/u/${profile[1]}`;
    // A shared badge or a poster is the same invite as /i/<code> in the app.
    const invite = /^\/i\/([^/]+)\/(badge|poster)\/?$/.exec(pathname);
    if (invite) return `/i/${invite[1]}`;
    url.searchParams.delete("ref");
    const query = url.searchParams.toString();
    return `${pathname || "/"}${query ? `?${query}` : ""}`;
  } catch {
    return "/";
  }
}
