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

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const liveStore = {
  setStatus: (status: LiveStatus) => state.status !== status && set({ status }),
  postArrived: (id: string | undefined) => {
    if (id && ownPosts.delete(id)) return;
    set({ newPosts: state.newPosts + 1 });
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
