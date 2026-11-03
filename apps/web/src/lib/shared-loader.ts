import type { User } from "firebase/auth";
import { createMemoryCache } from "./memory-cache";

/**
 * One request, many readers: for small per-person data that several places
 * want at once (the header's unread badges). Whoever asks first starts the
 * request, everyone asking meanwhile shares it, and the answer is kept in
 * memory so the next reader paints it at once and refreshes behind it.
 *
 * This is what lets the app shell start these requests the moment it knows
 * who is signed in, while the header that shows them mounts a little later.
 * Memory only, and wiped on sign-out with every other memory cache.
 */
export interface SharedLoader<T> {
  /** The last answer for this person, if any (no request). */
  peek(uid: string): T | undefined;
  /** The answer: a just-fetched one as is, otherwise a (shared) request. `force` always asks again. */
  load(user: User, options?: { force?: boolean }): Promise<T>;
  /** Replace the remembered answer (optimistic updates). */
  set(uid: string, value: T): void;
}

export function createSharedLoader<T>(fetcher: (user: User) => Promise<T>, freshMs = 5_000): SharedLoader<T> {
  const cache = createMemoryCache<{ value: T; at: number }>(5);
  const running = new Map<string, Promise<T>>();

  return {
    peek: (uid) => cache.get(uid)?.value,
    set: (uid, value) => cache.set(uid, { value, at: Date.now() }),
    load(user, { force = false } = {}) {
      const { uid } = user;
      if (!force) {
        const hit = cache.get(uid);
        if (hit && Date.now() - hit.at < freshMs) return Promise.resolve(hit.value);
        const active = running.get(uid);
        if (active) return active;
      }
      const request = fetcher(user)
        .then((value) => {
          cache.set(uid, { value, at: Date.now() });
          return value;
        })
        .finally(() => {
          if (running.get(uid) === request) running.delete(uid);
        });
      running.set(uid, request);
      return request;
    },
  };
}
