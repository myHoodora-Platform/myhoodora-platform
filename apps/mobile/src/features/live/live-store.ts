import { useSyncExternalStore } from "react";

/**
 * What the live connection is doing, for the screens that care: an open conversation polls only while
 * it isn't "live", and the feed shows "N new posts" instead of jumping when neighbours post.
 */
export type LiveStatus = "connecting" | "live" | "polling";

interface State {
  status: LiveStatus;
  newPosts: number;
}

let state: State = { status: "connecting", newPosts: 0 };
const listeners = new Set<() => void>();
/** Posts made on this phone: their own `post.created` isn't news to the person who wrote them. */
const ownPosts = new Set<string>();
/**
 * The live event can arrive before this phone hears back from its own POST (it's sent while the
 * request is still returning), so a new post is counted only after this long, once we know whose it is.
 */
export const NEW_POST_SETTLE_MS = 1500;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const liveStore = {
  setStatus: (status: LiveStatus) => state.status !== status && set({ status }),
  postArrived: (id: string | undefined) => {
    setTimeout(() => {
      if (id && ownPosts.delete(id)) return;
      set({ newPosts: state.newPosts + 1 });
    }, NEW_POST_SETTLE_MS);
  },
  clearNewPosts: () => state.newPosts && set({ newPosts: 0 }),
  markOwnPost: (id: string) => ownPosts.add(id),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
};

export function useLive(): State {
  return useSyncExternalStore(liveStore.subscribe, liveStore.get);
}
