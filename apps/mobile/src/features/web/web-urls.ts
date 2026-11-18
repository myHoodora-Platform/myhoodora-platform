/**
 * Which of the website's pages the in-app web view may open. Only a path on our own site: never a
 * full address handed in from a link, so nothing can turn the app's view into someone else's page.
 */
export function webPageUrl(site: string, path: string | undefined): string {
  const base = site.replace(/\/+$/, "");
  const safe = typeof path === "string" && /^\/(?!\/)[^\s\\]*$/.test(path) ? path : "/";
  return `${base}${safe}`;
}

/** Same scheme, host and port as our site. */
export function isSameSite(url: string, site: string): boolean {
  try {
    return new URL(url).origin === new URL(site).origin;
  } catch {
    return false;
  }
}

/** Our site, counting the site's own redirect between myhoodora.com and www.myhoodora.com. */
export function isOurSite(url: string, site: string): boolean {
  try {
    const u = new URL(url);
    const s = new URL(site);
    const bare = (h: string) => h.replace(/^www\./, "");
    return isSameSite(url, site) || (u.protocol === s.protocol && u.port === s.port && bare(u.hostname) === bare(s.hostname));
  } catch {
    return false;
  }
}

/** This document on our site, including the site's own redirect between myhoodora.com and www.myhoodora.com. */
export function isSamePage(url: string, site: string, path: string): boolean {
  try {
    return isOurSite(url, site) && new URL(url).pathname.replace(/\/+$/, "") === path;
  } catch {
    return false;
  }
}

/** What a WebView asks before loading something (react-native-webview's request; isTopFrame is iOS only). */
export interface LoadRequest {
  url: string;
  isTopFrame?: boolean;
}

/**
 * Whether the in-app view loads this itself. Pages we keep load here; a link anywhere else is handed
 * to `openOutside` (the phone's browser, mail app) and not loaded here.
 *
 * iOS asks about every frame inside the page too (analytics, embeds, about:blank), not just links the
 * person taps. Those belong to the page being read: sending them to Safari pulled people out of the
 * app as soon as a policy opened. Only the page itself (the top frame) ever leaves.
 */
export function loadInApp(req: LoadRequest, keep: (url: string) => boolean, openOutside: (url: string) => void): boolean {
  if (keep(req.url)) return true;
  if (req.isTopFrame === false) return true;
  if (/^(about|data|blob):/i.test(req.url)) return true;
  openOutside(req.url);
  return false;
}

/** "Community guidelines | myHoodora" → "Community guidelines" (the app's header already says where you are). */
export function pageTitle(title: string | undefined): string {
  const t = (title ?? "").split("|")[0]!.trim();
  // Before a page has its title, the view reports its address.
  return /^https?:\/\//.test(t) ? "" : t;
}
