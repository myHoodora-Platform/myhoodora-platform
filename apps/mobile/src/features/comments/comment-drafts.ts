/** What you were writing on a post (and to whom), kept in memory while the app runs: closing the sheet loses nothing. */
export interface Draft {
  text: string;
  /** The comment answered, and the top-level comment its thread hangs from (the same one for a top-level comment). */
  replyTo?: { commentId: string; rootId: string; name: string };
}

const drafts = new Map<string, Draft>();

export const commentDrafts = {
  get: (postId: string): Draft => drafts.get(postId) ?? { text: "" },
  set: (postId: string, draft: Draft) => {
    if (!draft.text && !draft.replyTo) drafts.delete(postId);
    else drafts.set(postId, draft);
  },
  clear: (postId: string) => void drafts.delete(postId),
};

/** A fresh id per comment you write; a retry reuses it, so the API never makes two. */
export function newClientId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
