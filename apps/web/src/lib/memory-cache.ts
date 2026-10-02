/**
 * Tiny per-tab cache for stale-while-revalidate screens (chat, support):
 * show what you saw last instantly, then refresh. Memory only, never
 * localStorage (messages are private on shared devices), and wiped on sign-out.
 */
const registry = new Set<Map<string, unknown>>();

export interface MemoryCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

/** `max` bounds memory: the least recently written entry is dropped first. */
export function createMemoryCache<T>(max = 50): MemoryCache<T> {
  const store = new Map<string, T>();
  registry.add(store as Map<string, unknown>);
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      store.delete(key); // re-insert so it counts as the newest
      store.set(key, value);
      if (store.size > max) store.delete(store.keys().next().value!);
    },
  };
}

/** Sign-out: forget everything cached for the previous person. */
export function clearMemoryCaches(): void {
  registry.forEach((store) => store.clear());
}
