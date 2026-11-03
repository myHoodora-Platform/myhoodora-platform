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

/** "Community guidelines | myHoodora" → "Community guidelines" (the app's header already says where you are). */
export function pageTitle(title: string | undefined): string {
  const t = (title ?? "").split("|")[0]!.trim();
  // Before a page has its title, the view reports its address.
  return /^https?:\/\//.test(t) ? "" : t;
}
