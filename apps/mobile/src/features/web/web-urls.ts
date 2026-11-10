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

/** This document on our site, including the site's own redirect between myhoodora.com and www.myhoodora.com. */
export function isSamePage(url: string, site: string, path: string): boolean {
  try {
    const u = new URL(url);
    const s = new URL(site);
    const bare = (h: string) => h.replace(/^www\./, "");
    const ourSite = isSameSite(url, site) || (u.protocol === s.protocol && u.port === s.port && bare(u.hostname) === bare(s.hostname));
    return ourSite && u.pathname.replace(/\/+$/, "") === path;
  } catch {
    return false;
  }
}

/** "Community guidelines | myHoodora" → "Community guidelines" (the app's header already says where you are). */
export function pageTitle(title: string | undefined): string {
  const t = (title ?? "").split("|")[0]!.trim();
  // Before a page has its title, the view reports its address.
  return /^https?:\/\//.test(t) ? "" : t;
}
