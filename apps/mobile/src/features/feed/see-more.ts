/** Lines a post shows in the feed before "See more" (ads use 3). */
export const FEED_LINES = 5;
/** Longer than this, "See more" opens the post instead of growing the card past a few screens. */
export const INLINE_EXPAND_LIMIT = 2000;
/** "… See more" takes about this many characters at the end of the last line. */
const SUFFIX_ROOM = 13;

/**
 * The text to show collapsed, from the lines the full text actually rendered as (onTextLayout), or
 * null when it fits and needs no "See more". Decided by rendered lines, never by character count, so a
 * short post with many line breaks is clamped and a long single paragraph on a wide phone is not.
 */
export function collapsedText(lines: readonly string[], max: number): string | null {
  if (lines.length <= max) return null;
  const kept = lines.slice(0, max);
  const raw = kept[max - 1]!;
  let last = raw.replace(/\s+$/, "");
  // A line that ended in a line break has room left; one that wrapped is full, so make room.
  if (!raw.endsWith("\n")) {
    last = last.slice(0, Math.max(0, last.length - SUFFIX_ROOM));
    // Back to the last whole word, when there's one nearby.
    const space = last.lastIndexOf(" ");
    if (space > 0 && space > last.length - 12) last = last.slice(0, space);
  }
  return `${kept.slice(0, -1).join("")}${last.replace(/[\s.,;:!?-]+$/, "")}`;
}

/** Posts whose text was opened in the feed: they stay open while the list scrolls and cards remount. */
const expanded = new Set<string>();
export const expandedPosts = {
  has: (id: string) => expanded.has(id),
  add: (id: string) => void expanded.add(id),
  delete: (id: string) => void expanded.delete(id),
};
