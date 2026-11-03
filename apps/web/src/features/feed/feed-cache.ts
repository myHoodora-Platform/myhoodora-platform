import type { Post } from "@/lib/api/types";

/**
 * Last successfully loaded first page of the feed, per user + neighbourhood.
 * Shown instantly on the next visit (stale-while-revalidate) and kept on
 * screen when a refresh fails, instead of blanking the feed on a bad network.
 * Cleared on logout (clearFeedCaches).
 */
const PREFIX = "mh-feed-cache:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  posts: Post[];
  savedAt: string;
}

const key = (uid: string, neighborhoodId: string) => `${PREFIX}${uid}:${neighborhoodId}`;

export function readFeedCache(uid: string, neighborhoodId: string): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(key(uid, neighborhoodId));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - new Date(entry.savedAt).getTime() > MAX_AGE_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

export function writeFeedCache(uid: string, neighborhoodId: string, posts: Post[]) {
  try {
    const entry: CacheEntry = { posts, savedAt: new Date().toISOString() };
    window.localStorage.setItem(key(uid, neighborhoodId), JSON.stringify(entry));
  } catch {
    // Storage full or blocked — caching is best-effort.
  }
}

export function clearFeedCaches() {
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith(PREFIX)) window.localStorage.removeItem(k);
    }
  } catch {
    // Best-effort.
  }
}
