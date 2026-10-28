import { pushOnce } from "@/core/navigation/use-router";

/**
 * Opens one of the website's public pages (guidelines, terms, Business…) in the app's own web view
 * (features/web), under the app's header. `title` shows until the page reports its own.
 */
export function openWeb(path: string, title?: string): Promise<void> {
  pushOnce({ pathname: "/web", params: { path, ...(title && { title }) } });
  return Promise.resolve();
}
